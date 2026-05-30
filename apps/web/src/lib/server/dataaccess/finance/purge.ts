import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodAggCustomerConsumption,
  billingPeriodImportBatch,
  billingPeriodReconciliationReport,
  billingPeriodTenantBillWindow,
  billingPeriodTenantProjectEnrichment,
  billingTenantCostAllocation,
  platformIncomeMonthly,
} from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'
import type { ImportFileType, PurgeScope } from './constants'
import { FinanceError } from './errors'
import { financeLog } from './logger'
import { appendOperationLog } from './operation-log'
import { purgeCostDerived } from './purge-cost'

type DbExecutor = Pick<typeof db, 'delete' | 'update'>

async function importStorageLocal() {
  return import('./import-storage-local')
}

async function deleteIncomeDerivedForPeriod(tx: DbExecutor, periodId: string): Promise<void> {
  await tx.delete(platformIncomeMonthly).where(eq(platformIncomeMonthly.billingPeriodId, periodId))
  await tx
    .delete(billingPeriodAggCustomerConsumption)
    .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
}

async function deleteDerivedForPeriod(tx: DbExecutor, periodId: string): Promise<void> {
  await deleteIncomeDerivedForPeriod(tx, periodId)
  await purgeCostDerived(tx, periodId)
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
  windowId?: string
  actorId?: string | null
  /** file_type 清理时保留收入派生与 total_income 等字段（成本 Tab 重新生成上传） */
  preserveIncomeDerived?: boolean
}): Promise<void> {
  const {
    billingPeriodId: periodId,
    scope,
    fileType,
    windowId,
    actorId,
    preserveIncomeDerived = false,
  } = input
  financeLog('purge', `start scope=${scope}`, { periodId, fileType, windowId })

  await db.transaction(async (tx) => {
    if (scope === 'file_type') {
      if (!fileType) {
        throw new FinanceError('BAD_REQUEST', 'file_type purge 须指定 fileType')
      }
      const batches = await tx.query.billingPeriodImportBatch.findMany({
        where: and(
          eq(billingPeriodImportBatch.billingPeriodId, periodId),
          eq(billingPeriodImportBatch.fileType, fileType),
        ),
      })
      const targetBatches =
        fileType === 'tenant_bill' && windowId
          ? batches.filter((b) => b.windowId === windowId)
          : batches
      const { deleteStorageFile } = await importStorageLocal()
      for (const b of targetBatches) {
        await deleteStorageFile(b.storagePath)
        await deleteStorageFile(b.errorReportPath)
      }
      for (const b of targetBatches) {
        await tx
          .delete(billingPeriodImportBatch)
          .where(eq(billingPeriodImportBatch.id, b.id))
      }
      if (fileType === 'customer_consumption') {
        await tx
          .delete(billingPeriodAggCustomerConsumption)
          .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
      }
      if (fileType === 'tenant_bill' && !windowId) {
        await tx
          .delete(billingPeriodTenantProjectEnrichment)
          .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, periodId))
      }
      if (preserveIncomeDerived) {
        await purgeCostDerived(tx, periodId)
        await tx
          .update(billingPeriod)
          .set({
            totalCost: null,
            totalGrossProfit: null,
          })
          .where(eq(billingPeriod.id, periodId))
      } else {
        await deleteDerivedForPeriod(tx, periodId)
        await resetPeriodTotals(tx, periodId)
      }
    } else if (scope === 'derived_income') {
      await deleteIncomeDerivedForPeriod(tx, periodId)
      await resetPeriodTotals(tx, periodId)
    } else if (scope === 'derived_cost') {
      await purgeCostDerived(tx, periodId)
      await tx
        .update(billingPeriod)
        .set({
          totalCost: null,
          totalGrossProfit: null,
        })
        .where(eq(billingPeriod.id, periodId))
    } else if (scope === 'derived') {
      await deleteDerivedForPeriod(tx, periodId)
      await tx
        .delete(billingPeriodAggCustomerConsumption)
        .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
      await resetPeriodTotals(tx, periodId)
    } else if (scope === 'full') {
      const batches = await tx.query.billingPeriodImportBatch.findMany({
        where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
      })
      const { deleteStorageFile } = await importStorageLocal()
      for (const b of batches) {
        await deleteStorageFile(b.storagePath)
        await deleteStorageFile(b.errorReportPath)
      }
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
      await tx
        .delete(billingPeriodTenantBillWindow)
        .where(eq(billingPeriodTenantBillWindow.billingPeriodId, periodId))
      await deleteDerivedForPeriod(tx, periodId)
      await resetPeriodTotals(tx, periodId)
    }
  })

  if (scope === 'full') {
    const { deletePeriodImportDirectory } = await importStorageLocal()
    await deletePeriodImportDirectory(periodId)
  }

  await appendOperationLog({
    billingPeriodId: periodId,
    operation: 'purge',
    purgeScope: scope,
    actorId,
    metadata: fileType ? { fileType } : undefined,
  })

  financeLog('purge', `done scope=${scope}`, { periodId })
}
