import { db } from '@/lib/db'
import {
  billingPeriodImportBatch,
  billingPeriodPersonalIncomeSummary,
} from '@workspace/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import {
  IMPORT_FILE_TYPES,
  type PersonalImportFileType,
  PERSONAL_IMPORT_FILE_TYPES,
} from './constants'
import { FinanceError } from './errors'
import { financeLog } from './logger'
import { appendOperationLog } from './operation-log'

async function importStorageLocal() {
  return import('./import-storage-local')
}

export async function purgePersonalIncomeArtifacts(input: {
  billingPeriodId: string
  fileType?: PersonalImportFileType
  actorId?: string | null
}): Promise<void> {
  const { billingPeriodId: periodId, fileType, actorId } = input
  const types = fileType ? [fileType] : [...PERSONAL_IMPORT_FILE_TYPES]

  financeLog('purge', 'personal income start', { periodId, fileType })

  await db.transaction(async (tx) => {
    await tx
      .delete(billingPeriodPersonalIncomeSummary)
      .where(eq(billingPeriodPersonalIncomeSummary.billingPeriodId, periodId))

    const batches = await tx.query.billingPeriodImportBatch.findMany({
      where: and(
        eq(billingPeriodImportBatch.billingPeriodId, periodId),
        inArray(billingPeriodImportBatch.fileType, types),
      ),
    })

    const { deleteStorageFile } = await importStorageLocal()
    for (const b of batches) {
      await deleteStorageFile(b.storagePath)
      await deleteStorageFile(b.errorReportPath)
    }
    for (const b of batches) {
      await tx
        .delete(billingPeriodImportBatch)
        .where(eq(billingPeriodImportBatch.id, b.id))
    }
  })

  await appendOperationLog({
    billingPeriodId: periodId,
    operation: 'purge',
    purgeScope: 'personal_income',
    actorId,
    metadata: fileType ? { fileType } : { fileTypes: types },
  })

  financeLog('purge', 'personal income done', { periodId })
}

export async function getPersonalImportBatches(periodId: string) {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  return {
    tenantBill: batches.find(
      (b) => b.fileType === IMPORT_FILE_TYPES.personal_tenant_bill,
    ),
    baremetal: batches.find(
      (b) => b.fileType === IMPORT_FILE_TYPES.personal_baremetal_order,
    ),
  }
}

export function assertPersonalImportsReady(
  batches: Awaited<ReturnType<typeof getPersonalImportBatches>>,
): void {
  if (!batches.tenantBill || batches.tenantBill.parseStatus !== 'ok') {
    throw new FinanceError('PRECONDITION_FAILED', '请先上传并解析成功的个人账单详情 Excel')
  }
  if (!batches.baremetal || batches.baremetal.parseStatus !== 'ok') {
    throw new FinanceError('PRECONDITION_FAILED', '请先上传并解析成功的个人裸金属订单 Excel')
  }
}
