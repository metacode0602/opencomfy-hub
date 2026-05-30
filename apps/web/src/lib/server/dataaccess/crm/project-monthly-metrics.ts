import { db } from '@/lib/db'
import { monthDateRange, shanghaiUsageMonth } from '@/lib/crm/balance-snapshot-utils'
import {
  billingTenant,
  consumptionUsageDaily,
  crmProject,
  projectTenant,
  recharge,
} from '@workspace/db/schema'
import { and, eq, gte, inArray, lt, sum } from 'drizzle-orm'

async function getBillingTenantIdsForProject(projectId: string): Promise<string[]> {
  const project = await db.query.crmProject.findFirst({ where: eq(crmProject.id, projectId) })
  if (!project) return []

  const ids = new Set<string>()
  if (project.primaryTenantId) ids.add(project.primaryTenantId)

  const links = await db
    .select({ tenantId: projectTenant.tenantId })
    .from(projectTenant)
    .where(eq(projectTenant.projectId, projectId))
  for (const link of links) ids.add(link.tenantId)

  if (ids.size === 0) {
    const def = await db.query.billingTenant.findFirst({
      where: and(
        eq(billingTenant.customerId, project.customerId),
        eq(billingTenant.isDefault, true),
      ),
    })
    if (def) ids.add(def.id)
  }

  return [...ids]
}

function monthUtcRange(usageMonth: string): { start: Date; end: Date } {
  const { from, to } = monthDateRange(usageMonth)
  const [y, m, d] = to.split('-').map(Number)
  const end = new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999))
  return {
    start: new Date(`${from}T00:00:00+08:00`),
    end,
  }
}

async function sumRechargeByProject(
  projectIds: string[],
  usageMonth: string,
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map()

  const { start, end } = monthUtcRange(usageMonth)
  const rows = await db
    .select({ projectId: recharge.projectId, value: sum(recharge.amount) })
    .from(recharge)
    .where(
      and(
        inArray(recharge.projectId, projectIds),
        eq(recharge.status, 'completed'),
        gte(recharge.completedAt, start),
        lt(recharge.completedAt, new Date(end.getTime() + 1)),
      ),
    )
    .groupBy(recharge.projectId)

  return new Map(rows.map((r) => [r.projectId!, Number(r.value ?? 0)]))
}

async function sumConsumptionByProjectTenants(
  projectIds: string[],
  usageMonth: string,
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map()

  const tenantIdsByProject = new Map<string, string[]>()
  const allTenantIds = new Set<string>()
  for (const projectId of projectIds) {
    const tenantIds = await getBillingTenantIdsForProject(projectId)
    tenantIdsByProject.set(projectId, tenantIds)
    for (const tenantId of tenantIds) allTenantIds.add(tenantId)
  }
  if (allTenantIds.size === 0) return new Map()

  const rows = await db
    .select({
      tenantId: consumptionUsageDaily.tenantId,
      value: sum(consumptionUsageDaily.amount),
    })
    .from(consumptionUsageDaily)
    .where(
      and(
        inArray(consumptionUsageDaily.tenantId, [...allTenantIds]),
        eq(consumptionUsageDaily.usageMonth, usageMonth),
      ),
    )
    .groupBy(consumptionUsageDaily.tenantId)

  const consumptionByTenant = new Map(rows.map((r) => [r.tenantId, Number(r.value ?? 0)]))
  const result = new Map<string, number>()
  for (const [projectId, tenantIds] of tenantIdsByProject) {
    result.set(
      projectId,
      tenantIds.reduce((acc, tenantId) => acc + (consumptionByTenant.get(tenantId) ?? 0), 0),
    )
  }
  return result
}

/** 按东八区自然月从充值/日消费汇总并写回项目快照字段 */
export async function refreshProjectMonthlyMetrics(projectIds?: string[]): Promise<void> {
  const ids =
    projectIds ??
    (await db.select({ id: crmProject.id }).from(crmProject)).map((r) => r.id)
  if (ids.length === 0) return

  const lastMonth = shanghaiUsageMonth(new Date(), 1)
  const thisMonth = shanghaiUsageMonth()

  const [lastRecharge, thisRecharge, lastConsumption, thisConsumption] = await Promise.all([
    sumRechargeByProject(ids, lastMonth),
    sumRechargeByProject(ids, thisMonth),
    sumConsumptionByProjectTenants(ids, lastMonth),
    sumConsumptionByProjectTenants(ids, thisMonth),
  ])

  await db.transaction(async (tx) => {
    for (const id of ids) {
      await tx
        .update(crmProject)
        .set({
          lastMonthRecharge: String(lastRecharge.get(id) ?? 0),
          thisMonthRecharge: String(thisRecharge.get(id) ?? 0),
          lastMonthConsumption: String(lastConsumption.get(id) ?? 0),
          thisMonthConsumption: String(thisConsumption.get(id) ?? 0),
        })
        .where(eq(crmProject.id, id))
    }
  })
}
