import { db } from '@/lib/db'
import type {
  Activity,
  Bill,
  BillDetail,
  Consumption,
  Coupon,
  DailyConsumption,
  DailyConsumptionDetail,
  Order,
  OrderItem,
  PlatformTenant,
  Recharge,
  Task,
} from '@/lib/data/types'
import {
  mapBillRow,
  mapCouponRow,
  mapOrderRow,
  mapRechargeRow,
  mapTaskRow,
  toNumber,
} from '@/lib/server/mappers/crm'
import { mapBillingTenantRow } from '@/lib/server/mappers/crm'
import { projectsDataAccess } from './projects'
import { projectActivitiesDataAccess } from './project-activities'
import {
  billingTenant,
  commerceOrder,
  commerceOrderItem,
  computeTask,
  consumptionUsageDaily,
  tenantConsumptionDailyDetail,
  coupon,
  recharge,
  tenantBill,
  tenantBillDetail,
} from '@workspace/db/schema'
import {
  lastNShanghaiUsageMonths,
  shanghaiUsageMonth,
} from '@/lib/crm/balance-snapshot-utils'
import { and, desc, eq, inArray, sql, sum } from 'drizzle-orm'

async function tenantIdsForCustomer(customerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: billingTenant.id })
    .from(billingTenant)
    .where(eq(billingTenant.customerId, customerId))
  return rows.map((r) => r.id)
}

function mapDailyDetailToConsumption(row: {
  id: string
  tenantId: string
  productLine: string
  dataCenterName: string
  gpuCardTypeName: string | null
  gpuCardTypeCode: string
  taskName: string | null
  totalAmount: string | number
  totalCardHours: string | number | null
  usageDate: string | Date
}): Consumption {
  const resourceName =
    row.taskName?.trim() ||
    `${row.dataCenterName} · ${row.gpuCardTypeName ?? row.gpuCardTypeCode}`
  const usageDate = String(row.usageDate).slice(0, 10)
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: '',
    productLine: row.productLine as Consumption['productLine'],
    resourceName,
    amount: toNumber(row.totalAmount),
    duration: row.totalCardHours != null ? toNumber(row.totalCardHours) : 0,
    unit: 'hour',
    createdAt: `${usageDate}T00:00:00.000Z`,
  }
}

export const billingDataAccess = {
  async listTenantsByCustomer(customerId: string): Promise<PlatformTenant[]> {
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
      .select({
        id: tenantConsumptionDailyDetail.id,
        tenantId: tenantConsumptionDailyDetail.tenantId,
        productLine: tenantConsumptionDailyDetail.productLine,
        dataCenterName: tenantConsumptionDailyDetail.dataCenterName,
        gpuCardTypeName: tenantConsumptionDailyDetail.gpuCardTypeName,
        gpuCardTypeCode: tenantConsumptionDailyDetail.gpuCardTypeCode,
        taskName: tenantConsumptionDailyDetail.taskName,
        totalAmount: tenantConsumptionDailyDetail.totalAmount,
        totalCardHours: tenantConsumptionDailyDetail.totalCardHours,
        usageDate: tenantConsumptionDailyDetail.usageDate,
      })
      .from(tenantConsumptionDailyDetail)
      .where(inArray(tenantConsumptionDailyDetail.tenantId, tenantIds))
      .orderBy(
        desc(tenantConsumptionDailyDetail.usageDate),
        desc(tenantConsumptionDailyDetail.createdAt),
      )
      .limit(200)
    return rows.map(mapDailyDetailToConsumption)
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
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)
    if (tenantIds.length === 0) return []
    const rows = await db
      .select({
        id: tenantConsumptionDailyDetail.id,
        tenantId: tenantConsumptionDailyDetail.tenantId,
        productLine: tenantConsumptionDailyDetail.productLine,
        dataCenterName: tenantConsumptionDailyDetail.dataCenterName,
        gpuCardTypeName: tenantConsumptionDailyDetail.gpuCardTypeName,
        gpuCardTypeCode: tenantConsumptionDailyDetail.gpuCardTypeCode,
        taskName: tenantConsumptionDailyDetail.taskName,
        totalAmount: tenantConsumptionDailyDetail.totalAmount,
        totalCardHours: tenantConsumptionDailyDetail.totalCardHours,
        usageDate: tenantConsumptionDailyDetail.usageDate,
      })
      .from(tenantConsumptionDailyDetail)
      .where(inArray(tenantConsumptionDailyDetail.tenantId, tenantIds))
      .orderBy(
        desc(tenantConsumptionDailyDetail.usageDate),
        desc(tenantConsumptionDailyDetail.createdAt),
      )
      .limit(200)
    return rows.map((row) => ({ ...mapDailyDetailToConsumption(row), projectId }))
  },

  async listDailyConsumptionsForTenants(
    tenantIds: string[],
    options?: { productLine?: string; usageMonth?: string },
  ): Promise<DailyConsumption[]> {
    if (tenantIds.length === 0) return []

    const filters = [inArray(consumptionUsageDaily.tenantId, tenantIds)]
    if (options?.productLine) {
      filters.push(eq(consumptionUsageDaily.productLine, options.productLine))
    }
    if (options?.usageMonth) {
      filters.push(eq(consumptionUsageDaily.usageMonth, options.usageMonth))
    }

    const rows = await db
      .select({
        id: consumptionUsageDaily.id,
        tenantId: consumptionUsageDaily.tenantId,
        tenantName: billingTenant.name,
        usageDate: consumptionUsageDaily.usageDate,
        usageMonth: consumptionUsageDaily.usageMonth,
        productLine: consumptionUsageDaily.productLine,
        amount: consumptionUsageDaily.amount,
        voucherAmount: consumptionUsageDaily.voucherAmount,
        balanceAmount: consumptionUsageDaily.balanceAmount,
        totalCardHours: consumptionUsageDaily.totalCardHours,
        voucherCardHours: consumptionUsageDaily.voucherCardHours,
        balanceCardHours: consumptionUsageDaily.balanceCardHours,
        taskCount: sql<number>`coalesce((
          select count(*)::int from tenant_consumption_daily_detail d
          where d.tenant_id = ${consumptionUsageDaily.tenantId}
            and d.usage_date = ${consumptionUsageDaily.usageDate}
            and d.product_line = ${consumptionUsageDaily.productLine}
        ), 0)`.mapWith(Number),
      })
      .from(consumptionUsageDaily)
      .innerJoin(billingTenant, eq(consumptionUsageDaily.tenantId, billingTenant.id))
      .where(and(...filters))
      .orderBy(
        desc(consumptionUsageDaily.usageDate),
        billingTenant.name,
        consumptionUsageDaily.productLine,
      )

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      usageDate: String(row.usageDate).slice(0, 10),
      usageMonth: row.usageMonth,
      productLine: row.productLine ?? '',
      amount: toNumber(row.amount),
      voucherAmount: toNumber(row.voucherAmount),
      balanceAmount: toNumber(row.balanceAmount),
      totalCardHours: row.totalCardHours != null ? toNumber(row.totalCardHours) : null,
      voucherCardHours: row.voucherCardHours != null ? toNumber(row.voucherCardHours) : null,
      balanceCardHours: row.balanceCardHours != null ? toNumber(row.balanceCardHours) : null,
      taskCount: Number(row.taskCount ?? 0),
    }))
  },

  async listDailyConsumptionsByCustomer(
    customerId: string,
    options?: { productLine?: string; usageMonth?: string },
  ): Promise<DailyConsumption[]> {
    const tenantIds = await tenantIdsForCustomer(customerId)
    return this.listDailyConsumptionsForTenants(tenantIds, options)
  },

  async listDailyConsumptionsByProject(
    projectId: string,
    options?: { productLine?: string; usageMonth?: string },
  ): Promise<DailyConsumption[]> {
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)
    return this.listDailyConsumptionsForTenants(tenantIds, options)
  },

  async listDailyConsumptionDetailsForTenant(
    input: { usageDate: string; productLine: string; tenantId: string },
  ): Promise<DailyConsumptionDetail[]> {
    const rows = await db
      .select({
        id: tenantConsumptionDailyDetail.id,
        tenantId: tenantConsumptionDailyDetail.tenantId,
        tenantName: billingTenant.name,
        usageDate: tenantConsumptionDailyDetail.usageDate,
        productLine: tenantConsumptionDailyDetail.productLine,
        dataCenterCode: tenantConsumptionDailyDetail.dataCenterCode,
        dataCenterName: tenantConsumptionDailyDetail.dataCenterName,
        gpuCardTypeCode: tenantConsumptionDailyDetail.gpuCardTypeCode,
        gpuCardTypeName: tenantConsumptionDailyDetail.gpuCardTypeName,
        platformTaskId: tenantConsumptionDailyDetail.platformTaskId,
        taskName: tenantConsumptionDailyDetail.taskName,
        totalAmount: tenantConsumptionDailyDetail.totalAmount,
        voucherAmount: tenantConsumptionDailyDetail.voucherAmount,
        balanceAmount: tenantConsumptionDailyDetail.balanceAmount,
        totalCardHours: tenantConsumptionDailyDetail.totalCardHours,
        voucherCardHours: tenantConsumptionDailyDetail.voucherCardHours,
        balanceCardHours: tenantConsumptionDailyDetail.balanceCardHours,
      })
      .from(tenantConsumptionDailyDetail)
      .innerJoin(billingTenant, eq(tenantConsumptionDailyDetail.tenantId, billingTenant.id))
      .where(
        and(
          eq(tenantConsumptionDailyDetail.tenantId, input.tenantId),
          eq(tenantConsumptionDailyDetail.usageDate, input.usageDate),
          eq(tenantConsumptionDailyDetail.productLine, input.productLine),
        ),
      )
      .orderBy(
        desc(tenantConsumptionDailyDetail.totalAmount),
        tenantConsumptionDailyDetail.taskName,
      )

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      usageDate: String(row.usageDate).slice(0, 10),
      productLine: row.productLine,
      dataCenterCode: row.dataCenterCode,
      dataCenterName: row.dataCenterName,
      gpuCardTypeCode: row.gpuCardTypeCode,
      gpuCardTypeName: row.gpuCardTypeName,
      platformTaskId: row.platformTaskId,
      taskName: row.taskName,
      totalAmount: toNumber(row.totalAmount),
      voucherAmount: toNumber(row.voucherAmount),
      balanceAmount: toNumber(row.balanceAmount),
      totalCardHours: row.totalCardHours != null ? toNumber(row.totalCardHours) : null,
      voucherCardHours: row.voucherCardHours != null ? toNumber(row.voucherCardHours) : null,
      balanceCardHours: row.balanceCardHours != null ? toNumber(row.balanceCardHours) : null,
    }))
  },

  async listDailyConsumptionDetailsByCustomer(
    customerId: string,
    input: { usageDate: string; productLine: string; tenantId: string },
  ): Promise<DailyConsumptionDetail[]> {
    const tenantIds = await tenantIdsForCustomer(customerId)
    if (!tenantIds.includes(input.tenantId)) return []
    return this.listDailyConsumptionDetailsForTenant(input)
  },

  async listDailyConsumptionDetailsByProject(
    projectId: string,
    input: { usageDate: string; productLine: string; tenantId: string },
  ): Promise<DailyConsumptionDetail[]> {
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)
    if (!tenantIds.includes(input.tenantId)) return []
    return this.listDailyConsumptionDetailsForTenant(input)
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
    return projectActivitiesDataAccess.listByProject(projectId)
  },

  async consumptionTrendByCustomer(customerId: string, months = 12) {
    const tenantIds = await tenantIdsForCustomer(customerId)
    const monthKeys = lastNShanghaiUsageMonths(months)
    if (tenantIds.length === 0) {
      return monthKeys.map((month) => ({ month, consumption: 0 }))
    }

    const rows = await db
      .select({
        month: consumptionUsageDaily.usageMonth,
        amount: sum(consumptionUsageDaily.amount),
      })
      .from(consumptionUsageDaily)
      .where(
        and(
          inArray(consumptionUsageDaily.tenantId, tenantIds),
          inArray(consumptionUsageDaily.usageMonth, monthKeys),
        ),
      )
      .groupBy(consumptionUsageDaily.usageMonth)

    const amountByMonth = new Map(rows.map((r) => [r.month, Number(r.amount ?? 0)]))

    return monthKeys.map((month) => ({
      month,
      consumption: amountByMonth.get(month) ?? 0,
    }))
  },

  async productLineBreakdownByCustomer(customerId: string, usageMonth?: string) {
    const tenantIds = await tenantIdsForCustomer(customerId)
    if (tenantIds.length === 0) return []

    const month = usageMonth ?? shanghaiUsageMonth()
    const rows = await db
      .select({
        productLine: consumptionUsageDaily.productLine,
        amount: sum(consumptionUsageDaily.amount),
      })
      .from(consumptionUsageDaily)
      .where(
        and(
          inArray(consumptionUsageDaily.tenantId, tenantIds),
          eq(consumptionUsageDaily.usageMonth, month),
        ),
      )
      .groupBy(consumptionUsageDaily.productLine)

    return rows
      .map((r) => ({
        name: r.productLine ?? 'unknown',
        value: Number(r.amount ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
  },
}
