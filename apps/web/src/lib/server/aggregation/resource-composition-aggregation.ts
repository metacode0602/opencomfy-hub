/**
 * 全局大盘 — 资源构成饼图（互斥分桶 + 计划虚拟量）
 * @see apps/web/content/design/global-dashboard-resource-composition-chart-design.md
 */

import {
  isDualPool,
  resolveDevicePoolMemberships,
} from '@/lib/supplier/device-pool-membership'
import { metricGpuCount } from '@/lib/supplier/gpu-card-type-metrics'
import type {
  GlobalResourceCompositionPayload,
  GlobalResourceCompositionSlice,
  ResourceCompositionDisplayUnit,
} from '@/lib/types/global-dashboard-api'

import {
  NON_SCHEDULABLE_OPS,
  OTHER_DEPT_OPS,
  RESERVED_IDLE_OPS,
  TERMINAL_BATCH_STATUSES,
  type OverviewDeviceRow,
  aggregatePipelinePending,
  computePipelinePendingGap,
  type PipelineBatchInput,
  type PipelinePendingGap,
} from './overview-aggregation'

export const RESOURCE_COMPOSITION_FOOTNOTE =
  '实体分桶互斥（维护中 > 下架中 > 待接入 > … > 池拓扑）；双池为独立扇区。待接入/下架中「计划缺口」来自进行中批次 planned−touched，无 device_id。库存级 internal_test hold 可能未计入设备扇区。'

/** Period 卡时模式脚注（专篇 §13） */
export const RESOURCE_COMPOSITION_PERIOD_CARD_HOURS_FOOTNOTE =
  '实体卡时/台时：由设备主数据导入与定时扫描写入的快照/状态时序积分；互斥分桶规则与 Snapshot 一致。计划缺口卡时/台时：由进行中批次的 planned−touched 对时间积分；设备变更表仅刷新批次进度，不驱动池/维护/下架等实体扇区。供应侧卡时非租户账单消费卡时。库存级 internal_test hold 可能未计入设备扇区。历史批次缺口在进度事件回填完成前，计划卡时可能标记为近似值。'

export const RESOURCE_COMPOSITION_BUCKET_KEYS = [
  'pending_access_pipeline',
  'pending_access_entity',
  'reserved_idle',
  'pool_elastic_only',
  'pool_bare_metal_only',
  'pool_dual',
  'internal_occupancy',
  'non_schedulable',
  'maintenance',
  'retiring_entity',
  'retiring_pipeline',
  'other',
] as const

export type ResourceCompositionBucketKey = (typeof RESOURCE_COMPOSITION_BUCKET_KEYS)[number]

const SLICE_META: Record<
  ResourceCompositionBucketKey,
  { label: string; kind: 'entity' | 'pipeline_virtual' }
> = {
  pending_access_pipeline: { label: '待接入 · 计划缺口', kind: 'pipeline_virtual' },
  pending_access_entity: { label: '待接入 · 已入库', kind: 'entity' },
  reserved_idle: { label: '预留闲置', kind: 'entity' },
  pool_elastic_only: { label: '仅弹性池', kind: 'entity' },
  pool_bare_metal_only: { label: '仅裸金属池', kind: 'entity' },
  pool_dual: { label: '双池', kind: 'entity' },
  internal_occupancy: { label: '内部占用', kind: 'entity' },
  non_schedulable: { label: '不可调度', kind: 'entity' },
  maintenance: { label: '维护中', kind: 'entity' },
  retiring_entity: { label: '下架中 · 已挂接', kind: 'entity' },
  retiring_pipeline: { label: '下架中 · 计划未挂接', kind: 'pipeline_virtual' },
  other: { label: '其他', kind: 'entity' },
}

export type CompositionDeviceInput = Pick<
  OverviewDeviceRow,
  | 'id'
  | 'gpuCount'
  | 'lifecycleStatus'
  | 'opsStatus'
  | 'inMaintenance'
  | 'cardTypeName'
  | 'cardTypeCode'
  | 'cardTypeRole'
>

export function isDeviceExcludedFromComposition(device: {
  lifecycleStatus: string
  opsStatus: string
}): boolean {
  return device.lifecycleStatus === '退订' || device.opsStatus === '已退订'
}

export function classifyDeviceExclusiveBucket(
  device: CompositionDeviceInput,
  internalHoldDeviceIds: ReadonlySet<string>,
): ResourceCompositionBucketKey {
  if (isDeviceExcludedFromComposition(device)) {
    throw new Error('classifyDeviceExclusiveBucket: excluded device')
  }

  if (device.lifecycleStatus === '维护中' || device.inMaintenance) {
    return 'maintenance'
  }
  if (device.lifecycleStatus === '下线中' && device.opsStatus !== '已退订') {
    return 'retiring_entity'
  }
  if (device.lifecycleStatus === '待接入') {
    return 'pending_access_entity'
  }
  if (RESERVED_IDLE_OPS.includes(device.opsStatus as (typeof RESERVED_IDLE_OPS)[number])) {
    return 'reserved_idle'
  }
  if (
    OTHER_DEPT_OPS.includes(device.opsStatus as (typeof OTHER_DEPT_OPS)[number]) ||
    internalHoldDeviceIds.has(device.id)
  ) {
    return 'internal_occupancy'
  }
  if (NON_SCHEDULABLE_OPS.includes(device.opsStatus as (typeof NON_SCHEDULABLE_OPS)[number])) {
    return 'non_schedulable'
  }

  const memberships = resolveDevicePoolMemberships(device.opsStatus)
  if (isDualPool(memberships)) return 'pool_dual'
  if (memberships.has('elastic_service')) return 'pool_elastic_only'
  if (memberships.has('bare_metal')) return 'pool_bare_metal_only'

  return 'other'
}

type BucketAcc = {
  gpuCount: number
  deviceCount: number
  byCardType: Map<string, number>
}

function emptyBuckets(): Record<ResourceCompositionBucketKey, BucketAcc> {
  const out = {} as Record<ResourceCompositionBucketKey, BucketAcc>
  for (const key of RESOURCE_COMPOSITION_BUCKET_KEYS) {
    out[key] = { gpuCount: 0, deviceCount: 0, byCardType: new Map() }
  }
  return out
}

export function aggregateEntityCompositionBuckets(
  devices: CompositionDeviceInput[],
  internalHoldDeviceIds: ReadonlySet<string>,
): Record<ResourceCompositionBucketKey, BucketAcc> {
  const buckets = emptyBuckets()

  for (const device of devices) {
    if (isDeviceExcludedFromComposition(device)) continue
    const key = classifyDeviceExclusiveBucket(device, internalHoldDeviceIds)
    const gpu = metricGpuCount(device)
    const bucket = buckets[key]
    bucket.gpuCount += gpu
    bucket.deviceCount += 1
    if (gpu > 0 && device.cardTypeName) {
      bucket.byCardType.set(
        device.cardTypeName,
        (bucket.byCardType.get(device.cardTypeName) ?? 0) + gpu,
      )
    }
  }

  return buckets
}

export function aggregateRetirePipelinePending(
  batches: PipelineBatchInput[],
): PipelinePendingGap {
  return aggregatePipelinePending(batches)
}

export type BatchPipelineReplayRow = PipelineBatchInput & {
  createdAt: Date
  updatedAt: Date
  batchStatus: string
}

export function isBatchActiveAt(batch: BatchPipelineReplayRow, at: Date): boolean {
  const t = at.getTime()
  if (batch.createdAt.getTime() > t) return false
  if (
    (TERMINAL_BATCH_STATUSES as readonly string[]).includes(batch.batchStatus) &&
    batch.updatedAt.getTime() <= t
  ) {
    return false
  }
  return true
}

export function aggregatePipelinePendingAt(
  batches: BatchPipelineReplayRow[],
  touchedDeviceCountByBatchId: Map<string, number>,
  touchedGpuByBatchId: Map<string, number>,
  at: Date,
  batchKinds: readonly string[],
): PipelinePendingGap {
  return batches
    .filter((b) => batchKinds.includes(b.batchKind) && isBatchActiveAt(b, at))
    .reduce(
      (acc, batch) => {
        const gap = computePipelinePendingGap({
          ...batch,
          touchedDeviceCount: touchedDeviceCountByBatchId.get(batch.id) ?? 0,
          touchedPipelineGpu: touchedGpuByBatchId.get(batch.id) ?? 0,
        })
        acc.deviceCount += gap.deviceCount
        acc.gpuCount += gap.gpuCount
        return acc
      },
      { deviceCount: 0, gpuCount: 0 },
    )
}

function formatNetChange(delta: number, unit: string): string {
  if (delta === 0) return `0 ${unit}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${unit}`
}

export type EntityCardHoursByBucket = Partial<
  Record<
    ResourceCompositionBucketKey,
    {
      cardHours: number
      machineHours: number
      byCardType: Map<string, { cardHours: number; machineHours: number }>
    }
  >
>

export type PipelineCardHoursSlice = { cardHours: number; machineHours: number }

export function buildResourceCompositionPayload(input: {
  entityBuckets: Record<ResourceCompositionBucketKey, BucketAcc>
  pendingAccessPipeline: PipelinePendingGap
  retiringPipeline: PipelinePendingGap
  displayUnit?: ResourceCompositionDisplayUnit
  periodGpuDeltas?: Partial<Record<ResourceCompositionBucketKey, number>>
  periodCardHoursDeltas?: Partial<Record<ResourceCompositionBucketKey, number>>
  entityCardHours?: EntityCardHoursByBucket
  pipelineCardHours?: {
    pendingAccess: PipelineCardHoursSlice
    retiring: PipelineCardHoursSlice
  }
  centerSecondary?: string
  footnote?: string
  approximate?: boolean
}): GlobalResourceCompositionPayload {
  const displayUnit = input.displayUnit ?? 'gpu_cards'
  const unitLabel = displayUnit === 'card_hours' ? '卡时' : '卡'
  const useCardHours = displayUnit === 'card_hours'

  const buckets = { ...input.entityBuckets }
  buckets.pending_access_pipeline.gpuCount = input.pendingAccessPipeline.gpuCount
  buckets.pending_access_pipeline.deviceCount = input.pendingAccessPipeline.deviceCount
  buckets.retiring_pipeline.gpuCount = input.retiringPipeline.gpuCount
  buckets.retiring_pipeline.deviceCount = input.retiringPipeline.deviceCount

  let denominatorGpu = 0
  let denominatorDevices = 0
  let denominatorCardHours = 0
  let denominatorMachineHours = 0

  const slices: GlobalResourceCompositionSlice[] = []

  for (const key of RESOURCE_COMPOSITION_BUCKET_KEYS) {
    const acc = buckets[key]
    const meta = SLICE_META[key]
    const hoursAcc = input.entityCardHours?.[key]
    const pipelineHours =
      key === 'pending_access_pipeline'
        ? input.pipelineCardHours?.pendingAccess
        : key === 'retiring_pipeline'
          ? input.pipelineCardHours?.retiring
          : undefined

    const sliceCardHours =
      (hoursAcc?.cardHours ?? 0) + (pipelineHours?.cardHours ?? 0)
    const sliceMachineHours =
      (hoursAcc?.machineHours ?? 0) + (pipelineHours?.machineHours ?? 0)

    const hasGpuSlice = acc.gpuCount > 0 || acc.deviceCount > 0
    const hasHoursSlice = sliceCardHours > 0 || sliceMachineHours > 0
    if (!hasGpuSlice && !hasHoursSlice) continue

    denominatorGpu += acc.gpuCount
    denominatorDevices += acc.deviceCount
    if (useCardHours) {
      denominatorCardHours += sliceCardHours
      denominatorMachineHours += sliceMachineHours
    }

    const breakdownByCardType =
      meta.kind === 'entity' && hoursAcc && hoursAcc.byCardType.size > 0 && useCardHours
        ? Array.from(hoursAcc.byCardType.entries()).map(([cardType, row]) => ({
            cardType,
            gpuCount: 0,
            deviceCount: 0,
            cardHours: Math.round(row.cardHours),
            machineHours: Math.round(row.machineHours * 10) / 10,
          }))
        : meta.kind === 'entity' && acc.byCardType.size > 0
          ? Array.from(acc.byCardType.entries()).map(([cardType, gpuCount]) => ({
              cardType,
              gpuCount,
              deviceCount: 0,
            }))
          : undefined

    const delta =
      useCardHours && input.periodCardHoursDeltas
        ? input.periodCardHoursDeltas[key]
        : input.periodGpuDeltas?.[key]

    const slice: GlobalResourceCompositionSlice = {
      key,
      label: meta.label,
      kind: meta.kind,
      gpuCount: acc.gpuCount,
      deviceCount: acc.deviceCount,
      breakdownByCardType,
    }
    if (useCardHours) {
      slice.cardHours = Math.round(sliceCardHours)
      slice.machineHours = Math.round(sliceMachineHours * 10) / 10
    }
    if (delta !== undefined) {
      slice.netChangeLabel = `净增 ${formatNetChange(delta, unitLabel)}`
    }
    slices.push(slice)
  }

  const centerPrimary = useCardHours
    ? `${Math.round(denominatorCardHours).toLocaleString()} 卡时`
    : `${denominatorGpu.toLocaleString()} 卡`

  const pipelineGpu =
    input.pendingAccessPipeline.gpuCount + input.retiringPipeline.gpuCount
  const centerSecondary =
    input.centerSecondary ??
    (useCardHours
      ? undefined
      : pipelineGpu > 0
        ? `含计划缺口 ${pipelineGpu.toLocaleString()} 卡`
        : undefined)

  return {
    displayUnit,
    denominator: useCardHours
      ? {
          gpuCount: denominatorGpu,
          deviceCount: denominatorDevices,
          cardHours: Math.round(denominatorCardHours),
          machineHours: Math.round(denominatorMachineHours * 10) / 10,
        }
      : { gpuCount: denominatorGpu, deviceCount: denominatorDevices },
    slices,
    centerPrimary,
    centerSecondary,
    footnote:
      input.footnote ??
      (useCardHours
        ? RESOURCE_COMPOSITION_PERIOD_CARD_HOURS_FOOTNOTE
        : RESOURCE_COMPOSITION_FOOTNOTE),
    approximate: input.approximate,
  }
}

export function buildResourceCompositionFromDevices(input: {
  devices: CompositionDeviceInput[]
  internalHoldDeviceIds: ReadonlySet<string>
  pendingAccessPipeline: PipelinePendingGap
  retiringPipeline: PipelinePendingGap
  displayUnit?: ResourceCompositionDisplayUnit
  periodGpuDeltas?: Partial<Record<ResourceCompositionBucketKey, number>>
}): GlobalResourceCompositionPayload {
  const entityBuckets = aggregateEntityCompositionBuckets(
    input.devices,
    input.internalHoldDeviceIds,
  )
  return buildResourceCompositionPayload({
    entityBuckets,
    pendingAccessPipeline: input.pendingAccessPipeline,
    retiringPipeline: input.retiringPipeline,
    displayUnit: input.displayUnit,
    periodGpuDeltas: input.periodGpuDeltas,
  })
}

export function compositionCardHoursDeltas(
  end: EntityCardHoursByBucket,
  start: EntityCardHoursByBucket,
  pipelineEnd: { pendingAccess: PipelineCardHoursSlice; retiring: PipelineCardHoursSlice },
  pipelineStart: { pendingAccess: PipelineCardHoursSlice; retiring: PipelineCardHoursSlice },
): Partial<Record<ResourceCompositionBucketKey, number>> {
  const deltas: Partial<Record<ResourceCompositionBucketKey, number>> = {}
  for (const key of RESOURCE_COMPOSITION_BUCKET_KEYS) {
    let endH = end[key]?.cardHours ?? 0
    let startH = start[key]?.cardHours ?? 0
    if (key === 'pending_access_pipeline') {
      endH = pipelineEnd.pendingAccess.cardHours
      startH = pipelineStart.pendingAccess.cardHours
    }
    if (key === 'retiring_pipeline') {
      endH = pipelineEnd.retiring.cardHours
      startH = pipelineStart.retiring.cardHours
    }
    const delta = Math.round(endH - startH)
    if (delta !== 0) deltas[key] = delta
  }
  return deltas
}

export function compositionGpuDeltas(
  end: Record<ResourceCompositionBucketKey, BucketAcc>,
  start: Record<ResourceCompositionBucketKey, BucketAcc>,
  pendingEnd: PipelinePendingGap,
  pendingStart: PipelinePendingGap,
  retiringEnd: PipelinePendingGap,
  retiringStart: PipelinePendingGap,
): Partial<Record<ResourceCompositionBucketKey, number>> {
  const deltas: Partial<Record<ResourceCompositionBucketKey, number>> = {}
  for (const key of RESOURCE_COMPOSITION_BUCKET_KEYS) {
    let endGpu = end[key]?.gpuCount ?? 0
    let startGpu = start[key]?.gpuCount ?? 0
    if (key === 'pending_access_pipeline') {
      endGpu = pendingEnd.gpuCount
      startGpu = pendingStart.gpuCount
    }
    if (key === 'retiring_pipeline') {
      endGpu = retiringEnd.gpuCount
      startGpu = retiringStart.gpuCount
    }
    const delta = endGpu - startGpu
    if (delta !== 0) deltas[key] = delta
  }
  return deltas
}
