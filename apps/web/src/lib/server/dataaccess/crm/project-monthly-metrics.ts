import { db } from '@/lib/db'
import { consumptionRecord, crmProject, recharge } from '@workspace/db/schema'
import { and, eq, gte, inArray, lt, sum } from 'drizzle-orm'

function monthRange(monthsAgo: number): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1)
  return { start, end }
}

async function sumRechargeByProject(
  projectIds: string[],
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map()

  const rows = await db
    .select({ projectId: recharge.projectId, value: sum(recharge.amount) })
    .from(recharge)
    .where(
      and(
        inArray(recharge.projectId, projectIds),
        eq(recharge.status, 'completed'),
        gte(recharge.completedAt, start),
        lt(recharge.completedAt, end),
      ),
    )
    .groupBy(recharge.projectId)

  return new Map(rows.map((r) => [r.projectId!, Number(r.value ?? 0)]))
}

async function sumConsumptionByProject(
  projectIds: string[],
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map()

  const rows = await db
    .select({ projectId: consumptionRecord.projectId, value: sum(consumptionRecord.amount) })
    .from(consumptionRecord)
    .where(
      and(
        inArray(consumptionRecord.projectId, projectIds),
        gte(consumptionRecord.occurredAt, start),
        lt(consumptionRecord.occurredAt, end),
      ),
    )
    .groupBy(consumptionRecord.projectId)

  return new Map(rows.map((r) => [r.projectId!, Number(r.value ?? 0)]))
}

/** 按自然月从充值/消费明细汇总并写回项目快照字段 */
export async function refreshProjectMonthlyMetrics(projectIds?: string[]): Promise<void> {
  const ids =
    projectIds ??
    (await db.select({ id: crmProject.id }).from(crmProject)).map((r) => r.id)
  if (ids.length === 0) return

  const lastMonth = monthRange(1)
  const thisMonth = monthRange(0)

  const [
    lastRecharge,
    thisRecharge,
    lastConsumption,
    thisConsumption,
  ] = await Promise.all([
    sumRechargeByProject(ids, lastMonth.start, lastMonth.end),
    sumRechargeByProject(ids, thisMonth.start, thisMonth.end),
    sumConsumptionByProject(ids, lastMonth.start, lastMonth.end),
    sumConsumptionByProject(ids, thisMonth.start, thisMonth.end),
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
