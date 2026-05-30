/**
 * 批次进度事件追加（M1）
 * @see global-dashboard-period-composition-m1-progress-event.md
 */

import { db } from '@/lib/db'
import { metricGpuCount, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import {
  gpuCardType,
  onboardingBatch,
  onboardingBatchDeviceLink,
  onboardingBatchProgressEvent,
  supplierDevice,
} from '@workspace/db/schema'
import { desc, eq } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type BatchProgressEventType =
  | 'batch_created'
  | 'plan_revised'
  | 'progress_synced'
  | 'status_changed'
  | 'batch_completed'
  | 'batch_cancelled'

export type BatchProgressEventPayload = {
  source?: 'manual_ui' | 'system' | 'changelog'
  reason?: string
  activity_id?: string
  operator_staff_id?: string
  diff?: Record<string, [unknown, unknown]>
  [key: string]: unknown
}

export type AppendBatchProgressEventInput = {
  batchId: string
  eventType: BatchProgressEventType
  occurredAt?: Date
  payload?: BatchProgressEventPayload
  tx?: DbTx
}

export type AppendBatchProgressEventResult = {
  inserted: boolean
  eventId?: string
}

function newId() {
  return crypto.randomUUID()
}

async function sumTouchedPipelineGpu(runner: DbTx, batchId: string): Promise<number> {
  const links = await runner
    .select({
      gpuCount: supplierDevice.gpuCount,
      cardTypeName: gpuCardType.name,
      cardTypeCode: gpuCardType.code,
      cardTypeDeviceRole: gpuCardType.deviceRole,
    })
    .from(onboardingBatchDeviceLink)
    .innerJoin(supplierDevice, eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id))
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batchId))

  return links.reduce(
    (sum, link) =>
      sum +
      metricGpuCount({
        gpuCount: link.gpuCount,
        cardTypeName: link.cardTypeName,
        cardTypeCode: link.cardTypeCode,
        cardTypeRole: resolveGpuCardTypeRole({
          name: link.cardTypeName,
          code: link.cardTypeCode,
          deviceRole: link.cardTypeDeviceRole,
        }),
      }),
    0,
  )
}

type LastEventSnap = {
  eventType: string
  batchStatus: string
  plannedDeviceCount: number
  plannedGpuCount: number
  touchedDeviceCount: number
  touchedPipelineGpu: number
}

async function loadLastEventSnap(runner: DbTx, batchId: string): Promise<LastEventSnap | null> {
  const [last] = await runner
    .select({
      eventType: onboardingBatchProgressEvent.eventType,
      batchStatus: onboardingBatchProgressEvent.batchStatus,
      plannedDeviceCount: onboardingBatchProgressEvent.plannedDeviceCount,
      plannedGpuCount: onboardingBatchProgressEvent.plannedGpuCount,
      touchedDeviceCount: onboardingBatchProgressEvent.touchedDeviceCount,
      touchedPipelineGpu: onboardingBatchProgressEvent.touchedPipelineGpu,
    })
    .from(onboardingBatchProgressEvent)
    .where(eq(onboardingBatchProgressEvent.onboardingBatchId, batchId))
    .orderBy(desc(onboardingBatchProgressEvent.occurredAt))
    .limit(1)

  return last ?? null
}

function shouldSkipProgressSynced(
  last: LastEventSnap | null,
  snap: LastEventSnap,
): boolean {
  if (!last) return false
  return (
    last.plannedDeviceCount === snap.plannedDeviceCount &&
    last.plannedGpuCount === snap.plannedGpuCount &&
    last.touchedDeviceCount === snap.touchedDeviceCount &&
    last.touchedPipelineGpu === snap.touchedPipelineGpu &&
    last.batchStatus === snap.batchStatus
  )
}

export async function appendBatchProgressEvent(
  input: AppendBatchProgressEventInput,
): Promise<AppendBatchProgressEventResult> {
  const occurredAt = input.occurredAt ?? new Date()

  const run = async (runner: DbTx): Promise<AppendBatchProgressEventResult> => {
    const [batch] = await runner
      .select()
      .from(onboardingBatch)
      .where(eq(onboardingBatch.id, input.batchId))
      .limit(1)

    if (!batch) {
      supplierError('batch-progress-event', 'batch not found', new Error('批次不存在'), {
        batchId: input.batchId,
      })
      throw new Error('批次不存在')
    }

    const touchedPipelineGpu = await sumTouchedPipelineGpu(runner, input.batchId)
    const snap: LastEventSnap = {
      eventType: input.eventType,
      batchStatus: batch.batchStatus,
      plannedDeviceCount: batch.plannedDeviceCount,
      plannedGpuCount: batch.plannedGpuCount,
      touchedDeviceCount: batch.touchedDeviceCount,
      touchedPipelineGpu,
    }

    if (
      input.eventType === 'progress_synced' &&
      shouldSkipProgressSynced(await loadLastEventSnap(runner, input.batchId), snap)
    ) {
      supplierWarn('batch-progress-event', 'progress_synced skipped (unchanged)', {
        batchId: input.batchId,
      })
      return { inserted: false }
    }

    const eventId = newId()
    await runner.insert(onboardingBatchProgressEvent).values({
      id: eventId,
      onboardingBatchId: batch.id,
      occurredAt,
      eventType: input.eventType,
      batchKind: batch.batchKind,
      batchStatus: batch.batchStatus,
      plannedDeviceCount: batch.plannedDeviceCount,
      plannedGpuCount: batch.plannedGpuCount,
      touchedDeviceCount: batch.touchedDeviceCount,
      touchedPipelineGpu,
      supplierId: batch.supplierId,
      dataCenterId: batch.dataCenterId,
      idcRegion: batch.idcRegion,
      payload: input.payload ?? null,
    })

    supplierLog('batch-progress-event', 'appended', {
      batchId: input.batchId,
      eventType: input.eventType,
      eventId,
      occurredAt: occurredAt.toISOString(),
    })

    return { inserted: true, eventId }
  }

  try {
    if (input.tx) {
      return await run(input.tx)
    }
    return await db.transaction(async (trx) => run(trx))
  } catch (e) {
    supplierError('batch-progress-event', 'append failed', e, {
      batchId: input.batchId,
      eventType: input.eventType,
    })
    throw e
  }
}

export const BATCH_PROGRESS_EVENT_TYPE_LABELS: Record<BatchProgressEventType, string> = {
  batch_created: '批次创建',
  plan_revised: '计划修订',
  progress_synced: '进度同步',
  status_changed: '状态变更',
  batch_completed: '批次完成',
  batch_cancelled: '批次取消',
}
