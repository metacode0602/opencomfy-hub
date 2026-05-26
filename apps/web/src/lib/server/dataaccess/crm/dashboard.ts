import { db } from '@/lib/db'
import type { Activity, Bill, Project } from '@/lib/data/types'
import { mapActivityRow, mapBillRow } from '@/lib/server/mappers/crm'
import { customersDataAccess } from './customers'
import { projectsDataAccess } from './projects'
import { contractsDataAccess } from './contracts'
import {
  consumptionRecord,
  crmProject,
  projectActivity,
  tenantBill,
} from '@workspace/db/schema'
import { count, desc, eq, inArray, or, sql, sum } from 'drizzle-orm'

export const dashboardDataAccess = {
  async summary() {
    const customers = await customersDataAccess.list()
    const activeProjects = await db
      .select({ value: count() })
      .from(crmProject)
      .where(eq(crmProject.status, 'active'))
    const contracts = await contractsDataAccess.list()
    const activeContracts = contracts.filter((c) => c.status === 'active').length

    return {
      customerCount: customers.length,
      activeProjectCount: Number(activeProjects[0]?.value ?? 0),
      totalConsumption: customers.reduce((a, c) => a + c.totalConsumption, 0),
      totalBalance: customers.reduce((a, c) => a + c.balance, 0),
      activeContractCount: activeContracts,
    }
  },

  async recentProjects(limit = 5): Promise<Project[]> {
    const all = await projectsDataAccess.list()
    return all.slice(0, limit)
  },

  async recentActivities(limit = 6): Promise<Activity[]> {
    const rows = await db
      .select()
      .from(projectActivity)
      .orderBy(desc(projectActivity.createdAt))
      .limit(limit)
    return rows.map(mapActivityRow)
  },

  async pendingBills(): Promise<Bill[]> {
    const rows = await db
      .select()
      .from(tenantBill)
      .where(or(eq(tenantBill.status, 'pending'), eq(tenantBill.status, 'overdue'))!)
      .orderBy(desc(tenantBill.dueDate))

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
          projectName: row.projectId ? projectMap.get(row.projectId) ?? '' : '',
        },
        [],
      ),
    )
  },

  async consumptionTrend() {
    const rows = await db
      .select({
        month: sql<string>`to_char(${consumptionRecord.occurredAt}, 'YYYY-MM')`,
        amount: sum(consumptionRecord.amount),
      })
      .from(consumptionRecord)
      .groupBy(sql`to_char(${consumptionRecord.occurredAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${consumptionRecord.occurredAt}, 'YYYY-MM')`)
      .limit(12)

    return rows.map((r) => ({
      month: r.month,
      consumption: Number(r.amount ?? 0),
    }))
  },

  async productLineBreakdown() {
    const rows = await db
      .select({
        productLine: consumptionRecord.productLine,
        amount: sum(consumptionRecord.amount),
      })
      .from(consumptionRecord)
      .groupBy(consumptionRecord.productLine)

    return rows.map((r) => ({
      name: r.productLine,
      value: Number(r.amount ?? 0),
    }))
  },
}
