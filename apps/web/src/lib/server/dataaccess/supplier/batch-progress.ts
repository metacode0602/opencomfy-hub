import { db } from '@/lib/db'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import {
  onboardingBatch,
  onboardingBatchDeviceLink,
  supplierDevice,
} from '@workspace/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const ONBOARDING_LIFECYCLES = new Set(['待接入', '接入中'])

/**
 * 按 device_link + 设备当前状态刷新业务批次进度缓存（§6.1 设计）。
 */
export async function refreshBatchProgress(
  businessBatchId: string,
  tx?: DbTx,
  syncedAt = new Date(),
): Promise<{ touched: number; online: number; onboarding: number }> {
  supplierLog('batch-progress', 'refresh start', { businessBatchId })

  const run = async (runner: DbTx) => {
    const [batch] = await runner
      .select({
        id: onboardingBatch.id,
        plannedDeviceCount: onboardingBatch.plannedDeviceCount,
      })
      .from(onboardingBatch)
      .where(
        and(
          eq(onboardingBatch.id, businessBatchId),
          inArray(onboardingBatch.batchKind, ['online', 'order_access']),
        ),
      )
      .limit(1)

    if (!batch) {
      supplierWarn('batch-progress', 'refresh skipped: not a business batch', { businessBatchId })
      return { touched: 0, online: 0, onboarding: 0 }
    }

    const [counts] = await runner
      .select({
        touched: sql<number>`count(distinct ${onboardingBatchDeviceLink.supplierDeviceId})::int`.mapWith(
          Number,
        ),
        online: sql<number>`count(distinct ${onboardingBatchDeviceLink.supplierDeviceId}) filter (where ${supplierDevice.lifecycleStatus} = '在线')::int`.mapWith(
          Number,
        ),
        onboarding: sql<number>`count(distinct ${onboardingBatchDeviceLink.supplierDeviceId}) filter (where ${supplierDevice.lifecycleStatus} in ('待接入', '接入中'))::int`.mapWith(
          Number,
        ),
      })
      .from(onboardingBatchDeviceLink)
      .innerJoin(
        supplierDevice,
        eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id),
      )
      .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, businessBatchId))

    const touched = counts?.touched ?? 0
    const online = counts?.online ?? 0
    const onboarding = counts?.onboarding ?? 0

    await runner
      .update(onboardingBatch)
      .set({
        touchedDeviceCount: touched,
        onlineDeviceCount: online,
        progressSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
      .where(eq(onboardingBatch.id, businessBatchId))

    supplierLog('batch-progress', 'refresh done', {
      businessBatchId,
      touched,
      online,
      onboarding,
      planned: batch.plannedDeviceCount,
    })

    return { touched, online, onboarding }
  }

  try {
    if (tx) {
      return await run(tx)
    }
    return await db.transaction(async (trx) => run(trx))
  } catch (e) {
    supplierError('batch-progress', 'refresh failed', e, { businessBatchId })
    throw e
  }
}

export { ONBOARDING_LIFECYCLES }
