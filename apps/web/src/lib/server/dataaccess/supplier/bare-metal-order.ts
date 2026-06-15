import { db } from '@/lib/db'
import type {
  BareMetalOrderDetailDto,
  BareMetalOrderDeviceDto,
  BareMetalOrderListItemDto,
} from '@/lib/types/bare-metal-order-api'
import {
  bareMetalOrder,
  bareMetalOrderDevice,
  billingTenant,
  crmProject,
  customer,
  dataCenter,
  gpuCardType,
  supplier,
} from '@workspace/db/schema'
import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'

export type BareMetalOrderListInput = {
  search?: string
  platformOrderId?: string
  tenantId?: string
  projectId?: string
  dataCenterId?: string
  status?: string
  orderMark?: 'online' | 'offline' | 'all'
  source?: string
  orderedFrom?: string
  orderedTo?: string
  page?: number
  pageSize?: number
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapListRow(row: {
  order: typeof bareMetalOrder.$inferSelect
  tenantName: string | null
  projectName: string | null
  dataCenterName: string | null
}): BareMetalOrderListItemDto {
  const { order } = row
  return {
    id: order.id,
    orderNo: order.orderNo,
    platformOrderId: order.platformOrderId,
    orderMark: order.orderMark as BareMetalOrderListItemDto['orderMark'],
    source: order.source,
    status: order.status,
    payStatus: order.payStatus,
    tenantId: order.tenantId,
    tenantName: row.tenantName,
    platformTenantId: order.platformTenantId,
    projectId: order.projectId,
    projectName: row.projectName,
    dataCenterId: order.dataCenterId,
    dataCenterName: row.dataCenterName,
    idcName: order.idcName,
    deviceCount: order.deviceCount,
    gpuCount: order.gpuCount,
    purchaseQtyText: order.purchaseQtyText,
    billingUnit: order.billingUnit,
    finalAmount: order.finalAmount,
    orderedAt: toIso(order.orderedAt)!,
    rentStartsAt: toIso(order.rentStartsAt),
    rentEndsAt: toIso(order.rentEndsAt),
  }
}

export const bareMetalOrderDataAccess = {
  async list(input: BareMetalOrderListInput = {}): Promise<{
    items: BareMetalOrderListItemDto[]
    total: number
  }> {
    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 20
    const offset = (page - 1) * pageSize
    const conditions = []

    const q = input.search?.trim()
    if (q) {
      const pattern = `%${q}%`
      conditions.push(
        or(
          ilike(bareMetalOrder.orderNo, pattern),
          ilike(bareMetalOrder.platformOrderId, pattern),
          ilike(billingTenant.name, pattern),
          ilike(crmProject.name, pattern),
          ilike(bareMetalOrder.idcName, pattern),
        )!,
      )
    }

    if (input.platformOrderId?.trim()) {
      conditions.push(ilike(bareMetalOrder.platformOrderId, `%${input.platformOrderId.trim()}%`))
    }
    if (input.tenantId) conditions.push(eq(bareMetalOrder.tenantId, input.tenantId))
    if (input.projectId) conditions.push(eq(bareMetalOrder.projectId, input.projectId))
    if (input.dataCenterId) conditions.push(eq(bareMetalOrder.dataCenterId, input.dataCenterId))
    if (input.status && input.status !== 'all') {
      conditions.push(eq(bareMetalOrder.status, input.status))
    }
    if (input.orderMark && input.orderMark !== 'all') {
      conditions.push(eq(bareMetalOrder.orderMark, input.orderMark))
    }
    if (input.source && input.source !== 'all') {
      conditions.push(eq(bareMetalOrder.source, input.source))
    }
    if (input.orderedFrom) {
      conditions.push(gte(bareMetalOrder.orderedAt, new Date(input.orderedFrom)))
    }
    if (input.orderedTo) {
      conditions.push(lte(bareMetalOrder.orderedAt, new Date(input.orderedTo)))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [countRow] = await db
      .select({ total: count() })
      .from(bareMetalOrder)
      .leftJoin(billingTenant, eq(billingTenant.id, bareMetalOrder.tenantId))
      .leftJoin(crmProject, eq(crmProject.id, bareMetalOrder.projectId))
      .where(whereClause)

    const rows = await db
      .select({
        order: bareMetalOrder,
        tenantName: billingTenant.name,
        projectName: crmProject.name,
        dataCenterName: dataCenter.name,
      })
      .from(bareMetalOrder)
      .leftJoin(billingTenant, eq(billingTenant.id, bareMetalOrder.tenantId))
      .leftJoin(crmProject, eq(crmProject.id, bareMetalOrder.projectId))
      .leftJoin(dataCenter, eq(dataCenter.id, bareMetalOrder.dataCenterId))
      .where(whereClause)
      .orderBy(desc(bareMetalOrder.orderedAt))
      .limit(pageSize)
      .offset(offset)

    return {
      items: rows.map(mapListRow),
      total: Number(countRow?.total ?? 0),
    }
  },

  async getById(id: string): Promise<BareMetalOrderDetailDto | null> {
    const [head] = await db
      .select({
        order: bareMetalOrder,
        tenantName: billingTenant.name,
        projectName: crmProject.name,
        dataCenterName: dataCenter.name,
        customerName: customer.name,
        supplierName: supplier.name,
      })
      .from(bareMetalOrder)
      .leftJoin(billingTenant, eq(billingTenant.id, bareMetalOrder.tenantId))
      .leftJoin(crmProject, eq(crmProject.id, bareMetalOrder.projectId))
      .leftJoin(dataCenter, eq(dataCenter.id, bareMetalOrder.dataCenterId))
      .leftJoin(customer, eq(customer.id, bareMetalOrder.customerId))
      .leftJoin(supplier, eq(supplier.id, bareMetalOrder.supplierId))
      .where(eq(bareMetalOrder.id, id))
      .limit(1)

    if (!head) return null

    const deviceRows = await db
      .select({
        device: bareMetalOrderDevice,
        gpuCardTypeCode: gpuCardType.code,
      })
      .from(bareMetalOrderDevice)
      .leftJoin(gpuCardType, eq(gpuCardType.id, bareMetalOrderDevice.gpuCardTypeId))
      .where(eq(bareMetalOrderDevice.bareMetalOrderId, id))
      .orderBy(bareMetalOrderDevice.lineNo)

    const devices: BareMetalOrderDeviceDto[] = deviceRows.map(({ device, gpuCardTypeCode }) => ({
      id: device.id,
      lineNo: device.lineNo,
      allocationStatus: device.allocationStatus,
      deviceModelText: device.deviceModelText,
      gpuCardTypeId: device.gpuCardTypeId,
      gpuCardTypeCode,
      gpuCount: device.gpuCount,
      durationHours: device.durationHours,
      unitPricePerCardHour: device.unitPricePerCardHour,
      lineAmount: device.lineAmount,
      rentStartsAt: toIso(device.rentStartsAt),
      rentEndsAt: toIso(device.rentEndsAt),
      supplierDeviceId: device.supplierDeviceId,
      platformDeviceId: device.platformDeviceId,
    }))

    const base = mapListRow(head)
    const { order } = head
    return {
      ...base,
      orderAmount: order.orderAmount,
      refundAmount: order.refundAmount,
      balanceAmount: order.balanceAmount,
      couponAmount: order.couponAmount,
      paidAt: toIso(order.paidAt),
      completedAt: toIso(order.completedAt),
      purchaseQty: order.purchaseQty,
      idcCode: order.idcCode,
      supplierId: order.supplierId,
      supplierName: head.supplierName,
      customerId: order.customerId,
      customerName: head.customerName,
      importBatchId: order.importBatchId,
      matchFlags: (order.matchFlags ?? {}) as Record<string, unknown>,
      remark: order.remark,
      devices,
    }
  },

  async listByProject(projectId: string): Promise<BareMetalOrderListItemDto[]> {
    const result = await this.list({ projectId, pageSize: 100, page: 1 })
    return result.items
  },
}
