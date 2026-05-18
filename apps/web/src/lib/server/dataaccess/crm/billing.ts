import { db } from '@/lib/db'
import type {
  Activity,
  Bill,
  BillDetail,
  Consumption,
  Coupon,
  Order,
  OrderItem,
  PlatformTenant,
  Recharge,
  Task,
} from '@/lib/data/types'
import {
  mapActivityRow,
  mapBillRow,
  mapConsumptionRow,
  mapCouponRow,
  mapOrderRow,
  mapRechargeRow,
  mapTaskRow,
  toNumber,
} from '@/lib/server/mappers/crm'
import { mapBillingTenantRow } from '@/lib/server/mappers/crm'
import { ensureCrmSeeded } from './ensure-seeded'
import { projectsDataAccess } from './projects'
import {
  billingTenant,
  commerceOrder,
  commerceOrderItem,
  computeTask,
  consumptionRecord,
  coupon,
  projectActivity,
  recharge,
  tenantBill,
  tenantBillDetail,
} from '@workspace/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'

async function tenantIdsForCustomer(customerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: billingTenant.id })
    .from(billingTenant)
    .where(eq(billingTenant.customerId, customerId))
  return rows.map((r) => r.id)
}

export const billingDataAccess = {
  async listTenantsByCustomer(customerId: string): Promise<PlatformTenant[]> {
    await ensureCrmSeeded()
    const rows = await db
      .select()
      .from(billingTenant)
      .where(eq(billingTenant.customerId, customerId))
      .orderBy(billingTenant.isDefault)
    return rows.map(mapBillingTenantRow)
  },

  async listRechargesByCustomer(customerId: string): Promise<Recharge[]> {
    const tenantIds = await tenantIdsForCustomer(customerId)
    if (tenantIds.length === 0) return []
    const rows = await db
      .select()
      .from(recharge)
      .where(inArray(recharge.tenantId, tenantIds))
      .orderBy(desc(recharge.createdAt))
    return rows.map(mapRechargeRow)
  },

  async listConsumptionsByCustomer(customerId: string): Promise<Consumption[]> {
    const tenantIds = await tenantIdsForCustomer(customerId)
    if (tenantIds.length === 0) return []
    const rows = await db
      .select()
      .from(consumptionRecord)
      .where(inArray(consumptionRecord.tenantId, tenantIds))
      .orderBy(desc(consumptionRecord.occurredAt))
    return rows.map(mapConsumptionRow)
  },

  async listCouponsByCustomer(customerId: string): Promise<Coupon[]> {
    const tenantIds = await tenantIdsForCustomer(customerId)
    if (tenantIds.length === 0) return []
    const rows = await db
      .select()
      .from(coupon)
      .where(inArray(coupon.tenantId, tenantIds))
      .orderBy(desc(coupon.issuedAt))
    return rows.map(mapCouponRow)
  },

  async listRechargesByProject(projectId: string): Promise<Recharge[]> {
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)
    if (tenantIds.length === 0) return []
    const rows = await db
      .select()
      .from(recharge)
      .where(
        and(inArray(recharge.tenantId, tenantIds), eq(recharge.projectId, projectId)),
      )
      .orderBy(desc(recharge.createdAt))
    const fallback =
      rows.length > 0
        ? rows
        : await db
            .select()
            .from(recharge)
            .where(inArray(recharge.tenantId, tenantIds))
            .orderBy(desc(recharge.createdAt))
    return fallback.map(mapRechargeRow)
  },

  async listConsumptionsByProject(projectId: string): Promise<Consumption[]> {
    const rows = await db
      .select()
      .from(consumptionRecord)
      .where(eq(consumptionRecord.projectId, projectId))
      .orderBy(desc(consumptionRecord.occurredAt))
    return rows.map(mapConsumptionRow)
  },

  async listTasksByProject(projectId: string): Promise<Task[]> {
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)
    const rows = await db
      .select()
      .from(computeTask)
      .where(
        tenantIds.length
          ? and(
              eq(computeTask.projectId, projectId),
              inArray(computeTask.tenantId, tenantIds),
            )
          : eq(computeTask.projectId, projectId),
      )
      .orderBy(desc(computeTask.startTime))
    return rows.map(mapTaskRow)
  },

  async listOrdersByProject(projectId: string): Promise<Order[]> {
    const rows = await db
      .select()
      .from(commerceOrder)
      .where(eq(commerceOrder.projectId, projectId))
      .orderBy(desc(commerceOrder.createdAt))

    const result: Order[] = []
    for (const row of rows) {
      const items = await db
        .select()
        .from(commerceOrderItem)
        .where(eq(commerceOrderItem.orderId, row.id))
        .orderBy(commerceOrderItem.sortOrder)
      const orderItems: OrderItem[] = items.map((i) => ({
        name: i.name,
        quantity: toNumber(i.quantity),
        unitPrice: toNumber(i.unitPrice),
        total: toNumber(i.total),
      }))
      result.push(mapOrderRow(row, orderItems))
    }
    return result
  },

  async listCouponsByProject(projectId: string): Promise<Coupon[]> {
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)
    const rows = await db
      .select()
      .from(coupon)
      .where(
        and(
          inArray(coupon.tenantId, tenantIds),
          eq(coupon.projectId, projectId),
        ),
      )
      .orderBy(desc(coupon.issuedAt))
    const fallback =
      rows.length > 0
        ? rows
        : await db
            .select()
            .from(coupon)
            .where(inArray(coupon.tenantId, tenantIds))
            .orderBy(desc(coupon.issuedAt))
    return fallback.map(mapCouponRow)
  },

  async listBillsByProject(projectId: string): Promise<Bill[]> {
    const rows = await db
      .select()
      .from(tenantBill)
      .where(eq(tenantBill.projectId, projectId))
      .orderBy(desc(tenantBill.billMonth))

    const result: Bill[] = []
    for (const row of rows) {
      const details = await db
        .select()
        .from(tenantBillDetail)
        .where(eq(tenantBillDetail.billId, row.id))
      const billDetails: BillDetail[] = details.map((d) => ({
        productLine: d.productLine ?? '',
        resourceName: d.resourceName ?? '',
        usage: toNumber(d.usage),
        unit: d.unit ?? '',
        unitPrice: toNumber(d.unitPrice),
        amount: toNumber(d.amount),
      }))
      result.push(
        mapBillRow(
          {
            ...row,
            dueDate: String(row.dueDate),
          },
          billDetails,
        ),
      )
    }
    return result
  },

  async listActivitiesByProject(projectId: string): Promise<Activity[]> {
    const rows = await db
      .select()
      .from(projectActivity)
      .where(eq(projectActivity.projectId, projectId))
      .orderBy(desc(projectActivity.createdAt))
    return rows.map(mapActivityRow)
  },
}
