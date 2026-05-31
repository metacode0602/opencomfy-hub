import { db } from '@/lib/db'
import { internalTestHold, onboardingBatch } from '@workspace/db/schema'
import { and, eq, isNotNull, isNull, ne, or } from 'drizzle-orm'

/**
 * 供应商维度飞书工单号唯一性（IO-10）。
 * internal_occupancy 批次与其关联 hold 共享同工单号：创建 hold 时传入 excludeOnboardingBatchId。
 */
export async function assertSupplierWorkOrderUnique(
  supplierId: string,
  workOrderNo: string,
  options?: { excludeOnboardingBatchId?: string },
) {
  const normalized = workOrderNo.trim()
  const excludeBatchId = options?.excludeOnboardingBatchId

  const batchConditions = [
    eq(onboardingBatch.supplierId, supplierId),
    eq(onboardingBatch.workOrderNo, normalized),
  ]
  if (excludeBatchId) {
    batchConditions.push(ne(onboardingBatch.id, excludeBatchId))
  }

  const [batchDup] = await db
    .select({ id: onboardingBatch.id })
    .from(onboardingBatch)
    .where(and(...batchConditions))
    .limit(1)
  if (batchDup) {
    throw new Error(`该供应商下飞书工单号「${normalized}」已存在，请更换后重试`)
  }

  const holdConditions = [
    eq(internalTestHold.supplierId, supplierId),
    eq(internalTestHold.workOrderNo, normalized),
    isNotNull(internalTestHold.supplierId),
  ]
  if (excludeBatchId) {
    holdConditions.push(
      or(
        isNull(internalTestHold.onboardingBatchId),
        ne(internalTestHold.onboardingBatchId, excludeBatchId),
      )!,
    )
  }

  const [holdDup] = await db
    .select({ id: internalTestHold.id })
    .from(internalTestHold)
    .where(and(...holdConditions))
    .limit(1)
  if (holdDup) {
    throw new Error(`该供应商下飞书工单号「${normalized}」已存在，请更换后重试`)
  }
}
