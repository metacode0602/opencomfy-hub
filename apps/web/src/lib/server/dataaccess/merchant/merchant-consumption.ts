import { db } from '@/lib/db'
import type {
  MerchantConsumptionDaily,
  MerchantConsumptionSummary,
} from '@/lib/types/merchant'
import {
  billingTenant,
  consumptionUsageDaily,
  customer,
  merchant,
  tenantMerchant,
} from '@workspace/db/schema'
import { and, eq, gte, inArray, isNull, sum } from 'drizzle-orm'

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value)
}

function toDateString(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function currentUsageMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function daysAgoDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

async function getTenantIdsForMerchant(merchantId: string): Promise<string[]> {
  const rows = await db
    .select({ tenantId: tenantMerchant.tenantId })
    .from(tenantMerchant)
    .where(
      and(eq(tenantMerchant.merchantId, merchantId), isNull(tenantMerchant.effectiveTo)),
    )
  return rows.map((r) => r.tenantId)
}

async function aggregateDailyRows(
  merchantId: string,
  tenantIds: string[],
  filters: { usageMonth?: string; sinceDate?: string },
): Promise<MerchantConsumptionDaily[]> {
  if (tenantIds.length === 0) return []

  const conditions = [inArray(consumptionUsageDaily.tenantId, tenantIds)]
  if (filters.usageMonth) {
    conditions.push(eq(consumptionUsageDaily.usageMonth, filters.usageMonth))
  }
  if (filters.sinceDate) {
    conditions.push(gte(consumptionUsageDaily.usageDate, filters.sinceDate))
  }

  const rows = await db
    .select({
      usageDate: consumptionUsageDaily.usageDate,
      usageMonth: consumptionUsageDaily.usageMonth,
      amount: sum(consumptionUsageDaily.amount),
      voucherAmount: sum(consumptionUsageDaily.voucherAmount),
      balanceAmount: sum(consumptionUsageDaily.balanceAmount),
      totalCardHours: sum(consumptionUsageDaily.totalCardHours),
    })
    .from(consumptionUsageDaily)
    .where(and(...conditions))
    .groupBy(consumptionUsageDaily.usageDate, consumptionUsageDaily.usageMonth)
    .orderBy(consumptionUsageDaily.usageDate)

  return rows.map((row) => ({
    merchantId,
    usageDate: toDateString(row.usageDate),
    usageMonth: row.usageMonth,
    productLine: 'all',
    tenantCount: tenantIds.length,
    amount: toNumber(row.amount),
    voucherAmount: toNumber(row.voucherAmount),
    balanceAmount: toNumber(row.balanceAmount),
    totalCardHours: toNumber(row.totalCardHours),
  }))
}

async function sumMonthAmount(merchantId: string, usageMonth: string): Promise<number> {
  const tenantIds = await getTenantIdsForMerchant(merchantId)
  if (tenantIds.length === 0) return 0

  const [row] = await db
    .select({ amount: sum(consumptionUsageDaily.amount) })
    .from(consumptionUsageDaily)
    .where(
      and(
        inArray(consumptionUsageDaily.tenantId, tenantIds),
        eq(consumptionUsageDaily.usageMonth, usageMonth),
      ),
    )

  return toNumber(row?.amount)
}

export type MerchantTenantConsumptionRank = {
  tenantId: string
  tenantName: string
  customerId: string
  customerName: string
  isPrimary: boolean
  monthAmount: number
}

export const merchantConsumptionDataAccess = {
  async getMonthConsumption(merchantId: string, usageMonth = currentUsageMonth()): Promise<number> {
    return sumMonthAmount(merchantId, usageMonth)
  },

  async getDailyByMerchantId(
    merchantId: string,
    params?: { usageMonth?: string; recentDays?: number },
  ): Promise<MerchantConsumptionDaily[]> {
    const tenantIds = await getTenantIdsForMerchant(merchantId)
    if (params?.usageMonth) {
      return aggregateDailyRows(merchantId, tenantIds, { usageMonth: params.usageMonth })
    }
    const recentDays = params?.recentDays ?? 30
    return aggregateDailyRows(merchantId, tenantIds, { sinceDate: daysAgoDate(recentDays) })
  },

  async getSummary(
    merchantId: string,
    usageMonth = currentUsageMonth(),
  ): Promise<MerchantConsumptionSummary> {
    const tenantIds = await getTenantIdsForMerchant(merchantId)
    const daily = await aggregateDailyRows(merchantId, tenantIds, { usageMonth })

    const monthAmount = daily.reduce((s, d) => s + d.amount, 0)
    const monthVoucherAmount = daily.reduce((s, d) => s + d.voucherAmount, 0)
    const monthBalanceAmount = daily.reduce((s, d) => s + d.balanceAmount, 0)

    const defaultMerchant = await db.query.merchant.findFirst({
      where: eq(merchant.isDefault, true),
      columns: { id: true },
    })

    let compareGongjiAmount: number | undefined
    if (defaultMerchant && defaultMerchant.id !== merchantId) {
      compareGongjiAmount = await sumMonthAmount(defaultMerchant.id, usageMonth)
    }

    return {
      monthAmount,
      monthVoucherAmount,
      monthBalanceAmount,
      activeTenantCount: tenantIds.length,
      compareGongjiAmount,
    }
  },

  async listTenantRankByMerchantId(
    merchantId: string,
    usageMonth = currentUsageMonth(),
  ): Promise<MerchantTenantConsumptionRank[]> {
    const bindings = await db
      .select({
        tenantId: tenantMerchant.tenantId,
        isPrimary: tenantMerchant.isPrimary,
        tenantName: billingTenant.name,
        customerId: billingTenant.customerId,
        customerName: customer.name,
      })
      .from(tenantMerchant)
      .innerJoin(billingTenant, eq(tenantMerchant.tenantId, billingTenant.id))
      .leftJoin(customer, eq(billingTenant.customerId, customer.id))
      .where(
        and(eq(tenantMerchant.merchantId, merchantId), isNull(tenantMerchant.effectiveTo)),
      )

    if (bindings.length === 0) return []

    const tenantIds = bindings.map((b) => b.tenantId)
    const amountRows = await db
      .select({
        tenantId: consumptionUsageDaily.tenantId,
        amount: sum(consumptionUsageDaily.amount),
      })
      .from(consumptionUsageDaily)
      .where(
        and(
          inArray(consumptionUsageDaily.tenantId, tenantIds),
          eq(consumptionUsageDaily.usageMonth, usageMonth),
        ),
      )
      .groupBy(consumptionUsageDaily.tenantId)

    const amountByTenant = new Map(
      amountRows.map((row) => [row.tenantId, toNumber(row.amount)]),
    )

    return bindings
      .map((row) => ({
        tenantId: row.tenantId,
        tenantName: row.tenantName ?? row.tenantId,
        customerId: row.customerId ?? '',
        customerName: row.customerName ?? '—',
        isPrimary: row.isPrimary,
        monthAmount: amountByTenant.get(row.tenantId) ?? 0,
      }))
      .sort((a, b) => b.monthAmount - a.monthAmount)
  },
}
