/**
 * 资源总览 / 全局大盘共享聚合（§5.4）
 * supplier.overview.getStats 与 dashboard.globalOps.getSnapshot 共用。
 */

import {
  metricGpuCount,
  inventoryGpuQuantity,
  resolveGpuCardTypeRole,
} from '@/lib/supplier/gpu-card-type-metrics'
import { normalizeDeviceOpsStatus } from '@/lib/supplier/device-import-utils'
import type { GpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import type { OverviewKpiMetric, LifecycleFunnelStageDto } from '@/lib/types/supplier-overview-api'

export const CLOSED_FAULT_STATUSES = ['已关闭', 'closed'] as const
export const TERMINAL_BATCH_STATUSES = ['已完成', '已取消', 'cancelled'] as const

/** 目标总卡数台账：作废批次（不计入 gpu_target） */
export const VOID_BATCH_STATUSES = ['cancelled', '已取消'] as const

/** 目标总卡数：计入上架计划 */
export const TARGET_ONBOARD_BATCH_KINDS = ['online', 'order_access'] as const

/** 目标总卡数：计入下架计划 */
export const TARGET_OFFBOARD_BATCH_KIND = 'device_retire' as const

/** 计划管道叠加：进行中商务接入批次（Q1-B：online + order_access） */
export const PIPELINE_BATCH_KINDS = ['online', 'order_access'] as const

export const LIFECYCLE_ORDER = ['待接入', '接入中', '在线', '维护中', '下线中'] as const

export const BARE_METAL_DIRECT_OPS = ['网关直连裸金属上架中', '单机直连裸金属上架中'] as const
export const BARE_METAL_PROXY_OPS = ['网关代理裸金属上架中'] as const
export const OFFLINE_DELIVERY_OPS = ['线下裸金属交付中'] as const
export const GATEWAY_ONBOARDING_OPS = ['网关节点上架中'] as const
export const NON_SCHEDULABLE_OPS = ['不可调度节点运行中'] as const
export const RESERVED_IDLE_OPS = ['预留闲置中'] as const
export const OTHER_DEPT_OPS = ['其他部门使用中'] as const

/** 兼容历史/Excel 中「其它部门使用中」等别名 */
export function isOtherDeptOpsStatus(opsStatus: string): boolean {
  return (OTHER_DEPT_OPS as readonly string[]).includes(normalizeDeviceOpsStatus(opsStatus))
}

/** 开放平台区域对比：台账不计入线下裸金属交付与内部占用设备 */
export function isExcludedFromPlatformLedgerComparison(params: {
  opsStatus: string
  deviceId: string
  internalHoldDeviceIds: ReadonlySet<string>
}): boolean {
  return (
    OFFLINE_DELIVERY_OPS.includes(
      params.opsStatus as (typeof OFFLINE_DELIVERY_OPS)[number],
    ) ||
    isOtherDeptOpsStatus(params.opsStatus) ||
    params.internalHoldDeviceIds.has(params.deviceId)
  )
}

export const DEFAULT_GPU_PER_DEVICE = 8

/** §5.4.6 表底口径说明 */
export const OVERVIEW_POOL_FOOTNOTE =
  '裸金属池 / 弹性池 / 双池由设备主数据「设备状态」映射；在集群中仅计弹性池；代理裸金属稳态保持「网关代理裸金属上架中」；维修中不改变池归属；双池可重叠计数'

export type OverviewDeviceRow = {
  id: string
  supplierId: string
  dataCenterId: string | null
  gpuCount: number
  lifecycleStatus: string
  opsStatus: string
  inMaintenance: boolean
  idcRegion: string | null
  cardTypeName: string
  cardTypeCode?: string | null
  cardTypeRole?: GpuCardTypeRole
}

export type PipelineBatchInput = {
  id: string
  dataCenterId: string
  batchKind: string
  onlineReason: string | null
  plannedDeviceCount: number
  plannedGpuCount: number
  touchedDeviceCount: number
  touchedPipelineGpu: number
  plannedLineCardKeys?: string[]
}

export type PipelinePendingGap = {
  deviceCount: number
  gpuCount: number
}

export type PlanLineEntry = {
  gpuCardTypeCode: string
  plannedQuantity: number
}

export function parsePlanLineEntries(plannedLinesJson: unknown): PlanLineEntry[] {
  const raw = (plannedLinesJson as Array<Record<string, unknown>> | null) ?? []
  const entries: PlanLineEntry[] = []
  for (const line of raw) {
    const code =
      (typeof line.gpuCardTypeCode === 'string' && line.gpuCardTypeCode) ||
      (typeof line.gpu_card_type_code === 'string' && line.gpu_card_type_code) ||
      ''
    const qtyRaw = line.plannedQuantity ?? line.planned_quantity
    const plannedQuantity =
      typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw ?? 0)
    if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) continue
    entries.push({ gpuCardTypeCode: code, plannedQuantity })
  }
  return entries
}

export function plannedGpuFromPlanLinesJson(
  plannedLinesJson: unknown,
  plannedDeviceCount: number,
  gpuPerDevice = DEFAULT_GPU_PER_DEVICE,
): number {
  const lines = parsePlanLineEntries(plannedLinesJson)
  if (lines.length === 0) {
    return Math.max(0, plannedDeviceCount) * gpuPerDevice
  }
  return lines.reduce((sum, line) => sum + line.plannedQuantity * gpuPerDevice, 0)
}

export function planLineCardKeysFromJson(plannedLinesJson: unknown): string[] {
  return parsePlanLineEntries(plannedLinesJson)
    .map((line) => normalizeCardKey(line.gpuCardTypeCode))
    .filter((key) => key.length > 0)
}

export function resolveBatchPlannedGpuCount(batch: {
  plannedDeviceCount: number
  plannedGpuCount?: number | null
  plannedLinesJson: unknown
}): number {
  if (batch.plannedGpuCount != null && batch.plannedGpuCount > 0) {
    return batch.plannedGpuCount
  }
  return plannedGpuFromPlanLinesJson(batch.plannedLinesJson, batch.plannedDeviceCount)
}

export function toPipelineBatchInput(
  batch: {
    id: string
    dataCenterId: string
    batchKind: string
    onlineReason: string | null
    plannedDeviceCount: number
    plannedGpuCount?: number | null
    touchedDeviceCount: number | null
    plannedLinesJson: unknown
  },
  touchedPipelineGpu: number,
): PipelineBatchInput {
  const plannedGpuCount = resolveBatchPlannedGpuCount(batch)
  return {
    id: batch.id,
    dataCenterId: batch.dataCenterId,
    batchKind: batch.batchKind,
    onlineReason: batch.onlineReason,
    plannedDeviceCount: batch.plannedDeviceCount,
    plannedGpuCount,
    touchedDeviceCount: batch.touchedDeviceCount ?? 0,
    touchedPipelineGpu,
    plannedLineCardKeys: planLineCardKeysFromJson(batch.plannedLinesJson),
  }
}

export function normalizeCardKey(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function regionFromDc(location: string | null, dcName: string): string {
  if (location?.trim()) return location.trim()
  if (dcName.includes('北京')) return '北京'
  if (dcName.includes('上海')) return '上海'
  if (dcName.includes('深圳') || dcName.includes('广州')) return '华南'
  if (dcName.includes('内蒙古')) return '内蒙古'
  return '其他'
}

export function batchMatchesRegionFilter(
  batchIdcRegion: string | null,
  batchDataCenterName: string,
  filterRegion: string,
): boolean {
  if (filterRegion === 'all') return true
  return regionFromDc(batchIdcRegion, batchDataCenterName) === filterRegion
}

export type TargetPlanBatch = {
  batchKind: string
  batchStatus: string
  supplierId: string
  dataCenterId: string
  dataCenterName: string
  idcRegion: string | null
  plannedDeviceCount: number
  plannedGpuCount: number | null
  plannedLinesJson: unknown
  plannedLineCardKeys: string[]
  createdAt: Date
  updatedAt: Date
}

export type TargetPlanBatchFilters = {
  region?: string
  cardType?: string
  supplierId?: string
  dataCenterId?: string
}

export function isVoidBatchStatus(status: string): boolean {
  return (VOID_BATCH_STATUSES as readonly string[]).includes(status)
}

export function matchesTargetPlanBatch(
  batch: TargetPlanBatch,
  filters: TargetPlanBatchFilters,
): boolean {
  if (
    filters.supplierId &&
    filters.supplierId !== 'all' &&
    batch.supplierId !== filters.supplierId
  ) {
    return false
  }
  if (filters.dataCenterId && batch.dataCenterId !== filters.dataCenterId) return false
  if (
    filters.region &&
    filters.region !== 'all' &&
    !batchMatchesRegionFilter(batch.idcRegion, batch.dataCenterName, filters.region)
  ) {
    return false
  }
  const cardFilter =
    filters.cardType && filters.cardType !== 'all'
      ? normalizeCardKey(filters.cardType)
      : null
  if (cardFilter) {
    if (!batch.plannedLineCardKeys.length) return false
    if (!batch.plannedLineCardKeys.some((key) => key === cardFilter)) return false
  }
  return true
}

/** 批次在时刻 T 是否仍计入目标台账（创建后、作废前） */
export function isTargetBatchEffectiveAt(batch: TargetPlanBatch, at: Date): boolean {
  const atMs = at.getTime()
  if (batch.createdAt.getTime() > atMs) return false
  if (isVoidBatchStatus(batch.batchStatus) && batch.updatedAt.getTime() <= atMs) {
    return false
  }
  return true
}

export function signedPlannedGpuForTarget(batch: TargetPlanBatch): number {
  const gpu = resolveBatchPlannedGpuCount(batch)
  return batch.batchKind === TARGET_OFFBOARD_BATCH_KIND ? -gpu : gpu
}

export function aggregateGpuTargetAt(
  batches: TargetPlanBatch[],
  at: Date,
  filters: TargetPlanBatchFilters,
): number {
  let sum = 0
  for (const batch of batches) {
    if (!matchesTargetPlanBatch(batch, filters)) continue
    if (!isTargetBatchEffectiveAt(batch, at)) continue
    sum += signedPlannedGpuForTarget(batch)
  }
  return sum
}

export function buildGpuTargetTrend(
  batches: TargetPlanBatch[],
  buckets: Array<{ key: string; label: string; end: Date }>,
  filters: TargetPlanBatchFilters,
): Array<{ key: string; label: string; value: number }> {
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: aggregateGpuTargetAt(batches, bucket.end, filters),
  }))
}

export function parseGpuScopeCount(scope: string | null, fallback = 4): number {
  if (!scope) return fallback
  const range = scope.match(/gpu\s*(\d+)\s*-\s*gpu\s*(\d+)/i)
  if (range) {
    const start = Number(range[1])
    const end = Number(range[2])
    return Math.max(0, end - start + 1)
  }
  const single = scope.match(/gpu\s*(\d+)/i)
  if (single) return 1
  return fallback
}

export function isHoldActive(holdFrom: Date, holdUntil: Date | null, at = Date.now()): boolean {
  const from = holdFrom.getTime()
  const until = holdUntil?.getTime() ?? null
  if (at < from) return false
  if (until != null && at > until) return false
  return true
}

export function isRetiredOverviewDevice(d: OverviewDeviceRow): boolean {
  return d.lifecycleStatus === '退订' || d.opsStatus === '已退订'
}

export function isComputeOverviewDevice(d: OverviewDeviceRow): boolean {
  const role =
    d.cardTypeRole ??
    resolveGpuCardTypeRole({ name: d.cardTypeName, code: d.cardTypeCode })
  return role !== 'infra'
}

export function kpiFromDevices(
  devices: OverviewDeviceRow[],
  pred: (d: OverviewDeviceRow) => boolean,
  options?: { computeDevicesOnly?: boolean },
): OverviewKpiMetric {
  const matched = devices.filter(pred)
  const counted = options?.computeDevicesOnly
    ? matched.filter(isComputeOverviewDevice)
    : matched
  return {
    deviceCount: counted.length,
    gpuCount: matched.reduce((sum, d) => sum + metricGpuCount(d), 0),
  }
}

export function normalizeLifecycleStage(status: string): (typeof LIFECYCLE_ORDER)[number] {
  if ((LIFECYCLE_ORDER as readonly string[]).includes(status)) {
    return status as (typeof LIFECYCLE_ORDER)[number]
  }
  return '待接入'
}

export function effectivePlannedGpuCount(batch: {
  plannedGpuCount: number
  plannedDeviceCount: number
  plannedLinesJson?: unknown
}): number {
  if (batch.plannedGpuCount > 0) return batch.plannedGpuCount
  if (batch.plannedLinesJson != null) {
    return plannedGpuFromPlanLinesJson(batch.plannedLinesJson, batch.plannedDeviceCount)
  }
  return batch.plannedDeviceCount * DEFAULT_GPU_PER_DEVICE
}

export function computePipelinePendingGap(batch: PipelineBatchInput): PipelinePendingGap {
  const plannedGpu = effectivePlannedGpuCount(batch)
  return {
    deviceCount: Math.max(0, batch.plannedDeviceCount - batch.touchedDeviceCount),
    gpuCount: Math.max(0, plannedGpu - batch.touchedPipelineGpu),
  }
}

export function aggregatePipelinePending(batches: PipelineBatchInput[]): PipelinePendingGap {
  return batches.reduce(
    (acc, batch) => {
      const gap = computePipelinePendingGap(batch)
      acc.deviceCount += gap.deviceCount
      acc.gpuCount += gap.gpuCount
      return acc
    },
    { deviceCount: 0, gpuCount: 0 },
  )
}

export function aggregatePipelinePendingByDataCenter(
  batches: PipelineBatchInput[],
): Map<string, PipelinePendingGap> {
  const map = new Map<string, PipelinePendingGap>()
  for (const batch of batches) {
    const gap = computePipelinePendingGap(batch)
    if (gap.deviceCount <= 0 && gap.gpuCount <= 0) continue
    const existing = map.get(batch.dataCenterId) ?? { deviceCount: 0, gpuCount: 0 }
    existing.deviceCount += gap.deviceCount
    existing.gpuCount += gap.gpuCount
    map.set(batch.dataCenterId, existing)
  }
  return map
}

export function mergeKpiMetric(
  entity: OverviewKpiMetric,
  pipeline: PipelinePendingGap,
): OverviewKpiMetric {
  return {
    deviceCount: entity.deviceCount + pipeline.deviceCount,
    gpuCount: entity.gpuCount + pipeline.gpuCount,
  }
}

export function batchMatchesCardFilter(batch: PipelineBatchInput, cardTypeKey: string): boolean {
  if (!batch.plannedLineCardKeys?.length) return false
  return batch.plannedLineCardKeys.some((key) => key === cardTypeKey)
}

export function computePendingAccessDataCenterIds(
  devices: OverviewDeviceRow[],
  batches: PipelineBatchInput[],
): string[] {
  const ids = new Set<string>()
  for (const d of devices) {
    if (d.lifecycleStatus === '待接入' && d.dataCenterId) {
      ids.add(d.dataCenterId)
    }
  }
  for (const batch of batches) {
    if (batch.batchKind === 'online' && batch.onlineReason === 'new_idc') {
      ids.add(batch.dataCenterId)
    }
  }
  return Array.from(ids)
}

export function buildLifecycleFunnel(
  devices: OverviewDeviceRow[],
  pipelinePending?: PipelinePendingGap,
): LifecycleFunnelStageDto[] {
  const lifecycleBuckets: Record<string, { gpu: number; devices: number }> = {}
  for (const stage of LIFECYCLE_ORDER) {
    lifecycleBuckets[stage] = { gpu: 0, devices: 0 }
  }
  for (const d of devices) {
    const key = normalizeLifecycleStage(d.lifecycleStatus)
    const bucket = lifecycleBuckets[key]!
    bucket.gpu += metricGpuCount(d)
    bucket.devices += 1
  }

  if (pipelinePending && (pipelinePending.deviceCount > 0 || pipelinePending.gpuCount > 0)) {
    const pendingBucket = lifecycleBuckets['待接入']!
    pendingBucket.gpu += pipelinePending.gpuCount
    pendingBucket.devices += pipelinePending.deviceCount
  }

  return LIFECYCLE_ORDER.map((stage) => ({
    stage,
    gpuCount: lifecycleBuckets[stage]?.gpu ?? 0,
    deviceCount: lifecycleBuckets[stage]?.devices ?? 0,
    warn:
      (stage === '待接入' || stage === '接入中') &&
      (lifecycleBuckets[stage]?.devices ?? 0) > 0,
  }))
}
