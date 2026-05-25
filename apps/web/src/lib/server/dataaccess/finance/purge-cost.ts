import { eq } from 'drizzle-orm'
import type { db } from '@/lib/db'
import {
  billingPeriodCostBaremetalAgg,
  billingPeriodCostDetail,
  billingPeriodCostEnrichment,
  platformCostMonthly,
} from '@workspace/db/schema'

type DbExecutor = Pick<typeof db, 'delete'>

export async function purgeCostDerived(tx: DbExecutor, periodId: string): Promise<void> {
  await tx.delete(platformCostMonthly).where(eq(platformCostMonthly.billingPeriodId, periodId))
  await tx
    .delete(billingPeriodCostDetail)
    .where(eq(billingPeriodCostDetail.billingPeriodId, periodId))
  await tx
    .delete(billingPeriodCostBaremetalAgg)
    .where(eq(billingPeriodCostBaremetalAgg.billingPeriodId, periodId))
  await tx
    .delete(billingPeriodCostEnrichment)
    .where(eq(billingPeriodCostEnrichment.billingPeriodId, periodId))
}

export async function purgeCostDerivedStandalone(periodId: string): Promise<void> {
  const { db } = await import('@/lib/db')
  await db.transaction(async (tx) => {
    await purgeCostDerived(tx, periodId)
  })
}
