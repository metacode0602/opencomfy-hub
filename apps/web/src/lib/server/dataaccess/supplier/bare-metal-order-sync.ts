import {
  platformMetalOrderListAmountToMoneyString,
} from '@/lib/crm/tenant-billing-import-utils'
import { db } from '@/lib/db'
import type { PlatformMetalOrderRecord } from '@/lib/server/integrations/suanli-billing-api'
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
import { eq } from 'drizzle-orm'

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

function buildDeviceLines(record: PlatformMetalOrderRecord): Array<{
  deviceModelText: string | null
  gpuCount: number
  gpuCardTypeId: string | null
}> {
  const models = record.gpu_models ?? []
  if (models.length > 0) {
    return models.map((model) => {
      const text = model.gpu_model != null ? String(model.gpu_model) : null
      const gpuPerUnit = Number(model.gpu_count ?? 1) || 1
      return {
        deviceModelText: text,
        gpuCount: gpuPerUnit,
        gpuCardTypeId: null,
      }
    })
  }

  const deviceCount = Math.max(1, record.device_count ?? 1)
  return Array.from({ length: deviceCount }, () => ({
    deviceModelText: null,
    gpuCount: 1,
    gpuCardTypeId: null,
  }))
}

export async function upsertPlatformBareMetalOrder(input: {
  record: PlatformMetalOrderRecord
  tenant: TenantRef
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
      platformPayload: {},
    }
  })

  if (deviceRows.length > 0) {
    await db.insert(bareMetalOrderDevice).values(deviceRows)
  }

  return { orderId, created }
}

export async function resolveTenantForPlatformOrder(
  platformTenantId: string,
): Promise<TenantRef | null> {
  return loadTenantByPlatformId(platformTenantId)
}

export { toMoney, newId as newBareMetalId }
