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
  parseWorkbookBuffer,
  pickColumn,
  sha256Hex,
  type SheetRow,
} from './excel-parser'
import { resolveAndPersistEnrichment } from './enrichment'
import { financeError, financeLog } from './logger'
import { appendOperationLog, newId } from './operation-log'
import { purgeBillingPeriodArtifacts } from './purge'

function parseDateCell(raw: string | null): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
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

function mapCustomerRows(rows: SheetRow[]): {
  parsed: Omit<typeof billingPeriodRawCustomerConsumption.$inferInsert, 'id' | 'batchId'>[]
  errors: string[]
} {
  const parsed: Omit<
    typeof billingPeriodRawCustomerConsumption.$inferInsert,
    'id' | 'batchId'
  >[] = []
  const errors: string[] = []
  rows.forEach((row, idx) => {
    const rowNo = idx + 2
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id', 'tenantId'])
    if (!tenantId) {
      errors.push(`第 ${rowNo} 行：缺少租户ID`)
      return
    }
    const ctype = normalizeCustomerType(pickColumn(row, ['客户类型', 'customer_type']))
    if (!ctype) {
      errors.push(`第 ${rowNo} 行：客户类型无效`)
      return
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
  })
  return { parsed, errors }
}

function mapBaremetalRows(
  rows: SheetRow[],
  periodStart: string,
  periodEnd: string,
): {
  parsed: Omit<typeof billingPeriodRawBaremetalOrder.$inferInsert, 'id' | 'batchId'>[]
  errors: string[]
} {
  const start = new Date(`${periodStart}T00:00:00+08:00`)
  const end = new Date(`${periodEnd}T23:59:59+08:00`)
  const parsed: Omit<typeof billingPeriodRawBaremetalOrder.$inferInsert, 'id' | 'batchId'>[] = []
  const errors: string[] = []

  rows.forEach((row, idx) => {
    const rowNo = idx + 2
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id'])
    const orderId = pickColumn(row, ['订单ID', 'order_id'])
    const payStatus = pickColumn(row, ['支付状态', 'pay_status']) ?? ''
    const finalAmount = parseMoneyCell(pickColumn(row, ['最终总额', 'final_amount']))
    const orderedAtRaw = pickColumn(row, ['下单时间', 'ordered_at'])
    const orderedAt = parseDateCell(orderedAtRaw)
    if (!tenantId || !orderId) {
      errors.push(`第 ${rowNo} 行：缺少租户ID或订单ID`)
      return
    }
    if (!orderedAt) {
      errors.push(`第 ${rowNo} 行：下单时间无效`)
      return
    }
    if (payStatus && !payStatus.includes('已支付') && payStatus.toLowerCase() !== 'paid') {
      return
    }
    if (orderedAt < start || orderedAt > end) return
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
  })
  return { parsed, errors }
}

function mapTenantBillRows(rows: SheetRow[]): {
  parsed: Omit<typeof billingPeriodRawTenantBill.$inferInsert, 'id' | 'batchId'>[]
  tenantPlatformIds: string[]
  errors: string[]
} {
  const parsed: Omit<typeof billingPeriodRawTenantBill.$inferInsert, 'id' | 'batchId'>[] = []
  const tenantPlatformIds: string[] = []
  const errors: string[] = []

  rows.forEach((row, idx) => {
    const rowNo = idx + 2
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id'])
    if (!tenantId || isTotalRow(tenantId)) return
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
  })
  return { parsed, errors, tenantPlatformIds }
}

export async function importExcelFile(input: {
  billingPeriodId: string
  fileType: ImportFileType
  fileName: string
  buffer: Buffer
  actorId?: string | null
}): Promise<{ rowCount: number; batchId: string }> {
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

  const sheetRows = parseWorkbookBuffer(input.buffer, input.fileName)
  const batchId = newId()
  const fileSha256 = sha256Hex(input.buffer)
  let tenantPlatformIdsForEnrichment: string[] = []

  try {
    await db.transaction(async (tx) => {
      await tx.insert(billingPeriodImportBatch).values({
        id: batchId,
        billingPeriodId: input.billingPeriodId,
        fileType: input.fileType,
        fileName: input.fileName,
        fileSha256,
        rowCount: 0,
        uploadedBy: input.actorId ?? null,
      })

      if (input.fileType === 'customer_consumption') {
        const { parsed, errors } = mapCustomerRows(sheetRows)
        if (errors.length > 0) {
          throw new FinanceError('BAD_REQUEST', errors.slice(0, 5).join('；'))
        }
        if (parsed.length === 0) {
          throw new FinanceError('BAD_REQUEST', '客户消费明细无有效数据行')
        }
        await tx.insert(billingPeriodRawCustomerConsumption).values(
          parsed.map((r) => ({ ...r, id: newId(), batchId })),
        )
        await tx
          .update(billingPeriodImportBatch)
          .set({ rowCount: parsed.length })
          .where(eq(billingPeriodImportBatch.id, batchId))
      } else if (input.fileType === 'baremetal_order') {
        const { parsed, errors } = mapBaremetalRows(
          sheetRows,
          period.periodStart,
          period.periodEnd,
        )
        if (errors.length > 0) {
          throw new FinanceError('BAD_REQUEST', errors.slice(0, 5).join('；'))
        }
        await tx.insert(billingPeriodRawBaremetalOrder).values(
          parsed.map((r) => ({ ...r, id: newId(), batchId })),
        )
        await tx
          .update(billingPeriodImportBatch)
          .set({ rowCount: parsed.length })
          .where(eq(billingPeriodImportBatch.id, batchId))
      } else if (input.fileType === 'tenant_bill') {
        const { parsed, errors, tenantPlatformIds } = mapTenantBillRows(sheetRows)
        if (errors.length > 0) {
          throw new FinanceError('BAD_REQUEST', errors.slice(0, 5).join('；'))
        }
        if (parsed.length === 0) {
          throw new FinanceError('BAD_REQUEST', '账单详情无有效明细行')
        }
        await tx.insert(billingPeriodRawTenantBill).values(
          parsed.map((r) => ({ ...r, id: newId(), batchId })),
        )
        await tx
          .update(billingPeriodImportBatch)
          .set({ rowCount: parsed.length })
          .where(eq(billingPeriodImportBatch.id, batchId))
        tenantPlatformIdsForEnrichment = tenantPlatformIds
      }
    })

    if (input.fileType === 'tenant_bill' && tenantPlatformIdsForEnrichment.length > 0) {
      await resolveAndPersistEnrichment(
        input.billingPeriodId,
        tenantPlatformIdsForEnrichment,
        period.periodEnd,
      )
    }
  } catch (e) {
    financeError('import', 'failed', e, { periodId: input.billingPeriodId })
    throw e
  }

  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, input.billingPeriodId),
  })
  const requiredTypes = [
    'customer_consumption',
    'baremetal_order',
    'tenant_bill',
  ] as const
  const imported = new Set(batches.map((b) => b.fileType))
  const allImported = requiredTypes.every((t) => imported.has(t))
  await db
    .update(billingPeriod)
    .set({ status: allImported ? 'imported' : 'draft' })
    .where(eq(billingPeriod.id, input.billingPeriodId))

  const batch = await db.query.billingPeriodImportBatch.findFirst({
    where: eq(billingPeriodImportBatch.id, batchId),
  })

  await appendOperationLog({
    billingPeriodId: input.billingPeriodId,
    operation: 'import_batch',
    actorId: input.actorId,
    metadata: { fileType: input.fileType, fileName: input.fileName, rowCount: batch?.rowCount },
  })

  financeLog('import', 'done', {
    periodId: input.billingPeriodId,
    fileType: input.fileType,
    rowCount: batch?.rowCount,
  })

  return { rowCount: batch?.rowCount ?? 0, batchId }
}
