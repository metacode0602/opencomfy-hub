/**
 * Period 下计划管道缺口时点回放（无批次事件表时的 v1 实现）
 * @see global-dashboard-resource-composition-chart-design.md §14.6
 */

import { db } from '@/lib/db'
import { metricGpuCount, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import type { OverviewFiltersInput } from '@/lib/types/supplier-overview-api'
import {
  gpuCardType,
  internalTestHold,
  internalTestHoldDeviceLink,
  onboardingBatch,
  onboardingBatchDeviceLink,
  supplierDevice,
} from '@workspace/db/schema'
import { and, eq, inArray, lte } from 'drizzle-orm'

import {
  aggregatePipelinePendingAt,
  type BatchPipelineReplayRow,
} from './resource-composition-aggregation'
import {
  batchMatchesCardFilter,
  batchMatchesRegionFilter,
  isHoldActive,
  normalizeCardKey,
  PIPELINE_BATCH_KINDS,
  toPipelineBatchInput,
  type PipelinePendingGap,
} from './overview-aggregation'

const RETIRE_BATCH_KIND = 'device_retire' as const

type BatchLinkRow = {
  batchId: string
  deviceId: string
  linkedAt: Date
  gpuCount: number
  cardTypeName: string
  cardTypeCode: string | null
  cardTypeDeviceRole: string | null
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

export async function computePipelineGapsAt(
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
    }))
    .filter((b) => (cardFilterKey ? batchMatchesCardFilter(b, cardFilterKey) : true))

  const batchIds = replayBatches.map((b) => b.id)
  if (batchIds.length === 0) {
    return {
      pendingAccess: { deviceCount: 0, gpuCount: 0 },
      retiring: { deviceCount: 0, gpuCount: 0 },
    }
  }

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

  const pendingAccess = aggregatePipelinePendingAt(
    replayBatches,
    deviceCountByBatch,
    gpuByBatch,
    at,
    PIPELINE_BATCH_KINDS,
  )
  const retiring = aggregatePipelinePendingAt(
    replayBatches,
    deviceCountByBatch,
    gpuByBatch,
    at,
    [RETIRE_BATCH_KIND],
  )

  return { pendingAccess, retiring }
}

export async function loadInternalHoldDeviceIds(): Promise<Set<string>> {
  const holds = await db
    .select({
      deviceId: internalTestHold.supplierDeviceId,
      holdFrom: internalTestHold.holdFrom,
      holdUntil: internalTestHold.holdUntil,
    })
    .from(internalTestHold)

  const holdDeviceLinkRows = await db
    .select({
      deviceId: internalTestHoldDeviceLink.supplierDeviceId,
      holdFrom: internalTestHold.holdFrom,
      holdUntil: internalTestHold.holdUntil,
    })
    .from(internalTestHoldDeviceLink)
    .innerJoin(internalTestHold, eq(internalTestHoldDeviceLink.holdId, internalTestHold.id))

  const ids = new Set<string>()
  for (const h of holds) {
    if (!isHoldActive(h.holdFrom, h.holdUntil)) continue
    if (h.deviceId) ids.add(h.deviceId)
  }
  for (const link of holdDeviceLinkRows) {
    if (!isHoldActive(link.holdFrom, link.holdUntil)) continue
    ids.add(link.deviceId)
  }
  return ids
}
