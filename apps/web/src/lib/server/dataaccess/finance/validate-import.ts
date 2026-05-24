import { db } from '@/lib/db'
import {
  billingPeriodImportBatch,
  billingPeriodRawCustomerConsumption,
  billingPeriodRawTenantBill,
  billingTenant,
  dataCenter,
  gpuCardType,
  supplierPricingRecord,
} from '@workspace/db/schema'
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import type { ImportFileType } from './constants'
import type { ImportCellError } from './import-errors'
import { buildMarkedErrorWorkbookBuffer } from './import-errors'
import {
  deleteStorageFile,
  readStorageFile,
  saveImportErrorReport,
} from './import-storage'
import { parseWorkbookDetailed } from './excel-parser'

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
  const required: ImportFileType[] = [
    'customer_consumption',
    'baremetal_order',
    'tenant_bill',
  ]
  if (!required.every((t) => okBatches.some((b) => b.fileType === t))) {
    return { ok: false, errorsByFileType: {} }
  }

  const customerBatch = okBatches.find((b) => b.fileType === 'customer_consumption')!
  const tenantBillBatch = okBatches.find((b) => b.fileType === 'tenant_bill')!

  const [customerRows, tenantBillRows] = await Promise.all([
    db
      .select()
      .from(billingPeriodRawCustomerConsumption)
      .where(eq(billingPeriodRawCustomerConsumption.batchId, customerBatch.id)),
    db
      .select()
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, tenantBillBatch.id)),
  ])

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

export type MissingPricingPair = {
  regionCode: string
  gpuModel: string
}

export async function findMissingTenantBillPricing(input: {
  periodId: string
  periodEnd: string
}): Promise<MissingPricingPair[]> {
  const tenantBillBatch = await db.query.billingPeriodImportBatch.findFirst({
    where: and(
      eq(billingPeriodImportBatch.billingPeriodId, input.periodId),
      eq(billingPeriodImportBatch.fileType, 'tenant_bill'),
      eq(billingPeriodImportBatch.parseStatus, 'ok'),
    ),
  })
  if (!tenantBillBatch) return []

  const rows = await db
    .select({
      regionCode: billingPeriodRawTenantBill.regionCode,
      gpuModel: billingPeriodRawTenantBill.gpuModel,
    })
    .from(billingPeriodRawTenantBill)
    .where(eq(billingPeriodRawTenantBill.batchId, tenantBillBatch.id))

  const pairs = new Map<string, MissingPricingPair>()
  for (const row of rows) {
    const key = `${row.regionCode}::${row.gpuModel}`
    if (!pairs.has(key)) {
      pairs.set(key, { regionCode: row.regionCode, gpuModel: row.gpuModel })
    }
  }

  const missing: MissingPricingPair[] = []
  for (const pair of pairs.values()) {
    const hit = await db
      .select({ id: supplierPricingRecord.id })
      .from(supplierPricingRecord)
      .innerJoin(dataCenter, eq(supplierPricingRecord.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierPricingRecord.gpuCardTypeId, gpuCardType.id))
      .where(
        and(
          eq(
            sql`lower(${dataCenter.containerInstanceRegion})`,
            pair.regionCode.toLowerCase(),
          ),
          or(
            eq(sql`lower(${gpuCardType.code})`, pair.gpuModel.toLowerCase()),
            eq(sql`lower(${gpuCardType.name})`, pair.gpuModel.toLowerCase()),
          ),
          eq(supplierPricingRecord.configStatus, 'active'),
          lte(supplierPricingRecord.effectiveFrom, `${input.periodEnd} 23:59:59`),
          or(
            isNull(supplierPricingRecord.effectiveTo),
            sql`${supplierPricingRecord.effectiveTo} >= ${`${input.periodEnd} 00:00:00`}`,
          ),
        ),
      )
      .limit(1)
    if (hit.length === 0) missing.push(pair)
  }
  return missing
}

export async function persistBatchErrorReport(input: {
  batchId: string
  errors: ImportCellError[]
}): Promise<string> {
  const batch = await db.query.billingPeriodImportBatch.findFirst({
    where: eq(billingPeriodImportBatch.id, input.batchId),
  })
  if (!batch?.storagePath) throw new Error('batch not found')

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
}): Promise<{ fileName: string; fileBase64: string } | null> {
  const batch = await db.query.billingPeriodImportBatch.findFirst({
    where: and(
      eq(billingPeriodImportBatch.billingPeriodId, input.periodId),
      eq(billingPeriodImportBatch.fileType, input.fileType),
    ),
  })
  if (!batch?.errorReportPath) return null
  const buf = await readStorageFile(batch.errorReportPath)
  const base = batch.fileName.replace(/\.(xlsx|xls|csv)$/i, '')
  return {
    fileName: `${base}-导入错误.xlsx`,
    fileBase64: buf.toString('base64'),
  }
}
