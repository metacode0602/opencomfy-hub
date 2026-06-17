import { db } from '@/lib/db'
import type { PlatformBillingUnit } from '@/lib/types/platform-pricing'
import {
  bareMetalOrder,
  bareMetalOrderDevice,
  billingPeriod,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  dataCenter,
  gpuCardType,
} from '@workspace/db/schema'
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import {
  derivePurchaseQtyFromDurationHours,
  formatPurchaseQtyFromHead,
  isBaremetalPayStatusPaid,
  parseDeviceModel,
  parsePurchaseQty,
} from './baremetal-order-parse'
import { FinanceError } from './errors'
import { sha256Hex } from './excel-parser'
import { financeLog } from './logger'
import { newId } from './operation-log'

const PREVIEW_LIMIT = 50

export type BaremetalDbImportIssue = {
  orderId: string
  orderNo: string | null
  level: 'error' | 'warning'
  code: string
  message: string
}

export type BaremetalDbImportPreviewRow = {
  orderId: string
  tenantPlatformId: string
  idcName: string
  deviceModel: string
  purchaseQtyText: string
  deviceQty: number
  finalAmount: string
  orderedAt: string
  sourceOrderMark: 'online' | 'offline'
}

export type BaremetalDbImportPreviewResult = {
  totalCandidates: number
  validRows: number
  skippedPaidFilter: number
  issues: BaremetalDbImportIssue[]
  preview: BaremetalDbImportPreviewRow[]
}

type OrderHead = typeof bareMetalOrder.$inferSelect & {
  dataCenterName: string | null
}

type DeviceRow = typeof bareMetalOrderDevice.$inferSelect & {
  gpuCardTypeCode: string | null
}

type MappedRawRow = Omit<
  typeof billingPeriodRawBaremetalOrder.$inferInsert,
  'id' | 'batchId'
>

function periodBounds(periodStart: string, periodEnd: string) {
  return {
    start: new Date(`${periodStart}T00:00:00+08:00`),
    end: new Date(`${periodEnd}T23:59:59+08:00`),
  }
}

function parseMoney(value: string | null | undefined): number {
  if (value == null || value === '') return 0
  const n = Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : 0
}

function resolveRawOrderId(order: OrderHead): string {
  if (order.platformOrderId?.trim()) return order.platformOrderId.trim()
  return `offline:${order.id}`
}

function resolveIdcName(order: OrderHead): string | null {
  const fromHead = order.idcName?.trim()
  if (fromHead) return fromHead
  const fromDc = order.dataCenterName?.trim()
  if (fromDc) return fromDc
  return null
}

function resolveDeviceCardCode(device: DeviceRow): string | null {
  const code = device.gpuCardTypeCode?.trim()
  if (code) return code
  const text = device.deviceModelText?.trim()
  return text || null
}

function formatDeviceModel(cardCode: string, gpuCount: number): string {
  return `${cardCode} x ${gpuCount}`
}

function resolvePurchaseQtyText(
  order: OrderHead,
  groupDevices: DeviceRow[],
  deviceQty: number,
  isSplitGroup: boolean,
): string | null {
  if (!isSplitGroup) {
    const headText = order.purchaseQtyText?.trim()
    if (headText && parsePurchaseQty(headText)) return headText

    const billingUnit = order.billingUnit as PlatformBillingUnit
    const purchaseQty = order.purchaseQty
    if (
      purchaseQty != null &&
      purchaseQty > 0 &&
      ['hour', 'day', 'week', 'month'].includes(billingUnit)
    ) {
      const formatted = formatPurchaseQtyFromHead(purchaseQty, billingUnit)
      if (parsePurchaseQty(formatted)) return formatted
    }
  }

  const durations = groupDevices
    .map((d) => parseMoney(d.durationHours))
    .filter((h) => h > 0)
  if (durations.length === 0) return null

  const unique = [...new Set(durations.map((h) => h.toFixed(4)))]
  if (unique.length === 1) {
    const hours = Number.parseFloat(unique[0]!)
    const perDevice = derivePurchaseQtyFromDurationHours(hours)
    if (perDevice && parsePurchaseQty(perDevice)) return perDevice
  }

  if (deviceQty === 1 && durations.length === 1) {
    const perDevice = derivePurchaseQtyFromDurationHours(durations[0]!)
    if (perDevice && parsePurchaseQty(perDevice)) return perDevice
  }

  const allSame = groupDevices.every(
    (d) => parseMoney(d.durationHours) === parseMoney(groupDevices[0]!.durationHours),
  )
  if (allSame && groupDevices.length > 1) {
    const hours = parseMoney(groupDevices[0]!.durationHours)
    const perDevice = derivePurchaseQtyFromDurationHours(hours)
    if (perDevice && parsePurchaseQty(perDevice)) return perDevice
  }

  return null
}

function groupDevices(devices: DeviceRow[]): Map<string, DeviceRow[]> {
  const groups = new Map<string, DeviceRow[]>()
  for (const device of devices) {
    const cardCode = resolveDeviceCardCode(device)
    if (!cardCode || device.gpuCount <= 0) continue
    const key = `${cardCode}::${device.gpuCount}`
    const list = groups.get(key) ?? []
    list.push(device)
    groups.set(key, list)
  }
  return groups
}

function allocateFinalAmount(
  order: OrderHead,
  groupDevices: DeviceRow[],
  allDevices: DeviceRow[],
): string {
  const lineSum = groupDevices.reduce((sum, d) => sum + parseMoney(d.lineAmount), 0)
  if (lineSum > 0) return lineSum.toFixed(4)

  const groupWeight = groupDevices.reduce(
    (sum, d) => sum + parseMoney(d.durationHours) * d.gpuCount,
    0,
  )
  const totalWeight = allDevices.reduce(
    (sum, d) => sum + parseMoney(d.durationHours) * d.gpuCount,
    0,
  )
  const orderFinal = parseMoney(order.finalAmount)
  if (totalWeight > 0 && orderFinal > 0) {
    return ((orderFinal * groupWeight) / totalWeight).toFixed(4)
  }
  return order.finalAmount
}

function mapOrderToRawRows(input: {
  order: OrderHead
  devices: DeviceRow[]
  rowNoStart: number
  issues: BaremetalDbImportIssue[]
}): { rows: MappedRawRow[]; nextRowNo: number } {
  const { order, devices, issues } = input
  let rowNo = input.rowNoStart
  const rows: MappedRawRow[] = []
  const baseOrderId = resolveRawOrderId(order)
  const orderNo = order.orderNo
  const issueOrderId = baseOrderId

  if (!order.platformTenantId?.trim()) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'error',
      code: 'MISSING_TENANT',
      message: `订单 ${orderNo ?? issueOrderId} 缺少平台租户 ID`,
    })
    return { rows, nextRowNo: rowNo }
  }

  const idcName = resolveIdcName(order)
  if (!idcName) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'error',
      code: 'MISSING_IDC',
      message: `订单 ${orderNo ?? issueOrderId} 缺少机房名称`,
    })
    return { rows, nextRowNo: rowNo }
  }

  if (!order.dataCenterId && !order.idcName?.trim() && order.dataCenterName) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'warning',
      code: 'IDC_FROM_DATACENTER',
      message: `订单 ${orderNo ?? issueOrderId} 未关联机房主数据，使用 data_center 名称「${order.dataCenterName}」`,
    })
  }

  if (!order.platformOrderId?.trim()) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'warning',
      code: 'OFFLINE_ORDER_ID',
      message: `订单 ${orderNo ?? order.id} 无平台订单 ID，Raw 使用 ${baseOrderId}`,
    })
  }

  const deviceQtyHead = order.deviceCount
  if (deviceQtyHead <= 0) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'error',
      code: 'INVALID_DEVICE_QTY',
      message: `订单 ${orderNo ?? issueOrderId} 设备数量无效`,
    })
    return { rows, nextRowNo: rowNo }
  }

  const finalAmountNum = parseMoney(order.finalAmount)
  if (finalAmountNum < 0) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'error',
      code: 'INVALID_FINAL_AMOUNT',
      message: `订单 ${orderNo ?? issueOrderId} 最终总额无效`,
    })
    return { rows, nextRowNo: rowNo }
  }

  if (devices.length === 0) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'error',
      code: 'NO_DEVICES',
      message: `订单 ${orderNo ?? issueOrderId} 无设备明细`,
    })
    return { rows, nextRowNo: rowNo }
  }

  const invalidDevices = devices.filter(
    (d) => !resolveDeviceCardCode(d) || d.gpuCount <= 0,
  )
  if (invalidDevices.length > 0) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'error',
      code: 'INVALID_DEVICE_MODEL',
      message: `订单 ${orderNo ?? issueOrderId} 存在无法解析卡型的明细行`,
    })
    return { rows, nextRowNo: rowNo }
  }

  const groups = groupDevices(devices)
  if (groups.size === 0) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'error',
      code: 'INVALID_DEVICE_MODEL',
      message: `订单 ${orderNo ?? issueOrderId} 无法组成设备型号`,
    })
    return { rows, nextRowNo: rowNo }
  }

  if (groups.size > 1) {
    issues.push({
      orderId: issueOrderId,
      orderNo,
      level: 'warning',
      code: 'HETEROGENEOUS_SPLIT',
      message: `订单 ${orderNo ?? issueOrderId} 含 ${groups.size} 种设备规格，已拆分为多行 Raw`,
    })
  }

  let groupIndex = 0
  for (const [groupKey, groupDevices] of groups) {
    groupIndex += 1
    const [cardCode, gpuCountStr] = groupKey.split('::')
    const gpuCount = Number.parseInt(gpuCountStr!, 10)
    const deviceModel = formatDeviceModel(cardCode!, gpuCount)
    if (!parseDeviceModel(deviceModel)) {
      issues.push({
        orderId: issueOrderId,
        orderNo,
        level: 'error',
        code: 'INVALID_DEVICE_MODEL',
        message: `订单 ${orderNo ?? issueOrderId} 设备型号「${deviceModel}」无效`,
      })
      continue
    }

    const deviceQty = groups.size === 1 ? deviceQtyHead : groupDevices.length
    const purchaseQtyText = resolvePurchaseQtyText(
      order,
      groupDevices,
      deviceQty,
      groups.size > 1,
    )
    if (!purchaseQtyText || !parsePurchaseQty(purchaseQtyText)) {
      issues.push({
        orderId: issueOrderId,
        orderNo,
        level: 'error',
        code: 'MISSING_PURCHASE_QTY',
        message: `订单 ${orderNo ?? issueOrderId} 无法推导购买数量，请维护 purchase_qty_text 或明细时长`,
      })
      continue
    }

    const rawOrderId =
      groups.size === 1 ? baseOrderId : `${baseOrderId}#G${groupIndex}`
    const finalAmount =
      groups.size === 1 ? order.finalAmount : allocateFinalAmount(order, groupDevices, devices)

    rows.push({
      rowNo: rowNo++,
      orderId: rawOrderId,
      orderNo,
      tenantPlatformId: order.platformTenantId,
      idcName,
      deviceModel,
      payStatus: order.payStatus || '已支付',
      deviceStatus: order.status,
      purchaseQtyText,
      deviceQty,
      orderAmount: order.orderAmount,
      refundAmount: order.refundAmount ?? '0',
      finalAmount,
      orderedAt: order.orderedAt,
      rawJson: {
        source: 'db',
        bare_metal_order_id: order.id,
        source_order_mark: order.orderMark,
        device_line_ids: groupDevices.map((d) => d.id),
        ...(groups.size > 1
          ? { split_reason: 'heterogeneous_devices', group_key: groupKey }
          : {}),
      },
    })
  }

  return { rows, nextRowNo: rowNo }
}

async function loadOrdersInPeriod(periodStart: string, periodEnd: string) {
  const { start, end } = periodBounds(periodStart, periodEnd)
  return db
    .select({
      order: bareMetalOrder,
      dataCenterName: dataCenter.name,
    })
    .from(bareMetalOrder)
    .leftJoin(dataCenter, eq(dataCenter.id, bareMetalOrder.dataCenterId))
    .where(and(gte(bareMetalOrder.orderedAt, start), lte(bareMetalOrder.orderedAt, end)))
    .orderBy(asc(bareMetalOrder.orderedAt), asc(bareMetalOrder.id))
}

async function loadDevicesByOrderIds(orderIds: string[]): Promise<Map<string, DeviceRow[]>> {
  if (orderIds.length === 0) return new Map()

  const deviceRows = await db
    .select({
      device: bareMetalOrderDevice,
      gpuCardTypeCode: gpuCardType.code,
    })
    .from(bareMetalOrderDevice)
    .leftJoin(gpuCardType, eq(gpuCardType.id, bareMetalOrderDevice.gpuCardTypeId))
    .where(inArray(bareMetalOrderDevice.bareMetalOrderId, orderIds))
    .orderBy(bareMetalOrderDevice.bareMetalOrderId, bareMetalOrderDevice.lineNo)

  const map = new Map<string, DeviceRow[]>()
  for (const { device, gpuCardTypeCode } of deviceRows) {
    const list = map.get(device.bareMetalOrderId) ?? []
    list.push({ ...device, gpuCardTypeCode })
    map.set(device.bareMetalOrderId, list)
  }
  return map
}

export async function buildBaremetalDbImportPreview(input: {
  periodStart: string
  periodEnd: string
}): Promise<{
  rows: MappedRawRow[]
  issues: BaremetalDbImportIssue[]
  totalCandidates: number
  skippedPaidFilter: number
}> {
  const orderRows = await loadOrdersInPeriod(input.periodStart, input.periodEnd)
  const totalCandidates = orderRows.length
  let skippedPaidFilter = 0

  const paidOrders: OrderHead[] = []
  for (const { order, dataCenterName } of orderRows) {
    if (!isBaremetalPayStatusPaid(order.payStatus)) {
      skippedPaidFilter += 1
      continue
    }
    paidOrders.push({ ...order, dataCenterName })
  }

  const devicesByOrder = await loadDevicesByOrderIds(paidOrders.map((o) => o.id))
  const issues: BaremetalDbImportIssue[] = []
  const rows: MappedRawRow[] = []
  let rowNo = 1

  for (const order of paidOrders) {
    const devices = devicesByOrder.get(order.id) ?? []
    const mapped = mapOrderToRawRows({
      order,
      devices,
      rowNoStart: rowNo,
      issues,
    })
    rows.push(...mapped.rows)
    rowNo = mapped.nextRowNo
  }

  return { rows, issues, totalCandidates, skippedPaidFilter }
}

export async function previewBaremetalFromDb(input: {
  billingPeriodId: string
}): Promise<BaremetalDbImportPreviewResult> {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, input.billingPeriodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')

  const { rows, issues, totalCandidates, skippedPaidFilter } =
    await buildBaremetalDbImportPreview({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    })

  const errorCount = issues.filter((i) => i.level === 'error').length
  const preview: BaremetalDbImportPreviewRow[] = rows.slice(0, PREVIEW_LIMIT).map((r) => {
    const mark = (r.rawJson as { source_order_mark?: string }).source_order_mark
    return {
      orderId: r.orderId,
      tenantPlatformId: r.tenantPlatformId,
      idcName: r.idcName ?? '',
      deviceModel: r.deviceModel ?? '',
      purchaseQtyText: r.purchaseQtyText ?? '',
      deviceQty: r.deviceQty ?? 0,
      finalAmount: r.finalAmount,
      orderedAt: r.orderedAt.toISOString(),
      sourceOrderMark: mark === 'offline' ? 'offline' : 'online',
    }
  })

  return {
    totalCandidates,
    validRows: errorCount > 0 ? 0 : rows.length,
    skippedPaidFilter,
    issues,
    preview,
  }
}

async function purgeBaremetalBatchForPeriod(
  periodId: string,
  preserveIncomeDerived: boolean,
  actorId?: string | null,
): Promise<void> {
  const { purgeBillingPeriodArtifacts } = await import('./purge')
  await purgeBillingPeriodArtifacts({
    billingPeriodId: periodId,
    scope: 'file_type',
    fileType: 'baremetal_order',
    actorId,
    preserveIncomeDerived,
  })
}

export async function importBaremetalFromDb(input: {
  billingPeriodId: string
  actorId?: string | null
  preserveIncomeDerived?: boolean
}): Promise<{ ok: boolean; message: string; rowCount: number; batchId: string }> {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, input.billingPeriodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  if (period.status === 'published') {
    throw new FinanceError('CONFLICT', '已发布账期须先撤回发布后再导入')
  }
  if (period.status === 'void') {
    throw new FinanceError('CONFLICT', '作废账期不可导入')
  }

  const { rows, issues, totalCandidates, skippedPaidFilter } =
    await buildBaremetalDbImportPreview({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    })

  const errors = issues.filter((i) => i.level === 'error')
  if (errors.length > 0) {
    const first = errors[0]!
    throw new FinanceError(
      'UNPROCESSABLE',
      `读库导入失败：${first.message}（共 ${errors.length} 条错误）`,
    )
  }

  if (rows.length === 0) {
    throw new FinanceError(
      'UNPROCESSABLE',
      totalCandidates === 0
        ? '账期内无裸金属订单'
        : skippedPaidFilter >= totalCandidates
          ? '账期内无已支付裸金属订单'
          : '无有效裸金属订单可导入',
    )
  }

  financeLog('import-baremetal-db', 'start', {
    periodId: input.billingPeriodId,
    rowCount: rows.length,
  })

  await purgeBaremetalBatchForPeriod(
    input.billingPeriodId,
    input.preserveIncomeDerived ?? true,
    input.actorId,
  )

  const batchId = newId()
  const contentHash = sha256Hex(
    Buffer.from(
      JSON.stringify({
        source: 'db:bare_metal_order',
        periodId: input.billingPeriodId,
        rows: rows.map((r) => r.orderId),
      }),
    ),
  )
  await db.transaction(async (tx) => {
    await tx.insert(billingPeriodImportBatch).values({
      id: batchId,
      billingPeriodId: input.billingPeriodId,
      windowId: null,
      fileType: 'baremetal_order',
      fileName: 'db:bare_metal_order',
      storagePath: '',
      fileSha256: contentHash,
      fileSizeBytes: 0,
      parseStatus: 'ok',
      parseErrorCount: 0,
      rowCount: rows.length,
      uploadedBy: input.actorId ?? null,
    })
    await tx.insert(billingPeriodRawBaremetalOrder).values(
      rows.map((r) => ({ ...r, id: newId(), batchId })),
    )
  })

  financeLog('import-baremetal-db', 'done', {
    periodId: input.billingPeriodId,
    batchId,
    rowCount: rows.length,
  })

  return {
    ok: true,
    message: `已从数据库导入 ${rows.length} 行裸金属订单`,
    rowCount: rows.length,
    batchId,
  }
}
