import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawCustomerConsumption,
  billingPeriodRawTenantBill,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { isPersonalImportFileType, type ImportFileType } from './constants'
import { FinanceError } from './errors'
import {
  isBaremetalOrderTotalRow,
  isCustomerConsumptionTotalRow,
  isTenantBillTotalRow,
  normalizeCustomerType,
  parseMoneyCell,
  parseImportDateTime,
  parseWorkbookDetailed,
  pickCellRaw,
  pickColumn,
  sha256Hex,
  TENANT_PLATFORM_ID_ALIASES,
  type ParsedWorkbook,
} from './excel-parser'
import {
  parseDeviceModel,
  parsePurchaseQty,
} from './baremetal-order-parse'
import { resolveAndPersistEnrichment } from './enrichment'
import type { ImportCellError } from './import-errors'
import {
  buildMarkedErrorWorkbookBuffer,
  summarizeImportErrors,
} from './import-errors'
import { financeError, financeLog } from './logger'
import { getImportSlotStatuses } from './import-slot-status'
import { appendOperationLog, newId } from './operation-log'
import { listTenantBillWindows, syncTenantBillWindowsForPeriod } from './tenant-bill-windows'
import {
  persistBatchErrorReport,
  validateCrossFileImports,
} from './validate-import'

async function importStorageLocal() {
  return import('./import-storage-local')
}

async function purgeBillingPeriodArtifacts(
  ...args: Parameters<
    (typeof import('./purge'))['purgeBillingPeriodArtifacts']
  >
) {
  const { purgeBillingPeriodArtifacts: purge } = await import('./purge')
  return purge(...args)
}

async function purgePersonalIncomeArtifacts(
  ...args: Parameters<
    (typeof import('./purge-personal'))['purgePersonalIncomeArtifacts']
  >
) {
  const { purgePersonalIncomeArtifacts: purge } = await import('./purge-personal')
  return purge(...args)
}

async function isPersonalImportReady(periodId: string): Promise<boolean> {
  const { getPersonalImportBatches } = await import('./purge-personal')
  const batches = await getPersonalImportBatches(periodId)
  return (
    batches.tenantBill?.parseStatus === 'ok' &&
    batches.baremetal?.parseStatus === 'ok'
  )
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
    if (isCustomerConsumptionTotalRow(row)) continue
    const tenantId = pickColumn(row, [...TENANT_PLATFORM_ID_ALIASES])
    if (!tenantId) {
      errors.push({
        rowNo,
        columnAliases: [...TENANT_PLATFORM_ID_ALIASES],
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
      columnAliases: [...TENANT_PLATFORM_ID_ALIASES],
      message: '客户消费明细无有效数据行',
    })
  }
  return { parsed, errors }
}

function isBaremetalPayStatusPaid(payStatus: string): boolean {
  const s = payStatus.trim()
  if (!s) return true
  if (s.includes('已支付')) return true
  if (s.toLowerCase() === 'paid') return true
  return false
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
    if (isBaremetalOrderTotalRow(row)) continue
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id'])
    const orderId = pickColumn(row, ['订单ID', 'order_id'])
    const payStatus = pickColumn(row, ['支付状态', 'pay_status']) ?? ''
    const finalAmount = parseMoneyCell(pickColumn(row, ['最终总额', 'final_amount']))
    const orderedAtCell = pickCellRaw(row, ['下单时间', 'ordered_at'])
    const orderedAtRaw =
      orderedAtCell == null
        ? null
        : typeof orderedAtCell === 'number'
          ? String(orderedAtCell)
          : String(orderedAtCell).trim()
    const orderedAt = parseImportDateTime(orderedAtCell)
    if (!tenantId || !orderId) {
      errors.push({
        rowNo,
        columnAliases: tenantId ? ['订单ID', 'order_id'] : ['租户ID', 'tenant_id'],
        message: tenantId ? '缺少订单ID' : '缺少租户ID',
      })
      continue
    }
    if (!orderedAt) {
      errors.push({
        rowNo,
        columnAliases: ['下单时间', 'ordered_at'],
        message: orderedAtRaw
          ? `下单时间「${orderedAtRaw}」无法解析，支持如 5/31/26（2026-05-31）、5/31/2026、YYYY-MM-DD 等`
          : '缺少下单时间',
      })
      continue
    }
    if (!isBaremetalPayStatusPaid(payStatus)) {
      errors.push({
        rowNo,
        columnAliases: ['支付状态', 'pay_status'],
        message: `支付状态「${payStatus}」无效，仅统计已支付（或留空视为已支付）`,
      })
      continue
    }
    if (orderedAt < start || orderedAt > end) {
      errors.push({
        rowNo,
        columnAliases: ['下单时间', 'ordered_at'],
        message: `下单时间不在账期内（须为 ${periodStart} 00:00:00 ~ ${periodEnd} 23:59:59，东八区）；当前值：${orderedAtRaw ?? ''}`,
      })
      continue
    }

    const idcName = pickColumn(row, ['机房名称', 'idc_name'])
    const deviceModel = pickColumn(row, ['设备型号', 'device_model'])
    const purchaseQtyText = pickColumn(row, ['购买数量', 'purchase_qty'])

    if (!idcName?.trim()) {
      errors.push({
        rowNo,
        columnAliases: ['机房名称', 'idc_name'],
        message: '缺少机房名称',
      })
      continue
    }
    const parsedDevice = parseDeviceModel(deviceModel)
    if (!parsedDevice) {
      errors.push({
        rowNo,
        columnAliases: ['设备型号', 'device_model'],
        message: '设备型号格式无效，应为「卡型code x 卡数量」（如 4090 x 8）',
      })
      continue
    }
    const parsedPurchase = parsePurchaseQty(purchaseQtyText)
    if (!parsedPurchase) {
      errors.push({
        rowNo,
        columnAliases: ['购买数量', 'purchase_qty'],
        message:
          '购买数量格式无效，应为「数量 x 时长包」（小时/24小时/7天/30天时长包）',
      })
      continue
    }

    parsed.push({
      rowNo,
      orderId,
      orderNo: pickColumn(row, ['订单编号', 'order_no']),
      tenantPlatformId: tenantId,
      idcName,
      deviceModel,
      payStatus: payStatus || '已支付',
      deviceStatus: pickColumn(row, ['设备状态', 'device_status']),
      purchaseQtyText,
      deviceQty: parsedDevice.cardCount,
      orderAmount: parseMoneyCell(pickColumn(row, ['订单金额', 'order_amount'])),
      refundAmount: parseMoneyCell(pickColumn(row, ['退款金额', 'refund_amount'])),
      finalAmount,
      orderedAt,
      rawJson: row,
    })
  }
  if (parsed.length === 0 && errors.length === 0) {
    const dataRows = sheet.rows.filter(({ row }) => !isBaremetalOrderTotalRow(row))
    if (dataRows.length === 0) {
      errors.push({
        rowNo: sheet.rows[0]?.rowNo ?? 2,
        columnAliases: ['订单ID', 'order_id'],
        message: '未找到有效数据行（表内无明细行，或均为总计/合计行）',
      })
    } else {
      for (const { rowNo } of dataRows) {
        errors.push({
          rowNo,
          columnAliases: ['订单ID', 'order_id'],
          message:
            '该行未纳入统计：请检查租户ID、订单ID、支付状态、下单时间是否在账期内、机房名称、设备型号、购买数量',
        })
      }
    }
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
    if (isTenantBillTotalRow(row)) continue
    const tenantId = pickColumn(row, ['租户ID', 'tenant_id'])
    if (!tenantId) continue
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
  const windows = await listTenantBillWindows(periodId)
  const hasCustomer = batches.some(
    (b) => b.fileType === 'customer_consumption' && b.parseStatus === 'ok',
  )
  const hasBaremetal = batches.some(
    (b) => b.fileType === 'baremetal_order' && b.parseStatus === 'ok',
  )
  const tenantBillOk =
    windows.length > 0 &&
    windows.every((w) =>
      batches.some(
        (b) =>
          b.fileType === 'tenant_bill' &&
          b.windowId === w.id &&
          b.parseStatus === 'ok',
      ),
    )

  const allOk = hasCustomer && hasBaremetal && tenantBillOk

  let status = 'draft'
  if (allOk) {
    const cross = await validateCrossFileImports(periodId)
    if (cross.ok) {
      status = 'imported'
    } else {
      status = 'import_error'
      for (const [fileType, errs] of Object.entries(cross.errorsByFileType)) {
        const matchingBatches = batches.filter((b) => b.fileType === fileType)
        for (const batch of matchingBatches) {
          if (errs?.length) {
            await persistBatchErrorReport({ batchId: batch.id, errors: errs })
          }
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
  windowId?: string
}): Promise<ImportFileResult> {
  const errorBuffer = buildMarkedErrorWorkbookBuffer({
    sheet: input.sheet,
    errors: input.errors,
    /** 仅导出含错误的行，并在「错误说明」列逐条标注 */
    includeAllRows: false,
  })
  const { saveImportErrorReport } = await importStorageLocal()
  const errorReportPath = await saveImportErrorReport({
    billingPeriodId: input.billingPeriodId,
    fileType: input.fileType,
    batchId: input.batchId,
    buffer: errorBuffer,
  })

  await db.insert(billingPeriodImportBatch).values({
    id: input.batchId,
    billingPeriodId: input.billingPeriodId,
    windowId: input.windowId ?? null,
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

  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, input.billingPeriodId),
  })
  const periodStatus = isPersonalImportFileType(input.fileType)
    ? (period?.status ?? 'draft')
    : await syncPeriodImportStatus(input.billingPeriodId)
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
  windowId?: string
  /** 成本 Tab 重新生成上传：不清理收入派生 */
  preserveIncomeDerived?: boolean
}): Promise<ImportFileResult> {
  const period = await getPeriodOrThrow(input.billingPeriodId)
  financeLog('import', `start ${input.fileType}`, {
    periodId: input.billingPeriodId,
    fileName: input.fileName,
    windowId: input.windowId,
  })

  if (input.fileType === 'tenant_bill') {
    if (!input.windowId) {
      throw new FinanceError('BAD_REQUEST', '上传客户账单详情须指定时间段 windowId')
    }
    const windows = await listTenantBillWindows(input.billingPeriodId)
    if (!windows.some((w) => w.id === input.windowId)) {
      throw new FinanceError('BAD_REQUEST', '无效的客户账单时间段')
    }
  }

  if (isPersonalImportFileType(input.fileType)) {
    await purgePersonalIncomeArtifacts({
      billingPeriodId: input.billingPeriodId,
      fileType: input.fileType,
      actorId: input.actorId,
    })
  } else {
    await purgeBillingPeriodArtifacts({
      billingPeriodId: input.billingPeriodId,
      scope: 'file_type',
      fileType: input.fileType,
      windowId: input.windowId,
      actorId: input.actorId,
      preserveIncomeDerived: input.preserveIncomeDerived,
    })
  }

  const sheet = parseWorkbookDetailed(input.buffer, input.fileName)
  const batchId = newId()
  const fileSha256 = sha256Hex(input.buffer)
  const { saveImportSourceFile } = await importStorageLocal()
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
            windowId: input.windowId ?? null,
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
    } else if (
      input.fileType === 'baremetal_order' ||
      input.fileType === 'personal_baremetal_order'
    ) {
      const { parsed, errors } = mapBaremetalRows(sheet, period.periodStart, period.periodEnd)
      parseErrors = errors
      if (errors.length === 0) {
        rowCount = parsed.length
        await db.transaction(async (tx) => {
          await tx.insert(billingPeriodImportBatch).values({
            id: batchId,
            billingPeriodId: input.billingPeriodId,
            windowId: input.windowId ?? null,
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
    } else if (
      input.fileType === 'tenant_bill' ||
      input.fileType === 'personal_tenant_bill'
    ) {
      const { parsed, errors, tenantPlatformIds } = mapTenantBillRows(sheet)
      parseErrors = errors
      if (errors.length === 0) {
        rowCount = parsed.length
        await db.transaction(async (tx) => {
          await tx.insert(billingPeriodImportBatch).values({
            id: batchId,
            billingPeriodId: input.billingPeriodId,
            windowId: input.windowId ?? null,
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
        if (input.fileType === 'tenant_bill') {
          tenantPlatformIdsForEnrichment = tenantPlatformIds
        }
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
        windowId: input.windowId,
      })
    }

    if (input.fileType === 'tenant_bill' && tenantPlatformIdsForEnrichment.length > 0) {
      await resolveAndPersistEnrichment(
        input.billingPeriodId,
        tenantPlatformIdsForEnrichment,
        period.periodEnd,
      )
    }

    let periodStatus: string
    let allParsed: boolean

    if (isPersonalImportFileType(input.fileType)) {
      allParsed = await isPersonalImportReady(input.billingPeriodId)
      periodStatus = period.status
    } else {
      periodStatus = await syncPeriodImportStatus(input.billingPeriodId)
      const slotStatuses = await getImportSlotStatuses(input.billingPeriodId)
      allParsed =
        Boolean(slotStatuses.customer?.parseStatus === 'ok') &&
        Boolean(slotStatuses.baremetal?.parseStatus === 'ok') &&
        slotStatuses.tenantBillWindows.length > 0 &&
        slotStatuses.tenantBillWindows.every((w) => w.parseStatus === 'ok') &&
        periodStatus === 'imported'
    }

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
    const { deleteStorageFile } = await importStorageLocal()
    await deleteStorageFile(storagePath)
    financeError('import', 'failed', e, { periodId: input.billingPeriodId })
    throw e
  }
}
