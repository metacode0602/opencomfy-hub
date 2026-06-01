import { db } from '@/lib/db'
import {
  billingPeriodImportBatch,
  billingPeriodRawCustomerConsumption,
  billingPeriodRawTenantBill,
  billingTenant,
} from '@workspace/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import type { ImportFileType } from './constants'
import type { ImportCellError } from './import-errors'
import { buildMarkedErrorWorkbookBuffer } from './import-errors'
import { parseWorkbookDetailed } from './excel-parser'
export {
  findMissingBaremetalPlatformListPrice,
  findMissingTenantBillPricing,
  findMissingTenantBillPricingAtPeriodEnd,
  type MissingPricingIssue,
  type MissingPricingPair,
  type PricingFailureReason,
} from './tenant-bill-pricing'

async function importStorageLocal() {
  return import('./import-storage-local')
}

export type CrossFileValidation = {
  ok: boolean
  errorsByFileType: Partial<Record<ImportFileType, ImportCellError[]>>
}

async function loadKnownPlatformTenants(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ platformId: billingTenant.platformTenantId })
    .from(billingTenant)
    .where(inArray(billingTenant.platformTenantId, ids))
  return new Set(rows.map((r) => r.platformId).filter(Boolean) as string[])
}

export async function validateCrossFileImports(
  periodId: string,
): Promise<CrossFileValidation> {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const okBatches = batches.filter((b) => b.parseStatus === 'ok')
  const hasCustomer = okBatches.some((b) => b.fileType === 'customer_consumption')
  const hasBaremetal = okBatches.some((b) => b.fileType === 'baremetal_order')
  const tenantBillBatches = okBatches.filter((b) => b.fileType === 'tenant_bill')
  if (!hasCustomer || !hasBaremetal || tenantBillBatches.length === 0) {
    return { ok: false, errorsByFileType: {} }
  }

  const customerBatch = okBatches.find((b) => b.fileType === 'customer_consumption')!

  const [customerRows, tenantBillRowsNested] = await Promise.all([
    db
      .select()
      .from(billingPeriodRawCustomerConsumption)
      .where(eq(billingPeriodRawCustomerConsumption.batchId, customerBatch.id)),
    Promise.all(
      tenantBillBatches.map(async (batch) => {
        const rows = await db
          .select()
          .from(billingPeriodRawTenantBill)
          .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
        return { batchId: batch.id, rows }
      }),
    ),
  ])

  const tenantBillRows = tenantBillRowsNested.flatMap((x) => x.rows)

  const bPlatformIds = new Set(
    customerRows.filter((r) => r.customerType === 'B').map((r) => r.tenantPlatformId),
  )

  const errorsByFileType: Partial<Record<ImportFileType, ImportCellError[]>> = {}
  const unknownB = new Set<string>()

  for (const row of customerRows) {
    if (row.customerType !== 'B') continue
    unknownB.add(row.tenantPlatformId)
  }
  for (const row of tenantBillRows) {
    if (bPlatformIds.has(row.tenantPlatformId)) {
      unknownB.add(row.tenantPlatformId)
    }
  }

  const known = await loadKnownPlatformTenants([...unknownB])

  for (const row of customerRows) {
    if (row.customerType !== 'B') continue
    if (known.has(row.tenantPlatformId)) continue
    const list = errorsByFileType.customer_consumption ?? []
    list.push({
      rowNo: row.rowNo,
      columnAliases: ['租户ID', 'tenant_id', 'tenantId'],
      message: 'B端租户ID未在CRM租户主数据中维护',
    })
    errorsByFileType.customer_consumption = list
  }

  const typesByTenant = new Map<string, Set<string>>()
  for (const row of customerRows) {
    const set = typesByTenant.get(row.tenantPlatformId) ?? new Set<string>()
    set.add(row.customerType)
    typesByTenant.set(row.tenantPlatformId, set)
  }
  for (const row of customerRows) {
    const types = typesByTenant.get(row.tenantPlatformId)
    if (!types || types.size <= 1) continue
    const list = errorsByFileType.customer_consumption ?? []
    list.push({
      rowNo: row.rowNo,
      columnAliases: ['客户类型', 'customer_type'],
      message: `租户 ${row.tenantPlatformId} 同时存在多种客户类型（B/C 混用），请修正后重新上传`,
    })
    errorsByFileType.customer_consumption = list
  }

  for (const row of tenantBillRows) {
    if (!bPlatformIds.has(row.tenantPlatformId)) continue
    if (known.has(row.tenantPlatformId)) continue
    const list = errorsByFileType.tenant_bill ?? []
    list.push({
      rowNo: row.rowNo,
      columnAliases: ['租户ID', 'tenant_id'],
      message: 'B端租户ID未在CRM租户主数据中维护',
    })
    errorsByFileType.tenant_bill = list
  }

  return { ok: Object.keys(errorsByFileType).length === 0, errorsByFileType }
}

export async function persistBatchErrorReport(input: {
  batchId: string
  errors: ImportCellError[]
}): Promise<string> {
  const batch = await db.query.billingPeriodImportBatch.findFirst({
    where: eq(billingPeriodImportBatch.id, input.batchId),
  })
  if (!batch?.storagePath) throw new Error('batch not found')

  const { readStorageFile, deleteStorageFile, saveImportErrorReport } = await importStorageLocal()
  const source = await readStorageFile(batch.storagePath)
  const sheet = parseWorkbookDetailed(source, batch.fileName)
  const buffer = buildMarkedErrorWorkbookBuffer({ sheet, errors: input.errors })
  await deleteStorageFile(batch.errorReportPath)
  const errorPath = await saveImportErrorReport({
    billingPeriodId: batch.billingPeriodId,
    fileType: batch.fileType,
    batchId: batch.id,
    buffer,
  })
  await db
    .update(billingPeriodImportBatch)
    .set({
      parseErrorCount: input.errors.length,
      errorReportPath: errorPath,
    })
    .where(eq(billingPeriodImportBatch.id, input.batchId))
  return errorPath
}

export async function readErrorReportBySlot(input: {
  periodId: string
  fileType: ImportFileType
  windowId?: string
}): Promise<{ fileName: string; fileBase64: string } | null> {
  const conditions = [
    eq(billingPeriodImportBatch.billingPeriodId, input.periodId),
    eq(billingPeriodImportBatch.fileType, input.fileType),
  ]
  if (input.windowId) {
    conditions.push(eq(billingPeriodImportBatch.windowId, input.windowId))
  }
  const batch = await db.query.billingPeriodImportBatch.findFirst({
    where: and(...conditions),
  })
  if (!batch?.errorReportPath) return null
  const { readStorageFile } = await importStorageLocal()
  const buf = await readStorageFile(batch.errorReportPath)
  const base = batch.fileName.replace(/\.(xlsx|xls|csv)$/i, '')
  return {
    fileName: `${base}-导入错误.xlsx`,
    fileBase64: buf.toString('base64'),
  }
}
