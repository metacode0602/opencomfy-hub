import { db } from '@/lib/db'
import type { Activity, Bill, Project } from '@/lib/data/types'
import {
  enumerateShanghaiDates,
  resolveCompareDateRange,
  resolveWorkbenchDateRange,
  shanghaiDateRangeToUtcBounds,
  type WorkbenchPeriodPreset,
} from '@/lib/crm/workbench-date-range'
import {
  lastNShanghaiUsageMonths,
  shanghaiUsageMonth,
} from '@/lib/crm/balance-snapshot-utils'
import type { CrmDataScope } from '@/lib/server/auth/crm-data-scope'
import {
  buildScopedTenantSubquery,
  buildVisibleProjectSubquery,
  customerVisibleSql,
  isScopeEmpty,
  projectVisibleSql,
  sumConsumptionInRange,
  sumRechargeInRange,
  sumScopedBalance,
  tenantBillProjectVisibleSql,
} from '@/lib/server/auth/crm-scope-sql'
import { mapActivityRow, mapBillRow } from '@/lib/server/mappers/crm'
import { projectsDataAccess } from './projects'
import {
  accountManagerAssignment,
  consumptionUsageDaily,
  contract,
  crmProject,
  customer,
  projectActivity,
  tenantBill,
} from '@workspace/db/schema'
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  sum,
} from 'drizzle-orm'

export type DashboardSummary = {
  activeCustomerCount: number
  activeProjectCount: number
  periodConsumption: number
  comparePeriodConsumption: number
  periodRecharge: number
  totalBalance: number
  activeContractCount: number
  period: { startDate: string; endDate: string; preset?: WorkbenchPeriodPreset }
  trends: {
    activeCustomerCount: number | null
    activeProjectCount: number | null
    periodConsumption: number | null
    /** @deprecated 兼容 analytics 页 */
    thisMonthConsumption: number | null
  }
  /** @deprecated 兼容 analytics 页 */
  thisMonthConsumption: number
  /** @deprecated 兼容 analytics 页 */
  lastMonthConsumption: number
}

export type DashboardSummaryInput = {
  startDate?: string
  endDate?: string
  preset?: WorkbenchPeriodPreset
}

export type ConsumptionTrendInput =
  | { months?: number }
  | { startDate: string; endDate: string }

export type ProductLineBreakdownInput = {
  usageMonth?: string
  startDate?: string
  endDate?: string
}

function percentChange(thisValue: number, lastValue: number): number | null {
  if (lastValue === 0) return null
  return Math.round(((thisValue - lastValue) / lastValue) * 1000) / 10
}

function scopedStaffId(scope: CrmDataScope | undefined): string | null {
  if (!scope || scope.type === 'all' || scope.type === 'none') return null
  return scope.staffId
}

function emptySummary(period: DashboardSummary['period']): DashboardSummary {
  return {
    activeCustomerCount: 0,
    activeProjectCount: 0,
    periodConsumption: 0,
    comparePeriodConsumption: 0,
    periodRecharge: 0,
    totalBalance: 0,
    activeContractCount: 0,
    period,
    trends: {
      activeCustomerCount: null,
      activeProjectCount: null,
      periodConsumption: null,
      thisMonthConsumption: null,
    },
    thisMonthConsumption: 0,
    lastMonthConsumption: 0,
  }
}

async function countActiveCustomers(scope?: CrmDataScope): Promise<number> {
  if (isScopeEmpty(scope)) return 0
  const staffId = scopedStaffId(scope)
  const rows = await db
    .select({ value: count() })
    .from(customer)
    .where(
      and(eq(customer.status, 'active'), staffId ? customerVisibleSql(staffId) : undefined),
    )
  return Number(rows[0]?.value ?? 0)
}

async function countActiveProjects(scope?: CrmDataScope): Promise<number> {
  if (isScopeEmpty(scope)) return 0
  const staffId = scopedStaffId(scope)
  const rows = await db
    .select({ value: count() })
    .from(crmProject)
    .where(
      and(eq(crmProject.status, 'active'), staffId ? projectVisibleSql(staffId) : undefined),
    )
  return Number(rows[0]?.value ?? 0)
}

async function countActiveContracts(scope?: CrmDataScope): Promise<number> {
  if (isScopeEmpty(scope)) return 0
  const staffId = scopedStaffId(scope)
  if (!staffId) {
    const rows = await db
      .select({ value: count() })
      .from(contract)
      .where(eq(contract.status, 'active'))
    return Number(rows[0]?.value ?? 0)
  }

  const vp = buildVisibleProjectSubquery(staffId)
  const rows = await db
    .select({ value: sql<number>`COUNT(DISTINCT ${contract.id})` })
    .from(contract)
    .leftJoin(vp, eq(contract.projectId, vp.projectId))
    .leftJoin(
      accountManagerAssignment,
      and(
        eq(accountManagerAssignment.customerId, contract.customerId),
        eq(accountManagerAssignment.userStaffId, staffId),
        isNull(accountManagerAssignment.effectiveTo),
      ),
    )
    .where(
      and(
        eq(contract.status, 'active'),
        or(isNotNull(vp.projectId), isNotNull(accountManagerAssignment.customerId)),
      ),
    )
  return Number(rows[0]?.value ?? 0)
}

export const dashboardDataAccess = {
  async summary(
    scope?: CrmDataScope,
    input?: DashboardSummaryInput,
  ): Promise<DashboardSummary> {
    const resolved = resolveWorkbenchDateRange(input)
    const period = {
      startDate: resolved.startDate,
      endDate: resolved.endDate,
      preset: resolved.preset,
    }

    if (isScopeEmpty(scope)) {
      return emptySummary(period)
    }

    const compare = resolveCompareDateRange(
      resolved.startDate,
      resolved.endDate,
      resolved.preset,
    )
    const { startUtc, endExclusiveUtc } = shanghaiDateRangeToUtcBounds(
      resolved.startDate,
      resolved.endDate,
    )

    const [
      activeCustomerCount,
      activeProjectCount,
      totalBalance,
      periodConsumption,
      comparePeriodConsumption,
      periodRecharge,
      activeContractCount,
    ] = await Promise.all([
      countActiveCustomers(scope),
      countActiveProjects(scope),
      sumScopedBalance(scope),
      sumConsumptionInRange(resolved.startDate, resolved.endDate, scope),
      sumConsumptionInRange(compare.startDate, compare.endDate, scope),
      sumRechargeInRange(startUtc, endExclusiveUtc, scope),
      countActiveContracts(scope),
    ])

    const periodConsumptionTrend = percentChange(periodConsumption, comparePeriodConsumption)

    return {
      activeCustomerCount,
      activeProjectCount,
      periodConsumption,
      comparePeriodConsumption,
      periodRecharge,
      totalBalance,
      activeContractCount,
      period,
      trends: {
        activeCustomerCount: null,
        activeProjectCount: null,
        periodConsumption: periodConsumptionTrend,
        thisMonthConsumption: periodConsumptionTrend,
      },
      thisMonthConsumption: periodConsumption,
      lastMonthConsumption: comparePeriodConsumption,
    }
  },

  async recentProjects(limit = 5, scope?: CrmDataScope): Promise<Project[]> {
    return projectsDataAccess.listRecent(limit, scope)
  },

  async recentActivities(
    limit = 6,
    scope?: CrmDataScope,
  ): Promise<Array<Activity & { projectName: string }>> {
    if (isScopeEmpty(scope)) return []

    const staffId = scopedStaffId(scope)
    if (!staffId) {
      const rows = await db
        .select({
          activity: projectActivity,
          projectName: crmProject.name,
        })
        .from(projectActivity)
        .leftJoin(crmProject, eq(projectActivity.projectId, crmProject.id))
        .orderBy(desc(projectActivity.createdAt))
        .limit(limit)
      return rows.map((row) => ({
        ...mapActivityRow(row.activity),
        projectName: row.projectName ?? '',
      }))
    }

    const vp = buildVisibleProjectSubquery(staffId)
    const rows = await db
      .select({
        activity: projectActivity,
        projectName: crmProject.name,
      })
      .from(projectActivity)
      .innerJoin(crmProject, eq(projectActivity.projectId, crmProject.id))
      .innerJoin(vp, eq(crmProject.id, vp.projectId))
      .orderBy(desc(projectActivity.createdAt))
      .limit(limit)

    return rows.map((row) => ({
      ...mapActivityRow(row.activity),
      projectName: row.projectName ?? '',
    }))
  },

  async pendingBills(limit = 10, scope?: CrmDataScope): Promise<Bill[]> {
    if (isScopeEmpty(scope)) return []

    const staffId = scopedStaffId(scope)
    const statusFilter = or(eq(tenantBill.status, 'pending'), eq(tenantBill.status, 'overdue'))!

    const rows = staffId
      ? await db
          .select()
          .from(tenantBill)
          .where(and(statusFilter, tenantBillProjectVisibleSql(staffId)))
          .orderBy(desc(tenantBill.dueDate))
          .limit(limit)
      : await db
          .select()
          .from(tenantBill)
          .where(statusFilter)
          .orderBy(desc(tenantBill.dueDate))
          .limit(limit)

    const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[]
    const projects =
      projectIds.length > 0
        ? await db.select().from(crmProject).where(inArray(crmProject.id, projectIds))
        : []
    const projectMap = new Map(projects.map((p) => [p.id, p.name]))

    return rows.map((row) =>
      mapBillRow(
        {
          ...row,
          dueDate: String(row.dueDate),
          projectName: row.projectId ? (projectMap.get(row.projectId) ?? '') : '',
        },
        [],
      ),
    )
  },

  async consumptionTrend(input: ConsumptionTrendInput | undefined, scope?: CrmDataScope) {
    if (input && 'startDate' in input && input.startDate && input.endDate) {
      return dashboardDataAccess.consumptionTrendByDateRange(
        input.startDate,
        input.endDate,
        scope,
      )
    }

    if (isScopeEmpty(scope)) {
      const monthKeys = lastNShanghaiUsageMonths(
        input && 'months' in input ? (input.months ?? 12) : 12,
      )
      return monthKeys.map((month) => ({ month, consumption: 0 }))
    }

    const months = input && 'months' in input ? (input.months ?? 12) : 12
    const monthKeys = lastNShanghaiUsageMonths(months)
    const staffId = scopedStaffId(scope)

    if (!staffId) {
      const rows = await db
        .select({
          month: consumptionUsageDaily.usageMonth,
          amount: sum(consumptionUsageDaily.amount),
        })
        .from(consumptionUsageDaily)
        .where(inArray(consumptionUsageDaily.usageMonth, monthKeys))
        .groupBy(consumptionUsageDaily.usageMonth)

      const amountByMonth = new Map(rows.map((r) => [r.month, Number(r.amount ?? 0)]))
      return monthKeys.map((month) => ({
        month,
        consumption: amountByMonth.get(month) ?? 0,
      }))
    }

    const st = buildScopedTenantSubquery(staffId)
    const rows = await db
      .select({
        month: consumptionUsageDaily.usageMonth,
        amount: sum(consumptionUsageDaily.amount),
      })
      .from(consumptionUsageDaily)
      .innerJoin(st, eq(consumptionUsageDaily.tenantId, st.tenantId))
      .where(inArray(consumptionUsageDaily.usageMonth, monthKeys))
      .groupBy(consumptionUsageDaily.usageMonth)

    const amountByMonth = new Map(rows.map((r) => [r.month, Number(r.amount ?? 0)]))
    return monthKeys.map((month) => ({
      month,
      consumption: amountByMonth.get(month) ?? 0,
    }))
  },

  async consumptionTrendByDateRange(
    startDate: string,
    endDate: string,
    scope?: CrmDataScope,
  ) {
    const dates = enumerateShanghaiDates(startDate, endDate)
    if (isScopeEmpty(scope)) {
      return dates.map((date) => ({ date, consumption: 0 }))
    }

    const staffId = scopedStaffId(scope)
    const dateFilter = and(
      gte(consumptionUsageDaily.usageDate, startDate),
      lte(consumptionUsageDaily.usageDate, endDate),
    )

    const rows = !staffId
      ? await db
          .select({
            usageDate: consumptionUsageDaily.usageDate,
            amount: sum(consumptionUsageDaily.amount),
          })
          .from(consumptionUsageDaily)
          .where(dateFilter)
          .groupBy(consumptionUsageDaily.usageDate)
      : await (() => {
          const st = buildScopedTenantSubquery(staffId)
          return db
            .select({
              usageDate: consumptionUsageDaily.usageDate,
              amount: sum(consumptionUsageDaily.amount),
            })
            .from(consumptionUsageDaily)
            .innerJoin(st, eq(consumptionUsageDaily.tenantId, st.tenantId))
            .where(dateFilter)
            .groupBy(consumptionUsageDaily.usageDate)
        })()

    const amountByDate = new Map(rows.map((r) => [String(r.usageDate), Number(r.amount ?? 0)]))
    return dates.map((date) => ({
      date,
      consumption: amountByDate.get(date) ?? 0,
    }))
  },

  async productLineBreakdown(input: ProductLineBreakdownInput | undefined, scope?: CrmDataScope) {
    if (isScopeEmpty(scope)) return []

    const staffId = scopedStaffId(scope)
    const hasDateRange = Boolean(input?.startDate && input?.endDate)

    const dateFilter = hasDateRange
      ? and(
          gte(consumptionUsageDaily.usageDate, input!.startDate!),
          lte(consumptionUsageDaily.usageDate, input!.endDate!),
        )
      : eq(consumptionUsageDaily.usageMonth, input?.usageMonth ?? shanghaiUsageMonth())

    if (!staffId) {
      const rows = await db
        .select({
          productLine: consumptionUsageDaily.productLine,
          amount: sum(consumptionUsageDaily.amount),
        })
        .from(consumptionUsageDaily)
        .where(dateFilter)
        .groupBy(consumptionUsageDaily.productLine)

      return rows
        .map((r) => ({
          name: r.productLine ?? 'unknown',
          value: Number(r.amount ?? 0),
        }))
        .sort((a, b) => b.value - a.value)
    }

    const st = buildScopedTenantSubquery(staffId)
    const rows = await db
      .select({
        productLine: consumptionUsageDaily.productLine,
        amount: sum(consumptionUsageDaily.amount),
      })
      .from(consumptionUsageDaily)
      .innerJoin(st, eq(consumptionUsageDaily.tenantId, st.tenantId))
      .where(dateFilter)
      .groupBy(consumptionUsageDaily.productLine)

    return rows
      .map((r) => ({
        name: r.productLine ?? 'unknown',
        value: Number(r.amount ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
  },
}
