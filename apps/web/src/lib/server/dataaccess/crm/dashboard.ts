import { db } from '@/lib/db'
import type { Activity, Bill, Project } from '@/lib/data/types'
import {
  lastNShanghaiUsageMonths,
  shanghaiUsageMonth,
} from '@/lib/crm/balance-snapshot-utils'
import { mapActivityRow, mapBillRow } from '@/lib/server/mappers/crm'
import { projectsDataAccess } from './projects'
import {
  billingTenant,
  consumptionUsageDaily,
  contract,
  crmProject,
  customer,
  projectActivity,
  tenantBill,
} from '@workspace/db/schema'
import {
  buildCustomerTableIdFilter,
  buildProjectIdFilter,
  buildTenantIdFilter,
  loadVisibleCustomerIds,
  loadVisibleProjectIds,
  loadVisibleTenantIds,
  type CrmDataScope,
} from '@/lib/server/auth/crm-data-scope'
import { and, count, desc, eq, inArray, or, sum } from 'drizzle-orm'

export type DashboardSummary = {
  activeCustomerCount: number
  activeProjectCount: number
  thisMonthConsumption: number
  lastMonthConsumption: number
  totalBalance: number
  activeContractCount: number
  trends: {
    activeCustomerCount: number | null
    activeProjectCount: number | null
    thisMonthConsumption: number | null
  }
}

function percentChange(thisValue: number, lastValue: number): number | null {
  if (lastValue === 0) return null
  return Math.round(((thisValue - lastValue) / lastValue) * 1000) / 10
}

async function sumConsumptionForMonth(usageMonth: string, tenantIds: string[] | null): Promise<number> {
  if (tenantIds && tenantIds.length === 0) return 0
  const rows = await db
    .select({ value: sum(consumptionUsageDaily.amount) })
    .from(consumptionUsageDaily)
    .where(
      and(
        eq(consumptionUsageDaily.usageMonth, usageMonth),
        tenantIds ? inArray(consumptionUsageDaily.tenantId, tenantIds) : undefined,
      ),
    )
  return Number(rows[0]?.value ?? 0)
}

export const dashboardDataAccess = {
  async summary(scope?: CrmDataScope): Promise<DashboardSummary> {
    const thisMonth = shanghaiUsageMonth()
    const lastMonth = shanghaiUsageMonth(new Date(), 1)
    const visibleCustomerIds = scope ? await loadVisibleCustomerIds(scope) : null
    const visibleProjectIds = scope ? await loadVisibleProjectIds(scope) : null
    const visibleTenantIds = scope ? await loadVisibleTenantIds(scope) : null

    if (visibleCustomerIds && visibleCustomerIds.length === 0) {
      return {
        activeCustomerCount: 0,
        activeProjectCount: 0,
        thisMonthConsumption: 0,
        lastMonthConsumption: 0,
        totalBalance: 0,
        activeContractCount: 0,
        trends: {
          activeCustomerCount: null,
          activeProjectCount: null,
          thisMonthConsumption: null,
        },
      }
    }

    const [
      activeCustomers,
      activeProjects,
      balanceRow,
      thisMonthConsumption,
      lastMonthConsumption,
      activeContracts,
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(customer)
        .where(
          and(
            eq(customer.status, 'active'),
            buildCustomerTableIdFilter(visibleCustomerIds),
          ),
        ),
      db
        .select({ value: count() })
        .from(crmProject)
        .where(
          and(
            eq(crmProject.status, 'active'),
            buildProjectIdFilter(scope ?? { type: 'all' }, visibleProjectIds),
          ),
        ),
      db
        .select({ value: sum(billingTenant.balance) })
        .from(billingTenant)
        .where(buildTenantIdFilter(scope ?? { type: 'all' }, visibleTenantIds)),
      sumConsumptionForMonth(thisMonth, visibleTenantIds),
      sumConsumptionForMonth(lastMonth, visibleTenantIds),
      visibleProjectIds && visibleProjectIds.length === 0
        ? Promise.resolve([{ value: 0 }])
        : db
            .select({ value: count() })
            .from(contract)
            .where(
              and(
                eq(contract.status, 'active'),
                visibleProjectIds
                  ? or(
                      inArray(contract.projectId, visibleProjectIds),
                      inArray(contract.customerId, visibleCustomerIds ?? []),
                    )
                  : undefined,
              ),
            ),
    ])

    return {
      activeCustomerCount: Number(activeCustomers[0]?.value ?? 0),
      activeProjectCount: Number(activeProjects[0]?.value ?? 0),
      thisMonthConsumption,
      lastMonthConsumption,
      totalBalance: Number(balanceRow[0]?.value ?? 0),
      activeContractCount: Number(activeContracts[0]?.value ?? 0),
      trends: {
        activeCustomerCount: null,
        activeProjectCount: null,
        thisMonthConsumption: percentChange(thisMonthConsumption, lastMonthConsumption),
      },
    }
  },

  async recentProjects(limit = 5, scope?: CrmDataScope): Promise<Project[]> {
    return projectsDataAccess.listRecent(limit, scope)
  },

  async recentActivities(
    limit = 6,
    scope?: CrmDataScope,
  ): Promise<Array<Activity & { projectName: string }>> {
    const visibleProjectIds = scope ? await loadVisibleProjectIds(scope) : null
    if (visibleProjectIds && visibleProjectIds.length === 0) return []

    const rows = await db
      .select({
        activity: projectActivity,
        projectName: crmProject.name,
      })
      .from(projectActivity)
      .leftJoin(crmProject, eq(projectActivity.projectId, crmProject.id))
      .where(buildProjectIdFilter(scope ?? { type: 'all' }, visibleProjectIds))
      .orderBy(desc(projectActivity.createdAt))
      .limit(limit)

    return rows.map((row) => ({
      ...mapActivityRow(row.activity),
      projectName: row.projectName ?? '',
    }))
  },

  async pendingBills(limit = 10, scope?: CrmDataScope): Promise<Bill[]> {
    const visibleProjectIds = scope ? await loadVisibleProjectIds(scope) : null
    if (visibleProjectIds && visibleProjectIds.length === 0) return []

    const rows = await db
      .select()
      .from(tenantBill)
      .where(
        and(
          or(eq(tenantBill.status, 'pending'), eq(tenantBill.status, 'overdue'))!,
          visibleProjectIds ? inArray(tenantBill.projectId, visibleProjectIds) : undefined,
        ),
      )
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

  async consumptionTrend(months = 12, scope?: CrmDataScope) {
    const monthKeys = lastNShanghaiUsageMonths(months)
    const visibleTenantIds = scope ? await loadVisibleTenantIds(scope) : null
    if (visibleTenantIds && visibleTenantIds.length === 0) {
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
          inArray(consumptionUsageDaily.usageMonth, monthKeys),
          visibleTenantIds ? inArray(consumptionUsageDaily.tenantId, visibleTenantIds) : undefined,
        ),
      )
      .groupBy(consumptionUsageDaily.usageMonth)

    const amountByMonth = new Map(rows.map((r) => [r.month, Number(r.amount ?? 0)]))

    return monthKeys.map((month) => ({
      month,
      consumption: amountByMonth.get(month) ?? 0,
    }))
  },

  async productLineBreakdown(usageMonth?: string, scope?: CrmDataScope) {
    const month = usageMonth ?? shanghaiUsageMonth()
    const visibleTenantIds = scope ? await loadVisibleTenantIds(scope) : null
    if (visibleTenantIds && visibleTenantIds.length === 0) return []

    const rows = await db
      .select({
        productLine: consumptionUsageDaily.productLine,
        amount: sum(consumptionUsageDaily.amount),
      })
      .from(consumptionUsageDaily)
      .where(
        and(
          eq(consumptionUsageDaily.usageMonth, month),
          visibleTenantIds ? inArray(consumptionUsageDaily.tenantId, visibleTenantIds) : undefined,
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
