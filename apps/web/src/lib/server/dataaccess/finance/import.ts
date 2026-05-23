import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawCustomerConsumption,
  billingPeriodRawTenantBill,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import type { ImportFileType } from './constants'
import { FinanceError } from './errors'
import {
  isTotalRow,
  normalizeCustomerType,
  parseMoneyCell,
  parseWorkbookDetailed,
  pickColumn,
  sha256Hex,
  type ParsedWorkbook,
} from './excel-parser'
import { resolveAndPersistEnrichment } from './enrichment'
import type { ImportCellError } from './import-errors'
import {
  buildMarkedErrorWorkbookBuffer,
  summarizeImportErrors,
} from './import-errors'
import {
  deleteStorageFile,
  saveImportErrorReport,
  saveImportSourceFile,
} from './import-storage'
import { financeError, financeLog } from './logger'
import { appendOperationLog, newId } from './operation-log'
import { purgeBillingPeriodArtifacts } from './purge'
import {
  persistBatchErrorReport,
  validateCrossFileImports,
} from './validate-import'

function parseDateCell(raw: string | null): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export type ImportFileResult = {
  ok: boolean
  batchId: string
  rowCount: number
  parseStatus: 'ok' | 'error'
  parseErrorCount: number
  message: string
  hasErrorReport: boolean
  allParsed: boolean
  periodStatus: string
}

async function getPeriodOrThrow(periodId: string) {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  if (period.status === 'published' || period.status === 'adjusted') {
    throw new FinanceError('CONFLICT', '已发布账期须先撤回发布后再上传')
  }
  if (period.status === 'void') {
    throw new FinanceError('CONFLICT', '作废账期不可上传')
  }
  return period
}

function mapCustomerRows(sheet: ParsedWorkbook): {
  parsed: Omit<typeof billingPeriodRawCustomerConsumption.$inferInsert, 'id' | 'batchId'>[]
  errors: ImportCellError[]
} {
  const parsed: Omit<
    typeof billingPeriodRawCustomerConsumption.$inferInsert,
    'id' | 'batchId'
  >[] = []
  const errors: ImportCellError[] = []

  for (const { rowNo, row } of sheet.rows) {
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id', 'tenantId'])
    if (isTotalRow(tenantId)) continue
    if (!tenantId) {
      errors.push({
        rowNo,
        columnAliases: ['租户ID', 'tenant_id', 'tenantId'],
        message: '缺少租户ID',
      })
      continue
    }
    const ctype = normalizeCustomerType(pickColumn(row, ['客户类型', 'customer_type']))
    if (!ctype) {
      errors.push({
        rowNo,
        columnAliases: ['客户类型', 'customer_type'],
        message: '客户类型无效',
      })
      continue
    }
    parsed.push({
      rowNo,
      tenantPlatformId: tenantId,
      productType: pickColumn(row, ['类型', 'product_type']),
      tenantType: pickColumn(row, ['租户类型', 'tenant_type']),
      customerType: ctype,
      projectNameExcel: pickColumn(row, ['项目名称', 'project_name']),
      totalConsumption: parseMoneyCell(pickColumn(row, ['总消费', 'total_consumption'])),
      voucherConsumption: parseMoneyCell(pickColumn(row, ['券消费', 'voucher_consumption'])),
      balanceConsumption: parseMoneyCell(pickColumn(row, ['余额消费', 'balance_consumption'])),
      rawJson: row,
    })
  }
  if (parsed.length === 0 && errors.length === 0) {
    errors.push({
      rowNo: 2,
      columnAliases: ['租户ID', 'tenant_id', 'tenantId'],
      message: '客户消费明细无有效数据行',
    })
  }
  return { parsed, errors }
}

function mapBaremetalRows(
  sheet: ParsedWorkbook,
  periodStart: string,
  periodEnd: string,
): {
  parsed: Omit<typeof billingPeriodRawBaremetalOrder.$inferInsert, 'id' | 'batchId'>[]
  errors: ImportCellError[]
} {
  const start = new Date(`${periodStart}T00:00:00+08:00`)
  const end = new Date(`${periodEnd}T23:59:59+08:00`)
  const parsed: Omit<typeof billingPeriodRawBaremetalOrder.$inferInsert, 'id' | 'batchId'>[] = []
  const errors: ImportCellError[] = []

  for (const { rowNo, row } of sheet.rows) {
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id'])
    if (isTotalRow(tenantId)) continue
    const orderId = pickColumn(row, ['订单ID', 'order_id'])
    const payStatus = pickColumn(row, ['支付状态', 'pay_status']) ?? ''
    const finalAmount = parseMoneyCell(pickColumn(row, ['最终总额', 'final_amount']))
    const orderedAtRaw = pickColumn(row, ['下单时间', 'ordered_at'])
    const orderedAt = parseDateCell(orderedAtRaw)
    if (!tenantId || !orderId) {
      errors.push({
        rowNo,
        columnAliases: tenantId ? ['订单ID', 'order_id'] : ['租户ID', 'tenant_id'],
        message: '缺少租户ID或订单ID',
      })
      continue
    }
    if (!orderedAt) {
      errors.push({
        rowNo,
        columnAliases: ['下单时间', 'ordered_at'],
        message: '下单时间无效',
      })
      continue
    }
    if (payStatus && !payStatus.includes('已支付') && payStatus.toLowerCase() !== 'paid') {
      continue
    }
    if (orderedAt < start || orderedAt > end) continue
    parsed.push({
      rowNo,
      orderId,
      orderNo: pickColumn(row, ['订单编号', 'order_no']),
      tenantPlatformId: tenantId,
      idcName: pickColumn(row, ['机房名称', 'idc_name']),
      deviceModel: pickColumn(row, ['设备型号', 'device_model']),
      payStatus: payStatus || '已支付',
      deviceStatus: pickColumn(row, ['设备状态', 'device_status']),
      purchaseQtyText: pickColumn(row, ['购买数量', 'purchase_qty']),
      deviceQty: null,
      orderAmount: parseMoneyCell(pickColumn(row, ['订单金额', 'order_amount'])),
      refundAmount: parseMoneyCell(pickColumn(row, ['退款金额', 'refund_amount'])),
      finalAmount,
      orderedAt,
      rawJson: row,
    })
  }
  return { parsed, errors }
}

function mapTenantBillRows(sheet: ParsedWorkbook): {
  parsed: Omit<typeof billingPeriodRawTenantBill.$inferInsert, 'id' | 'batchId'>[]
  tenantPlatformIds: string[]
  errors: ImportCellError[]
} {
  const parsed: Omit<typeof billingPeriodRawTenantBill.$inferInsert, 'id' | 'batchId'>[] = []
  const tenantPlatformIds: string[] = []
  const errors: ImportCellError[] = []

  for (const { rowNo, row } of sheet.rows) {
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id'])
    if (!tenantId || isTotalRow(tenantId)) continue
    const balanceHours = pickColumn(row, ['余额卡时', 'balance_card_hours'])
    parsed.push({
      rowNo,
      tenantPlatformId: tenantId,
      totalConsumption: parseMoneyCell(pickColumn(row, ['总消费', 'total_consumption'])),
      voucherConsumption: parseMoneyCell(pickColumn(row, ['券消费', 'voucher_consumption'])),
      balanceConsumption: parseMoneyCell(pickColumn(row, ['余额消费', 'balance_consumption'])),
      totalCardHours: parseMoneyCell(pickColumn(row, ['总卡时', 'total_card_hours'])),
      voucherCardHours: parseMoneyCell(pickColumn(row, ['券卡时', 'voucher_card_hours'])),
      balanceCardHours: parseMoneyCell(balanceHours ?? '0'),
      gpuModel: pickColumn(row, ['GPU型号', 'gpu_model']) ?? '',
      regionCode: (pickColumn(row, ['区域', 'region', 'region_code']) ?? '').toLowerCase(),
      rawJson: row,
    })
    tenantPlatformIds.push(tenantId)
  }
  if (parsed.length === 0) {
    errors.push({
      rowNo: 2,
      columnAliases: ['租户ID', 'tenant_id'],
      message: '账单详情无有效明细行',
    })
  }
  return { parsed, errors, tenantPlatformIds }
}

async function syncPeriodImportStatus(periodId: string): Promise<string> {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const requiredTypes = [
    'customer_consumption',
    'baremetal_order',
    'tenant_bill',
  ] as const
  const allPresent = requiredTypes.every((t) => batches.some((b) => b.fileType === t))
  const allOk =
    allPresent &&
    requiredTypes.every((t) =>
      batches.some((b) => b.fileType === t && b.parseStatus === 'ok'),
    )

  let status = 'draft'
  if (allOk) {
    const cross = await validateCrossFileImports(periodId)
    if (cross.ok) {
      status = 'imported'
    } else {
      status = 'import_error'
      for (const [fileType, errs] of Object.entries(cross.errorsByFileType)) {
        const batch = batches.find((b) => b.fileType === fileType)
        if (batch && errs?.length) {
          await persistBatchErrorReport({ batchId: batch.id, errors: errs })
        }
      }
    }
  } else if (batches.some((b) => b.parseStatus === 'error')) {
    status = 'import_error'
  }

  await db.update(billingPeriod).set({ status }).where(eq(billingPeriod.id, periodId))
  return status
}

async function recordParseFailure(input: {
  batchId: string
  billingPeriodId: string
  fileType: ImportFileType
  fileName: string
  storagePath: string
  sheet: ParsedWorkbook
  errors: ImportCellError[]
  fileSha256: string
  fileSizeBytes: number
  actorId?: string | null
}): Promise<ImportFileResult> {
  const errorBuffer = buildMarkedErrorWorkbookBuffer({
    sheet: input.sheet,
    errors: input.errors,
  })
  const errorReportPath = await saveImportErrorReport({
    billingPeriodId: input.billingPeriodId,
    fileType: input.fileType,
    batchId: input.batchId,
    buffer: errorBuffer,
  })

  await db.insert(billingPeriodImportBatch).values({
    id: input.batchId,
    billingPeriodId: input.billingPeriodId,
    fileType: input.fileType,
    fileName: input.fileName,
    storagePath: input.storagePath,
    errorReportPath,
    fileSha256: input.fileSha256,
    fileSizeBytes: input.fileSizeBytes,
    parseStatus: 'error',
    parseErrorCount: input.errors.length,
    rowCount: 0,
    uploadedBy: input.actorId ?? null,
  })

  const periodStatus = await syncPeriodImportStatus(input.billingPeriodId)
  const message = summarizeImportErrors(input.errors)

  return {
    ok: false,
    batchId: input.batchId,
    rowCount: 0,
    parseStatus: 'error',
    parseErrorCount: input.errors.length,
    message,
    hasErrorReport: true,
    allParsed: false,
    periodStatus,
  }
}

export async function importExcelFile(input: {
  billingPeriodId: string
  fileType: ImportFileType
  fileName: string
  buffer: Buffer
  actorId?: string | null
}): Promise<ImportFileResult> {
  const period = await getPeriodOrThrow(input.billingPeriodId)
  financeLog('import', `start ${input.fileType}`, {
    periodId: input.billingPeriodId,
    fileName: input.fileName,
  })

  await purgeBillingPeriodArtifacts({
    billingPeriodId: input.billingPeriodId,
    scope: 'file_type',
    fileType: input.fileType,
    actorId: input.actorId,
  })

  const sheet = parseWorkbookDetailed(input.buffer, input.fileName)
  const batchId = newId()
  const fileSha256 = sha256Hex(input.buffer)
  const storagePath = await saveImportSourceFile({
    billingPeriodId: input.billingPeriodId,
    fileType: input.fileType,
    batchId,
    fileName: input.fileName,
    buffer: input.buffer,
  })

  let tenantPlatformIdsForEnrichment: string[] = []
  let parseErrors: ImportCellError[] = []
  let rowCount = 0

  try {
    if (input.fileType === 'customer_consumption') {
      const { parsed, errors } = mapCustomerRows(sheet)
      parseErrors = errors
      if (errors.length === 0) {
        rowCount = parsed.length
        await db.transaction(async (tx) => {
          await tx.insert(billingPeriodImportBatch).values({
            id: batchId,
            billingPeriodId: input.billingPeriodId,
            fileType: input.fileType,
            fileName: input.fileName,
            storagePath,
            fileSha256,
            fileSizeBytes: input.buffer.length,
            parseStatus: 'ok',
            parseErrorCount: 0,
            rowCount: parsed.length,
            uploadedBy: input.actorId ?? null,
          })
          await tx.insert(billingPeriodRawCustomerConsumption).values(
            parsed.map((r) => ({ ...r, id: newId(), batchId })),
          )
        })
      }
    } else if (input.fileType === 'baremetal_order') {
      const { parsed, errors } = mapBaremetalRows(sheet, period.periodStart, period.periodEnd)
      parseErrors = errors
      if (errors.length === 0) {
        rowCount = parsed.length
        await db.transaction(async (tx) => {
          await tx.insert(billingPeriodImportBatch).values({
            id: batchId,
            billingPeriodId: input.billingPeriodId,
            fileType: input.fileType,
            fileName: input.fileName,
            storagePath,
            fileSha256,
            fileSizeBytes: input.buffer.length,
            parseStatus: 'ok',
            parseErrorCount: 0,
            rowCount: parsed.length,
            uploadedBy: input.actorId ?? null,
          })
          await tx.insert(billingPeriodRawBaremetalOrder).values(
            parsed.map((r) => ({ ...r, id: newId(), batchId })),
          )
        })
      }
    } else if (input.fileType === 'tenant_bill') {
      const { parsed, errors, tenantPlatformIds } = mapTenantBillRows(sheet)
      parseErrors = errors
      if (errors.length === 0) {
        rowCount = parsed.length
        await db.transaction(async (tx) => {
          await tx.insert(billingPeriodImportBatch).values({
            id: batchId,
            billingPeriodId: input.billingPeriodId,
            fileType: input.fileType,
            fileName: input.fileName,
            storagePath,
            fileSha256,
            fileSizeBytes: input.buffer.length,
            parseStatus: 'ok',
            parseErrorCount: 0,
            rowCount: parsed.length,
            uploadedBy: input.actorId ?? null,
          })
          await tx.insert(billingPeriodRawTenantBill).values(
            parsed.map((r) => ({ ...r, id: newId(), batchId })),
          )
        })
        tenantPlatformIdsForEnrichment = tenantPlatformIds
      }
    }

    if (parseErrors.length > 0) {
      return recordParseFailure({
        batchId,
        billingPeriodId: input.billingPeriodId,
        fileType: input.fileType,
        fileName: input.fileName,
        storagePath,
        sheet,
        errors: parseErrors,
        fileSha256,
        fileSizeBytes: input.buffer.length,
        actorId: input.actorId,
      })
    }

    if (input.fileType === 'tenant_bill' && tenantPlatformIdsForEnrichment.length > 0) {
      await resolveAndPersistEnrichment(
        input.billingPeriodId,
        tenantPlatformIdsForEnrichment,
        period.periodEnd,
      )
    }

    const periodStatus = await syncPeriodImportStatus(input.billingPeriodId)
    const batches = await db.query.billingPeriodImportBatch.findMany({
      where: eq(billingPeriodImportBatch.billingPeriodId, input.billingPeriodId),
    })
    const requiredTypes = [
      'customer_consumption',
      'baremetal_order',
      'tenant_bill',
    ] as const
    const allParsed =
      requiredTypes.every((t) =>
        batches.some((b) => b.fileType === t && b.parseStatus === 'ok'),
      ) && periodStatus === 'imported'

    await appendOperationLog({
      billingPeriodId: input.billingPeriodId,
      operation: 'import_batch',
      actorId: input.actorId,
      metadata: {
        fileType: input.fileType,
        fileName: input.fileName,
        rowCount,
      },
    })

    financeLog('import', 'done', {
      periodId: input.billingPeriodId,
      fileType: input.fileType,
      rowCount,
    })

    return {
      ok: true,
      batchId,
      rowCount,
      parseStatus: 'ok',
      parseErrorCount: 0,
      message: `解析成功（${rowCount} 行）`,
      hasErrorReport: false,
      allParsed,
      periodStatus,
    }
  } catch (e) {
    await deleteStorageFile(storagePath)
    financeError('import', 'failed', e, { periodId: input.billingPeriodId })
    throw e
  }
}

export async function getImportSlotStatuses(periodId: string) {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const mapSlot = (fileType: ImportFileType) => {
    const b = batches.find((x) => x.fileType === fileType)
    if (!b) return null
    return {
      batchId: b.id,
      fileName: b.fileName,
      parseStatus: b.parseStatus as 'ok' | 'error',
      parseErrorCount: b.parseErrorCount,
      rowCount: b.rowCount,
      hasErrorReport: Boolean(b.errorReportPath),
    }
  }
  return {
    customer: mapSlot('customer_consumption'),
    baremetal: mapSlot('baremetal_order'),
    tenantBill: mapSlot('tenant_bill'),
  }
}
