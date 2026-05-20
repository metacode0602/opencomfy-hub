import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodAggCustomerConsumption,
  billingPeriodImportBatch,
  billingPeriodReconciliationReport,
  billingPeriodTenantProjectEnrichment,
  billingTenantCostAllocation,
  platformCostMonthly,
  platformIncomeMonthly,
} from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'
import type { ImportFileType, PurgeScope } from './constants'
import { FinanceError } from './errors'
import { financeLog } from './logger'
import { appendOperationLog, newId } from './operation-log'

type DbExecutor = Pick<typeof db, 'delete' | 'update'>

async function deleteDerivedForPeriod(tx: DbExecutor, periodId: string): Promise<void> {
  await tx.delete(platformIncomeMonthly).where(eq(platformIncomeMonthly.billingPeriodId, periodId))
  await tx.delete(platformCostMonthly).where(eq(platformCostMonthly.billingPeriodId, periodId))
  await tx
    .delete(billingPeriodReconciliationReport)
    .where(eq(billingPeriodReconciliationReport.billingPeriodId, periodId))
}

async function resetPeriodTotals(tx: DbExecutor, periodId: string): Promise<void> {
  await tx
    .update(billingPeriod)
    .set({
      totalIncome: null,
      totalCost: null,
      totalGrossProfit: null,
      supplementary: null,
      balanceIncome: null,
      baremetalIncome: null,
      lastComputedAt: null,
    })
    .where(eq(billingPeriod.id, periodId))
}

export async function purgeBillingPeriodArtifacts(input: {
  billingPeriodId: string
  scope: PurgeScope
  fileType?: ImportFileType
  actorId?: string | null
}): Promise<void> {
  const { billingPeriodId: periodId, scope, fileType, actorId } = input
  financeLog('purge', `start scope=${scope}`, { periodId, fileType })

  await db.transaction(async (tx) => {
    if (scope === 'file_type') {
      if (!fileType) {
        throw new FinanceError('BAD_REQUEST', 'file_type purge 须指定 fileType')
      }
      await tx
        .delete(billingPeriodImportBatch)
        .where(
          and(
            eq(billingPeriodImportBatch.billingPeriodId, periodId),
            eq(billingPeriodImportBatch.fileType, fileType),
          ),
        )
      if (fileType === 'customer_consumption') {
        await tx
          .delete(billingPeriodAggCustomerConsumption)
          .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
      }
      if (fileType === 'tenant_bill') {
        await tx
          .delete(billingPeriodTenantProjectEnrichment)
          .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, periodId))
      }
      await deleteDerivedForPeriod(tx, periodId)
      await resetPeriodTotals(tx, periodId)
    } else if (scope === 'derived') {
      await deleteDerivedForPeriod(tx, periodId)
      await tx
        .delete(billingPeriodAggCustomerConsumption)
        .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
      await resetPeriodTotals(tx, periodId)
    } else if (scope === 'full') {
      await tx
        .delete(billingPeriodImportBatch)
        .where(eq(billingPeriodImportBatch.billingPeriodId, periodId))
      await tx
        .delete(billingPeriodAggCustomerConsumption)
        .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
      await tx
        .delete(billingPeriodTenantProjectEnrichment)
        .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, periodId))
      await tx
        .delete(billingTenantCostAllocation)
        .where(eq(billingTenantCostAllocation.billingPeriodId, periodId))
      await deleteDerivedForPeriod(tx, periodId)
      await resetPeriodTotals(tx, periodId)
    }
  })

  await appendOperationLog({
    billingPeriodId: periodId,
    operation: 'purge',
    purgeScope: scope,
    actorId,
    metadata: fileType ? { fileType } : undefined,
  })

  financeLog('purge', `done scope=${scope}`, { periodId })
}
