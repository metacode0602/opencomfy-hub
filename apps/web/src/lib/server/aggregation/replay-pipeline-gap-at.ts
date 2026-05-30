/**
 * 计划管道缺口时点回放（progress_event + device_link）
 * @see global-dashboard-resource-composition-chart-design.md §14.6
 */

import { db } from '@/lib/db'
import { supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import { metricGpuCount, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import type { OverviewFiltersInput } from '@/lib/types/supplier-overview-api'
import {
  gpuCardType,
  onboardingBatch,
  onboardingBatchDeviceLink,
  onboardingBatchProgressEvent,
  supplierDevice,
} from '@workspace/db/schema'
import { and, eq, inArray, lte } from 'drizzle-orm'

import type { BatchProgressEventType } from './batch-progress-events'
import { isBatchActiveAt, type BatchPipelineReplayRow } from './resource-composition-aggregation'
import {
  batchMatchesCardFilter,
  batchMatchesRegionFilter,
  computePipelinePendingGap,
  normalizeCardKey,
  PIPELINE_BATCH_KINDS,
  planLineCardKeysFromJson,
  resolveBatchPlannedGpuCount,
  TERMINAL_BATCH_STATUSES,
  toPipelineBatchInput,
  type PipelinePendingGap,
} from './overview-aggregation'

const RETIRE_BATCH_KIND = 'device_retire' as const

const TERMINAL_EVENT_TYPES = new Set<BatchProgressEventType>([
  'batch_completed',
  'batch_cancelled',
])

type BatchLinkRow = {
  batchId: string
  deviceId: string
  linkedAt: Date
  gpuCount: number
  cardTypeName: string
  cardTypeCode: string | null
  cardTypeDeviceRole: string | null
}

type ProgressEventRow = {
  onboardingBatchId: string
  occurredAt: Date
  eventType: string
  batchStatus: string
  plannedDeviceCount: number
  plannedGpuCount: number
  touchedDeviceCount: number
  touchedPipelineGpu: number
  plannedLinesJson?: unknown
}

function touchedMapsAt(
  links: BatchLinkRow[],
  at: Date,
): { deviceCountByBatch: Map<string, number>; gpuByBatch: Map<string, number> } {
  const deviceIdsByBatch = new Map<string, Set<string>>()
  const gpuByBatch = new Map<string, number>()
  const t = at.getTime()

  for (const link of links) {
    if (link.linkedAt.getTime() > t) continue
    const devices = deviceIdsByBatch.get(link.batchId) ?? new Set<string>()
    if (!devices.has(link.deviceId)) {
      devices.add(link.deviceId)
      deviceIdsByBatch.set(link.batchId, devices)
    }
    const gpu = metricGpuCount({
      gpuCount: link.gpuCount,
      cardTypeName: link.cardTypeName,
      cardTypeCode: link.cardTypeCode,
      cardTypeRole: resolveGpuCardTypeRole({
        name: link.cardTypeName,
        code: link.cardTypeCode,
        deviceRole: link.cardTypeDeviceRole,
      }),
    })
    gpuByBatch.set(link.batchId, (gpuByBatch.get(link.batchId) ?? 0) + gpu)
  }

  const deviceCountByBatch = new Map<string, number>()
  for (const [batchId, ids] of deviceIdsByBatch) {
    deviceCountByBatch.set(batchId, ids.size)
  }
  return { deviceCountByBatch, gpuByBatch }
}

function lastSnapAt(
  events: ProgressEventRow[],
  batchId: string,
  at: Date,
): ProgressEventRow | null {
  let last: ProgressEventRow | null = null
  const t = at.getTime()
  for (const e of events) {
    if (e.onboardingBatchId !== batchId) continue
    if (e.occurredAt.getTime() > t) continue
    if (!last || e.occurredAt.getTime() >= last.occurredAt.getTime()) {
      last = e
    }
  }
  return last
}

function hasTerminalEventBefore(
  events: ProgressEventRow[],
  batchId: string,
  at: Date,
): boolean {
  const t = at.getTime()
  return events.some(
    (e) =>
      e.onboardingBatchId === batchId &&
      TERMINAL_EVENT_TYPES.has(e.eventType as BatchProgressEventType) &&
      e.occurredAt.getTime() <= t,
  )
}

function isBatchActiveAtReplay(
  batch: BatchPipelineReplayRow,
  events: ProgressEventRow[],
  at: Date,
): boolean {
  if (batch.createdAt.getTime() > at.getTime()) return false

  if (hasTerminalEventBefore(events, batch.id, at)) return false

  const snap = lastSnapAt(events, batch.id, at)
  const status = snap?.batchStatus ?? batch.batchStatus

  if (!(TERMINAL_BATCH_STATUSES as readonly string[]).includes(status)) return true

  if (!snap && events.filter((e) => e.onboardingBatchId === batch.id).length === 0) {
    return isBatchActiveAt(batch, at)
  }

  return batch.updatedAt.getTime() > at.getTime()
}

function aggregateGapAt(
  batches: BatchPipelineReplayRow[],
  events: ProgressEventRow[],
  deviceCountByBatch: Map<string, number>,
  gpuByBatch: Map<string, number>,
  at: Date,
  batchKinds: readonly string[],
): PipelinePendingGap {
  return batches
    .filter((b) => batchKinds.includes(b.batchKind) && isBatchActiveAtReplay(b, events, at))
    .reduce(
      (acc, batch) => {
        const snap = lastSnapAt(events, batch.id, at)
        const touchedDevices = deviceCountByBatch.get(batch.id) ?? 0
        const touchedGpu = gpuByBatch.get(batch.id) ?? 0

        if (snap) {
          const snapTouchedDevices = snap.touchedDeviceCount
          const snapTouchedGpu = snap.touchedPipelineGpu
          if (
            snapTouchedDevices !== touchedDevices ||
            snapTouchedGpu !== touchedGpu
          ) {
            supplierWarn('replay-pipeline-gap', 'touched mismatch; using link replay', {
              batchId: batch.id,
              snapTouchedDevices,
              touchedDevices,
              snapTouchedGpu,
              touchedGpu,
            })
          }
        }

        const plannedDeviceCount = snap?.plannedDeviceCount ?? batch.plannedDeviceCount
        const plannedGpuCount = snap?.plannedGpuCount ?? batch.plannedGpuCount
        const plannedLineCardKeys = batch.plannedLineCardKeys

        const gap = computePipelinePendingGap({
          ...batch,
          plannedDeviceCount,
          plannedGpuCount,
          touchedDeviceCount: touchedDevices,
          touchedPipelineGpu: touchedGpu,
          plannedLineCardKeys,
        })
        acc.deviceCount += gap.deviceCount
        acc.gpuCount += gap.gpuCount
        return acc
      },
      { deviceCount: 0, gpuCount: 0 },
    )
}

export async function replayPipelineGapAt(
  filters: OverviewFiltersInput,
  at: Date,
): Promise<{ pendingAccess: PipelinePendingGap; retiring: PipelinePendingGap }> {
  const batchConditions = [
    inArray(onboardingBatch.batchKind, [...PIPELINE_BATCH_KINDS, RETIRE_BATCH_KIND]),
    lte(onboardingBatch.createdAt, at),
  ]
  if (filters.supplierId !== 'all') {
    batchConditions.push(eq(onboardingBatch.supplierId, filters.supplierId))
  }

  const batchRows = await db
    .select({
      id: onboardingBatch.id,
      dataCenterId: onboardingBatch.dataCenterId,
      dataCenterName: onboardingBatch.dataCenterName,
      batchKind: onboardingBatch.batchKind,
      batchStatus: onboardingBatch.batchStatus,
      onlineReason: onboardingBatch.onlineReason,
      plannedDeviceCount: onboardingBatch.plannedDeviceCount,
      plannedGpuCount: onboardingBatch.plannedGpuCount,
      plannedLinesJson: onboardingBatch.plannedLinesJson,
      touchedDeviceCount: onboardingBatch.touchedDeviceCount,
      idcRegion: onboardingBatch.idcRegion,
      createdAt: onboardingBatch.createdAt,
      updatedAt: onboardingBatch.updatedAt,
    })
    .from(onboardingBatch)
    .where(and(...batchConditions))

  const cardFilterKey =
    filters.cardType !== 'all' ? normalizeCardKey(filters.cardType) : null

  const replayBatches: BatchPipelineReplayRow[] = batchRows
    .filter((b) => batchMatchesRegionFilter(b.idcRegion, b.dataCenterName, filters.region))
    .map((b) => ({
      ...toPipelineBatchInput(b, 0),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      batchStatus: b.batchStatus,
      plannedGpuCount: resolveBatchPlannedGpuCount(b),
      plannedLineCardKeys: planLineCardKeysFromJson(b.plannedLinesJson),
    }))
    .filter((b) => (cardFilterKey ? batchMatchesCardFilter(b, cardFilterKey) : true))

  const batchIds = replayBatches.map((b) => b.id)
  if (batchIds.length === 0) {
    return {
      pendingAccess: { deviceCount: 0, gpuCount: 0 },
      retiring: { deviceCount: 0, gpuCount: 0 },
    }
  }

  const eventRows = await db
    .select({
      onboardingBatchId: onboardingBatchProgressEvent.onboardingBatchId,
      occurredAt: onboardingBatchProgressEvent.occurredAt,
      eventType: onboardingBatchProgressEvent.eventType,
      batchStatus: onboardingBatchProgressEvent.batchStatus,
      plannedDeviceCount: onboardingBatchProgressEvent.plannedDeviceCount,
      plannedGpuCount: onboardingBatchProgressEvent.plannedGpuCount,
      touchedDeviceCount: onboardingBatchProgressEvent.touchedDeviceCount,
      touchedPipelineGpu: onboardingBatchProgressEvent.touchedPipelineGpu,
    })
    .from(onboardingBatchProgressEvent)
    .where(
      and(
        inArray(onboardingBatchProgressEvent.onboardingBatchId, batchIds),
        lte(onboardingBatchProgressEvent.occurredAt, at),
      ),
    )

  const linkRows = await db
    .select({
      batchId: onboardingBatchDeviceLink.businessOnboardingBatchId,
      deviceId: onboardingBatchDeviceLink.supplierDeviceId,
      linkedAt: onboardingBatchDeviceLink.linkedAt,
      gpuCount: supplierDevice.gpuCount,
      cardTypeName: gpuCardType.name,
      cardTypeCode: gpuCardType.code,
      cardTypeDeviceRole: gpuCardType.deviceRole,
    })
    .from(onboardingBatchDeviceLink)
    .innerJoin(supplierDevice, eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id))
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(inArray(onboardingBatchDeviceLink.businessOnboardingBatchId, batchIds))

  const links: BatchLinkRow[] = linkRows
    .filter((r): r is typeof r & { batchId: string } => r.batchId != null)
    .map((r) => ({
      batchId: r.batchId,
      deviceId: r.deviceId,
      linkedAt: r.linkedAt,
      gpuCount: r.gpuCount,
      cardTypeName: r.cardTypeName,
      cardTypeCode: r.cardTypeCode,
      cardTypeDeviceRole: r.cardTypeDeviceRole,
    }))

  const { deviceCountByBatch, gpuByBatch } = touchedMapsAt(links, at)

  const pendingAccess = aggregateGapAt(
    replayBatches,
    eventRows,
    deviceCountByBatch,
    gpuByBatch,
    at,
    PIPELINE_BATCH_KINDS,
  )
  const retiring = aggregateGapAt(
    replayBatches,
    eventRows,
    deviceCountByBatch,
    gpuByBatch,
    at,
    [RETIRE_BATCH_KIND],
  )

  supplierLog('replay-pipeline-gap', 'computed', {
    at: at.toISOString(),
    pendingAccess,
    retiring,
    batchCount: batchIds.length,
    eventCount: eventRows.length,
  })

  return { pendingAccess, retiring }
}
