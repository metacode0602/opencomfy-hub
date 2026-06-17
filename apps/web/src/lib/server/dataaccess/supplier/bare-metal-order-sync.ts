import {
  parsePlatformDateTime,
  platformMetalOrderListAmountToMoneyString,
} from '@/lib/crm/tenant-billing-import-utils'
import { db } from '@/lib/db'
import {
  fetchPlatformMetalOrderDevice,
  type PlatformMetalOrderRecord,
} from '@/lib/server/integrations/suanli-billing-api'
import { crmWarn } from '@/lib/server/dataaccess/crm/logger'
import {
  loadCostMasterDataContext,
  resolveDataCenterByName,
  resolveGpuCardType,
} from '@/lib/server/dataaccess/finance/cost-master-data'
import {
  bareMetalOrder,
  bareMetalOrderDevice,
  billingTenant,
  dataCenter,
  supplier,
} from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function toMoney(n: number): string {
  return n.toFixed(4)
}

function parsePlatformDate(raw: string | undefined): Date {
  if (!raw?.trim()) return new Date()
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function mapPlatformBillingUnit(raw: string | undefined): string {
  const v = (raw ?? '').toLowerCase()
  if (v.includes('day')) return 'day'
  if (v.includes('week')) return 'week'
  if (v.includes('month')) return 'month'
  return 'hour'
}

export function mapPlatformOrderStatus(raw: string | undefined): string {
  const v = (raw ?? '').toLowerCase()
  if (v.includes('finish') || v.includes('complete')) return 'completed'
  if (v.includes('cancel')) return 'cancelled'
  if (v.includes('refund')) return 'refunded'
  if (v.includes('active') || v.includes('running')) return 'active'
  if (v.includes('process') || v.includes('provision')) return 'provisioning'
  if (v.includes('paid')) return 'paid'
  if (v.includes('pending')) return 'pending'
  return 'paid'
}

type TenantRef = {
  tenantId: string
  platformTenantId: string
  customerId: string | null
}

type DeviceLine = {
  deviceModelText: string | null
  gpuCount: number
  gpuCardTypeId: string | null
  orderDetailsId: number | null
  totalPrice: number | null
  orderDetailStatus: string | null
}

export type EnrichPlatformBareMetalOrderDevicesResult = {
  enrichedCount: number
  failedCount: number
  skippedCount: number
}

async function loadTenantByPlatformId(platformTenantId: string): Promise<TenantRef | null> {
  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      customerId: billingTenant.customerId,
    })
    .from(billingTenant)
    .where(eq(billingTenant.platformTenantId, platformTenantId))
    .limit(1)
  const row = rows[0]
  if (!row?.platformTenantId) return null
  return {
    tenantId: row.tenantId,
    platformTenantId: row.platformTenantId,
    customerId: row.customerId,
  }
}

function buildDeviceLines(record: PlatformMetalOrderRecord): DeviceLine[] {
  const models = record.gpu_models ?? []
  if (models.length > 0) {
    return models.map((model) => {
      const text = model.gpu_model != null ? String(model.gpu_model) : null
      const gpuPerUnit = Number(model.gpu_count ?? 1) || 1
      return {
        deviceModelText: text,
        gpuCount: gpuPerUnit,
        gpuCardTypeId: null,
        orderDetailsId: model.order_details_id ?? null,
        totalPrice: model.total_price ?? null,
        orderDetailStatus: model.order_detail_status ?? null,
      }
    })
  }

  const deviceCount = Math.max(1, record.device_count ?? 1)
  return Array.from({ length: deviceCount }, () => ({
    deviceModelText: null,
    gpuCount: 1,
    gpuCardTypeId: null,
    orderDetailsId: null,
    totalPrice: null,
    orderDetailStatus: null,
  }))
}

function resolveLineAmount(
  line: DeviceLine,
  record: PlatformMetalOrderRecord,
  lineCount: number,
): string | null {
  if (line.totalPrice != null && Number.isFinite(line.totalPrice)) {
    return platformMetalOrderListAmountToMoneyString(line.totalPrice)
  }
  if (lineCount === 1) {
    return platformMetalOrderListAmountToMoneyString(record.total_price)
  }
  return null
}

function computeDurationHours(rentStartsAt: Date | null, rentEndsAt: Date | null): string | null {
  if (!rentStartsAt || !rentEndsAt) return null
  const hours = (rentEndsAt.getTime() - rentStartsAt.getTime()) / 3_600_000
  if (!Number.isFinite(hours) || hours <= 0) return null
  return toMoney(hours)
}

function computeUnitPricePerCardHour(
  lineAmount: string | null,
  durationHours: string | null,
  gpuCount: number,
): string | null {
  if (!lineAmount || !durationHours || gpuCount <= 0) return null
  const amountNum = Number(lineAmount)
  const hoursNum = Number(durationHours)
  const denom = hoursNum * gpuCount
  if (!Number.isFinite(amountNum) || !Number.isFinite(hoursNum) || denom <= 0) return null
  return toMoney(amountNum / denom)
}

export async function enrichPlatformBareMetalOrderDevices(input: {
  orderId: string
  record: PlatformMetalOrderRecord
  deviceLines: DeviceLine[]
  traceId?: string
}): Promise<EnrichPlatformBareMetalOrderDevicesResult> {
  let enrichedCount = 0
  let failedCount = 0
  let skippedCount = 0
  let partialFailure = false
  const rentStarts: Date[] = []
  const rentEnds: Date[] = []

  for (let index = 0; index < input.deviceLines.length; index++) {
    const line = input.deviceLines[index]!
    const lineNo = index + 1

    if (line.orderDetailsId == null) {
      skippedCount++
      continue
    }

    try {
      const deviceData = await fetchPlatformMetalOrderDevice({
        orderDetailId: line.orderDetailsId,
        traceId: input.traceId,
      })

      const rentStartsAt = deviceData.start_time
        ? parsePlatformDateTime(deviceData.start_time)
        : null
      const rentEndsAt = deviceData.end_time ? parsePlatformDateTime(deviceData.end_time) : null
      const durationHours = computeDurationHours(rentStartsAt, rentEndsAt)
      const lineAmount = resolveLineAmount(line, input.record, input.deviceLines.length)
      const gpuCount = deviceData.gpu_count ?? line.gpuCount
      const unitPricePerCardHour = computeUnitPricePerCardHour(lineAmount, durationHours, gpuCount)

      const deviceMatchFlags: Record<string, unknown> = {}
      if (deviceData.gpu_count != null && deviceData.gpu_count !== line.gpuCount) {
        deviceMatchFlags.gpu_count_mismatch = true
      }

      await db
        .update(bareMetalOrderDevice)
        .set({
          platformDeviceId: String(deviceData.order_details_id ?? line.orderDetailsId),
          rentStartsAt,
          rentEndsAt,
          durationHours,
          lineAmount,
          unitPricePerCardHour,
          externalIp: deviceData.pub_ip ?? null,
          internalIp: deviceData.inner_ip ?? null,
          gpuCount,
          deviceModelText: line.deviceModelText ?? deviceData.gpu_model ?? null,
          deviceStatus: line.orderDetailStatus ?? null,
          platformPayload: {
            order_details_id: line.orderDetailsId,
            ...deviceData,
          },
          matchFlags: deviceMatchFlags,
        })
        .where(
          and(
            eq(bareMetalOrderDevice.bareMetalOrderId, input.orderId),
            eq(bareMetalOrderDevice.lineNo, lineNo),
          ),
        )

      if (rentStartsAt) rentStarts.push(rentStartsAt)
      if (rentEndsAt) rentEnds.push(rentEndsAt)
      enrichedCount++
    } catch (e) {
      failedCount++
      partialFailure = true
      crmWarn('bare-metal-order-sync', 'device enrich failed', {
        traceId: input.traceId,
        orderId: input.orderId,
        lineNo,
        orderDetailsId: line.orderDetailsId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  if (rentStarts.length > 0 || rentEnds.length > 0 || partialFailure) {
    const headUpdate: {
      rentStartsAt?: Date
      rentEndsAt?: Date
      matchFlags?: Record<string, unknown>
    } = {}

    if (rentStarts.length > 0) {
      headUpdate.rentStartsAt = new Date(Math.min(...rentStarts.map((d) => d.getTime())))
    }
    if (rentEnds.length > 0) {
      headUpdate.rentEndsAt = new Date(Math.max(...rentEnds.map((d) => d.getTime())))
    }

    if (partialFailure) {
      const [head] = await db
        .select({ matchFlags: bareMetalOrder.matchFlags })
        .from(bareMetalOrder)
        .where(eq(bareMetalOrder.id, input.orderId))
        .limit(1)
      headUpdate.matchFlags = {
        ...((head?.matchFlags ?? {}) as Record<string, unknown>),
        device_enrich_partial: true,
      }
    }

    await db.update(bareMetalOrder).set(headUpdate).where(eq(bareMetalOrder.id, input.orderId))
  }

  return { enrichedCount, failedCount, skippedCount }
}

export async function upsertPlatformBareMetalOrder(input: {
  record: PlatformMetalOrderRecord
  tenant: TenantRef
  traceId?: string
}): Promise<{ orderId: string; created: boolean }> {
  const { record, tenant } = input
  const master = await loadCostMasterDataContext()
  const platformOrderId = String(record.order_id)
  const orderedAt = parsePlatformDate(record.create_time)
  const dc = record.idc_name ? resolveDataCenterByName(master, record.idc_name) : null

  let supplierId: string | null = null
  if (dc) {
    const sup = await db
      .select({ id: supplier.id })
      .from(dataCenter)
      .innerJoin(supplier, eq(supplier.id, dataCenter.supplierId))
      .where(eq(dataCenter.id, dc.id))
      .limit(1)
    supplierId = sup[0]?.id ?? null
  }

  const deviceLines = buildDeviceLines(record)
  const gpuCount = deviceLines.reduce((s, l) => s + l.gpuCount, 0)
  const matchFlags: Record<string, unknown> = {}
  if (record.idc_name && !dc) matchFlags.idc_unmatched = true

  const headValues = {
    platformOrderId,
    orderNo: record.order_no,
    orderMark: 'online' as const,
    tenantId: tenant.tenantId,
    platformTenantId: tenant.platformTenantId,
    customerId: tenant.customerId,
    projectId: null,
    dataCenterId: dc?.id ?? null,
    supplierId,
    idcCode: dc?.code ?? null,
    idcName: record.idc_name ?? null,
    status: mapPlatformOrderStatus(record.status),
    payStatus: 'paid' as const,
    billingUnit: mapPlatformBillingUnit(record.billing_type),
    purchaseQty: record.buy_count ?? null,
    purchaseQtyText: null,
    deviceCount: deviceLines.length,
    gpuCount,
    orderAmount: platformMetalOrderListAmountToMoneyString(record.total_price),
    refundAmount: '0',
    finalAmount: platformMetalOrderListAmountToMoneyString(record.total_price),
    orderedAt,
    paidAt: orderedAt,
    source: 'platform_sync' as const,
    platformPayload: record as unknown as Record<string, unknown>,
    matchFlags,
  }

  const existing = await db
    .select({ id: bareMetalOrder.id, orderMark: bareMetalOrder.orderMark })
    .from(bareMetalOrder)
    .where(eq(bareMetalOrder.platformOrderId, platformOrderId))
    .limit(1)

  let orderId: string
  let created = false

  if (existing[0]) {
    if (existing[0].orderMark === 'offline') {
      return { orderId: existing[0].id, created: false }
    }
    orderId = existing[0].id
    await db.update(bareMetalOrder).set(headValues).where(eq(bareMetalOrder.id, orderId))
    await db.delete(bareMetalOrderDevice).where(eq(bareMetalOrderDevice.bareMetalOrderId, orderId))
  } else {
    orderId = newId('bmord')
    created = true
    await db.insert(bareMetalOrder).values({ id: orderId, ...headValues })
  }

  const deviceRows = deviceLines.map((line, index) => {
    const card =
      line.deviceModelText != null
        ? resolveGpuCardType(master, line.deviceModelText.split(/\s+/)[0] ?? line.deviceModelText)
        : null
    return {
      id: newId('bmord-dev'),
      bareMetalOrderId: orderId,
      lineNo: index + 1,
      allocationStatus: 'planned' as const,
      gpuCardTypeId: card?.id ?? line.gpuCardTypeId,
      deviceModelText: line.deviceModelText,
      gpuCount: line.gpuCount,
      platformPayload:
        line.orderDetailsId != null ? { order_details_id: line.orderDetailsId } : {},
    }
  })

  if (deviceRows.length > 0) {
    await db.insert(bareMetalOrderDevice).values(deviceRows)
  }

  await enrichPlatformBareMetalOrderDevices({
    orderId,
    record,
    deviceLines,
    traceId: input.traceId,
  })

  return { orderId, created }
}

export async function resolveTenantForPlatformOrder(
  platformTenantId: string,
): Promise<TenantRef | null> {
  return loadTenantByPlatformId(platformTenantId)
}

export { toMoney, newId as newBareMetalId }
