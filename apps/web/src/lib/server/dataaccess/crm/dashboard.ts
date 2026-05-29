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
import { count, desc, eq, inArray, or, sum } from 'drizzle-orm'

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

async function sumConsumptionForMonth(usageMonth: string): Promise<number> {
  const rows = await db
    .select({ value: sum(consumptionUsageDaily.amount) })
    .from(consumptionUsageDaily)
    .where(eq(consumptionUsageDaily.usageMonth, usageMonth))
  return Number(rows[0]?.value ?? 0)
}

export const dashboardDataAccess = {
  async summary(): Promise<DashboardSummary> {
    const thisMonth = shanghaiUsageMonth()
    const lastMonth = shanghaiUsageMonth(new Date(), 1)

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
        .where(eq(customer.status, 'active')),
      db
        .select({ value: count() })
        .from(crmProject)
        .where(eq(crmProject.status, 'active')),
      db.select({ value: sum(billingTenant.balance) }).from(billingTenant),
      sumConsumptionForMonth(thisMonth),
      sumConsumptionForMonth(lastMonth),
      db
        .select({ value: count() })
        .from(contract)
        .where(eq(contract.status, 'active')),
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

  async recentProjects(limit = 5): Promise<Project[]> {
    return projectsDataAccess.listRecent(limit)
  },

  async recentActivities(limit = 6): Promise<Array<Activity & { projectName: string }>> {
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
  },

  async pendingBills(limit = 10): Promise<Bill[]> {
    const rows = await db
      .select()
      .from(tenantBill)
      .where(or(eq(tenantBill.status, 'pending'), eq(tenantBill.status, 'overdue'))!)
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

  async consumptionTrend(months = 12) {
    const monthKeys = lastNShanghaiUsageMonths(months)
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
  },

  async productLineBreakdown(usageMonth?: string) {
    const month = usageMonth ?? shanghaiUsageMonth()
    const rows = await db
      .select({
        productLine: consumptionUsageDaily.productLine,
        amount: sum(consumptionUsageDaily.amount),
      })
      .from(consumptionUsageDaily)
      .where(eq(consumptionUsageDaily.usageMonth, month))
      .groupBy(consumptionUsageDaily.productLine)

    return rows
      .map((r) => ({
        name: r.productLine ?? 'unknown',
        value: Number(r.amount ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
  },
}
