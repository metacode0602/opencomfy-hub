import { eq } from 'drizzle-orm'
import type { db } from '@/lib/db'
import {
  billingPeriodCostPricingSnapshot,
  billingPeriodCostSourceLine,
  platformCostMonthly,
} from '@workspace/db/schema'

type DbExecutor = Pick<typeof db, 'delete'>

export async function purgeCostDerived(tx: DbExecutor, periodId: string): Promise<void> {
  await tx.delete(platformCostMonthly).where(eq(platformCostMonthly.billingPeriodId, periodId))
  await tx
    .delete(billingPeriodCostPricingSnapshot)
    .where(eq(billingPeriodCostPricingSnapshot.billingPeriodId, periodId))
  await tx
    .delete(billingPeriodCostSourceLine)
    .where(eq(billingPeriodCostSourceLine.billingPeriodId, periodId))
}

export async function purgeCostDerivedStandalone(periodId: string): Promise<void> {
  const { db } = await import('@/lib/db')
  await db.transaction(async (tx) => {
    await purgeCostDerived(tx, periodId)
  })
}
