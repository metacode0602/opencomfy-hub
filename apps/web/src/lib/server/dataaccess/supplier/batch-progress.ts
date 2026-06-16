import { db } from '@/lib/db'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import {
  onboardingBatch,
  onboardingBatchDeviceLink,
  supplierDevice,
} from '@workspace/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { appendBatchProgressEvent } from '@/lib/server/aggregation/batch-progress-events'
import {
  mergeRetireProgressFlags,
  type RetireProgressFlags,
} from '@/lib/supplier/retire-changelog-utils'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const ONBOARDING_LIFECYCLES = new Set(['待接入', '接入中'])

export type BatchProgressResult = {
  touched: number
  online: number
  onboarding: number
  retired?: number
}

/**
 * 按 device_link + 设备当前状态刷新业务批次进度缓存。
 */
export async function refreshBatchProgress(
  businessBatchId: string,
  tx?: DbTx,
  syncedAt = new Date(),
  progressFlagsPatch?: RetireProgressFlags,
): Promise<BatchProgressResult> {
  supplierLog('batch-progress', 'refresh start', { businessBatchId })

  const run = async (runner: DbTx) => {
    const [batch] = await runner
      .select({
        id: onboardingBatch.id,
        batchKind: onboardingBatch.batchKind,
        batchStatus: onboardingBatch.batchStatus,
        plannedDeviceCount: onboardingBatch.plannedDeviceCount,
        progressFlagsJson: onboardingBatch.progressFlagsJson,
      })
      .from(onboardingBatch)
      .where(eq(onboardingBatch.id, businessBatchId))
      .limit(1)

    if (!batch) {
      supplierWarn('batch-progress', 'refresh skipped: batch not found', { businessBatchId })
      return { touched: 0, online: 0, onboarding: 0 }
    }

    if (batch.batchKind === 'device_retire') {
      return refreshDeviceRetireBatchProgress(runner, batch, syncedAt, progressFlagsPatch)
    }

    if (batch.batchKind === 'internal_occupancy') {
      return refreshInternalOccupancyBatchProgress(runner, batch, syncedAt)
    }

    if (!['online', 'order_access'].includes(batch.batchKind)) {
      supplierWarn('batch-progress', 'refresh skipped: unsupported batch kind', {
        businessBatchId,
        batchKind: batch.batchKind,
      })
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

    await appendBatchProgressEvent({
      batchId: businessBatchId,
      eventType: 'progress_synced',
      occurredAt: syncedAt,
      tx: runner,
      payload: { source: 'system' },
    })

    supplierLog('batch-progress', 'refresh done (onboarding)', {
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

async function refreshDeviceRetireBatchProgress(
  runner: DbTx,
  batch: {
    id: string
    batchStatus: string
    plannedDeviceCount: number
    progressFlagsJson: unknown
  },
  syncedAt: Date,
  progressFlagsPatch?: RetireProgressFlags,
): Promise<BatchProgressResult> {
  const [counts] = await runner
    .select({
      touched: sql<number>`count(distinct ${onboardingBatchDeviceLink.supplierDeviceId})::int`.mapWith(
        Number,
      ),
      retired: sql<number>`count(distinct ${onboardingBatchDeviceLink.supplierDeviceId}) filter (where ${supplierDevice.lifecycleStatus} in ('下线中', '退订') or ${supplierDevice.opsStatus} = '已退订')::int`.mapWith(
        Number,
      ),
    })
    .from(onboardingBatchDeviceLink)
    .innerJoin(
      supplierDevice,
      eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id),
    )
    .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batch.id))

  const touched = counts?.touched ?? 0
  const retired = counts?.retired ?? 0
  const planned = batch.plannedDeviceCount

  let progressFlags = mergeRetireProgressFlags(
    batch.progressFlagsJson as RetireProgressFlags | null,
    progressFlagsPatch ?? {},
  )

  if (planned > 0 && touched > planned) {
    progressFlags = mergeRetireProgressFlags(progressFlags, { has_over_plan_link: true })
  }

  const prevStatus = batch.batchStatus
  let batchStatus = batch.batchStatus
  if (planned > 0 && touched >= planned) {
    batchStatus = '已完成'
    progressFlags = mergeRetireProgressFlags(progressFlags, { completion_mode: 'auto' })
  } else if (touched > 0 && batchStatus === '待开始') {
    batchStatus = '下架中'
  }

  await runner
    .update(onboardingBatch)
    .set({
      touchedDeviceCount: touched,
      retiredDeviceCount: retired,
      batchStatus,
      progressFlagsJson: progressFlags,
      progressSyncedAt: syncedAt,
      updatedAt: syncedAt,
    })
    .where(eq(onboardingBatch.id, batch.id))

  if (batchStatus !== prevStatus) {
    await appendBatchProgressEvent({
      batchId: batch.id,
      eventType: 'status_changed',
      occurredAt: syncedAt,
      tx: runner,
      payload: { source: 'system', from: prevStatus, to: batchStatus },
    })
    if (batchStatus === '已完成') {
      await appendBatchProgressEvent({
        batchId: batch.id,
        eventType: 'batch_completed',
        occurredAt: syncedAt,
        tx: runner,
        payload: { source: 'system' },
      })
    }
  }

  await appendBatchProgressEvent({
    batchId: batch.id,
    eventType: 'progress_synced',
    occurredAt: syncedAt,
    tx: runner,
    payload: { source: 'system' },
  })

    supplierLog('batch-progress', 'refresh done (device_retire)', {
    businessBatchId: batch.id,
    touched,
    retired,
    planned,
    batchStatus,
    progressFlags,
  })

  return { touched, online: 0, onboarding: 0, retired }
}

async function refreshInternalOccupancyBatchProgress(
  runner: DbTx,
  batch: {
    id: string
    batchStatus: string
    plannedDeviceCount: number
  },
  syncedAt: Date,
): Promise<BatchProgressResult> {
  const [counts] = await runner
    .select({
      touched: sql<number>`count(distinct ${onboardingBatchDeviceLink.supplierDeviceId})::int`.mapWith(
        Number,
      ),
    })
    .from(onboardingBatchDeviceLink)
    .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batch.id))

  const touched = counts?.touched ?? 0
  const planned = batch.plannedDeviceCount

  const prevStatus = batch.batchStatus
  let batchStatus = batch.batchStatus
  if (planned > 0 && touched >= planned) {
    batchStatus = '已完成'
  } else if (touched > 0 && batchStatus === '待开始') {
    batchStatus = '占用中'
  }

  await runner
    .update(onboardingBatch)
    .set({
      touchedDeviceCount: touched,
      progressSyncedAt: syncedAt,
      updatedAt: syncedAt,
      batchStatus,
    })
    .where(eq(onboardingBatch.id, batch.id))

  if (batchStatus !== prevStatus) {
    await appendBatchProgressEvent({
      batchId: batch.id,
      eventType: 'status_changed',
      occurredAt: syncedAt,
      tx: runner,
      payload: { source: 'system', from: prevStatus, to: batchStatus },
    })
    if (batchStatus === '已完成') {
      await appendBatchProgressEvent({
        batchId: batch.id,
        eventType: 'batch_completed',
        occurredAt: syncedAt,
        tx: runner,
        payload: { source: 'system' },
      })
    }
  }

  await appendBatchProgressEvent({
    batchId: batch.id,
    eventType: 'progress_synced',
    occurredAt: syncedAt,
    tx: runner,
    payload: { source: 'system' },
  })

  supplierLog('batch-progress', 'refresh done (internal_occupancy)', {
    businessBatchId: batch.id,
    touched,
    planned,
    batchStatus,
  })

  return { touched, online: 0, onboarding: 0 }
}

export { ONBOARDING_LIFECYCLES }
