import { db } from '@/lib/db'
import { toNumber } from '@/lib/server/mappers/crm'
import type {
  TenantCommerceOrderItem,
  TenantCommerceOrderListItem,
  TenantMonthlyBillDetailItem,
  TenantMonthlyBillListItem,
  TenantRechargeListItem,
} from '@/lib/types/tenant-billing-list'
import {
  commerceOrder,
  commerceOrderItem,
  recharge,
  tenantBill,
  tenantBillDetail,
} from '@workspace/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'

export const TENANT_METAL_PRODUCT_LINE = 'bare_metal'
export const TENANT_RESERVED_PACK_PRODUCT_LINE = 'reserved_resource_pack'

function toIso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined
}

async function listCommerceOrdersByProductLine(
  tenantId: string,
  productLine: string,
): Promise<TenantCommerceOrderListItem[]> {
  const orders = await db
    .select()
    .from(commerceOrder)
    .where(and(eq(commerceOrder.tenantId, tenantId), eq(commerceOrder.productLine, productLine)))
    .orderBy(desc(commerceOrder.createdAt))

  if (orders.length === 0) return []

  const orderIds = orders.map((o) => o.id)
  const items = await db
    .select()
    .from(commerceOrderItem)
    .where(inArray(commerceOrderItem.orderId, orderIds))
    .orderBy(commerceOrderItem.sortOrder)

  const itemsByOrderId = new Map<string, TenantCommerceOrderItem[]>()
  for (const item of items) {
    const list = itemsByOrderId.get(item.orderId) ?? []
    list.push({
      name: item.name,
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      total: toNumber(item.total),
    })
    itemsByOrderId.set(item.orderId, list)
  }

  return orders.map((row) => ({
    id: row.id,
    orderNo: row.orderNo ?? '',
    status: row.status,
    amount: toNumber(row.amount),
    balanceAmount: toNumber(row.balanceAmount),
    couponAmount: toNumber(row.couponAmount),
    dataCenterName: row.dataCenterName ?? undefined,
    deviceCount: row.deviceCount ?? undefined,
    deviceModel: row.deviceModel ?? undefined,
    gpuCount: row.gpuCount ?? undefined,
    unit: row.unit ?? undefined,
    createdAt: row.createdAt.toISOString(),
    completedAt: toIso(row.completedAt),
    items: itemsByOrderId.get(row.id) ?? [],
  }))
}

export const tenantBillingListsDataAccess = {
  async listRecharges(tenantId: string): Promise<TenantRechargeListItem[]> {
    const rows = await db
      .select()
      .from(recharge)
      .where(eq(recharge.tenantId, tenantId))
      .orderBy(desc(recharge.createdAt))

    return rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId ?? '',
      amount: toNumber(row.amount),
      paymentMethod: row.paymentMethod,
      status: row.status,
      remark: row.remark ?? undefined,
      createdAt: row.createdAt.toISOString(),
      completedAt: toIso(row.completedAt),
    }))
  },

  async listMonthlyBills(tenantId: string): Promise<TenantMonthlyBillListItem[]> {
    const rows = await db
      .select()
      .from(tenantBill)
      .where(eq(tenantBill.tenantId, tenantId))
      .orderBy(desc(tenantBill.billMonth))

    return rows.map((row) => ({
      id: row.id,
      billMonth: row.billMonth,
      totalAmount: toNumber(row.totalAmount),
      balanceAmount: toNumber(row.balanceAmount),
      couponAmount: toNumber(row.couponAmount),
      status: row.status,
      dueDate: String(row.dueDate),
      paidAt: toIso(row.paidAt),
    }))
  },

  async getMonthlyBillDetails(billId: string): Promise<TenantMonthlyBillDetailItem[]> {
    const rows = await db
      .select()
      .from(tenantBillDetail)
      .where(eq(tenantBillDetail.billId, billId))

    return rows.map((row) => ({
      id: row.id,
      productLine: row.productLine ?? '',
      resourceName: row.resourceName ?? '',
      amount: toNumber(row.amount),
      balanceAmount: toNumber(row.balanceAmount),
      couponAmount: toNumber(row.couponAmount),
      type: row.type,
    }))
  },

  async listMetalOrders(tenantId: string): Promise<TenantCommerceOrderListItem[]> {
    return listCommerceOrdersByProductLine(tenantId, TENANT_METAL_PRODUCT_LINE)
  },

  async listReservedPackOrders(tenantId: string): Promise<TenantCommerceOrderListItem[]> {
    return listCommerceOrdersByProductLine(tenantId, TENANT_RESERVED_PACK_PRODUCT_LINE)
  },
}
