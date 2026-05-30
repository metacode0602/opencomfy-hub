import { and, eq } from 'drizzle-orm'
import type { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodCostPricingSnapshot,
  billingPeriodCostSourceLine,
  billingPeriodImportBatch,
  billingPeriodTenantBillWindow,
  platformCostMonthly,
} from '@workspace/db/schema'
import { financeLog } from './logger'
import { newId } from './operation-log'

type CostDerivedDb = Pick<typeof db, 'delete'>

async function importStorageLocal() {
  return import('./import-storage-local')
}

export async function purgeCostDerived(tx: CostDerivedDb, periodId: string): Promise<void> {
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

/** 成本 Tab 重新生成：仅清理成本导入槽与派生，保留收入 Raw / 派生 */
export async function purgeCostImportsForRegenerate(periodId: string): Promise<void> {
  const { db } = await import('@/lib/db')
  await db.transaction(async (tx) => {
    const costBatches = await tx.query.billingPeriodImportBatch.findMany({
      where: and(
        eq(billingPeriodImportBatch.billingPeriodId, periodId),
        eq(billingPeriodImportBatch.fileType, 'baremetal_order'),
      ),
    })
    const tenantBillBatches = await tx.query.billingPeriodImportBatch.findMany({
      where: and(
        eq(billingPeriodImportBatch.billingPeriodId, periodId),
        eq(billingPeriodImportBatch.fileType, 'tenant_bill'),
      ),
    })
    const { deleteStorageFile } = await importStorageLocal()
    for (const batch of [...costBatches, ...tenantBillBatches]) {
      await deleteStorageFile(batch.storagePath)
      await deleteStorageFile(batch.errorReportPath)
      await tx
        .delete(billingPeriodImportBatch)
        .where(eq(billingPeriodImportBatch.id, batch.id))
    }

    await tx
      .delete(billingPeriodTenantBillWindow)
      .where(eq(billingPeriodTenantBillWindow.billingPeriodId, periodId))

    await purgeCostDerived(tx, periodId)

    await tx
      .update(billingPeriod)
      .set({
        totalCost: null,
        totalGrossProfit: null,
      })
      .where(eq(billingPeriod.id, periodId))
  })

  financeLog('purge-cost-imports', 'regenerate prepare done', { periodId })
}

export async function ensureRegenerateCostWindow(input: {
  periodId: string
  periodStart: string
  periodEnd: string
}): Promise<{ id: string; windowStart: string; windowEnd: string }> {
  const { db } = await import('@/lib/db')
  const windowId = newId()
  await db.insert(billingPeriodTenantBillWindow).values({
    id: windowId,
    billingPeriodId: input.periodId,
    windowStart: input.periodStart,
    windowEnd: input.periodEnd,
    sortOrder: 0,
  })
  return {
    id: windowId,
    windowStart: input.periodStart,
    windowEnd: input.periodEnd,
  }
}
