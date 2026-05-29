import { db } from '@/lib/db'
import { DASHBOARD_BATCH_BOUNDARY_CHANGE_ACTIONS, globalKpiDaily } from '@workspace/db/schema'
import {
  aggregateGpuTargetAt,
  buildGpuTargetTrend,
  LIFECYCLE_ORDER,
  normalizeCardKey,
  OVERVIEW_POOL_FOOTNOTE,
} from '@/lib/server/aggregation/overview-aggregation'
import {
  computePipelineGapsAt,
  loadInternalHoldDeviceIds,
} from '@/lib/server/aggregation/pipeline-period-replay'
import {
  aggregateEntityCompositionBuckets,
  buildResourceCompositionPayload,
  type CompositionDeviceInput,
  compositionGpuDeltas,
} from '@/lib/server/aggregation/resource-composition-aggregation'
import { supplierOverviewDataAccess } from '@/lib/server/dataaccess/supplier/overview'
import { isDualPool, resolveDevicePoolMemberships } from '@/lib/supplier/device-pool-membership'
import { metricGpuCount, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import type {
  GlobalDashboardFilters,
  GlobalDashboardPeriod,
  GlobalKpiItem,
  GlobalKpiKey,
  GlobalKpiTrendPoint,
  GlobalLifecycleStagePeriod,
  GlobalPeriodInput,
  GlobalResourcePoolSlice,
} from '@/lib/types/global-dashboard-api'
import type { OverviewFiltersInput } from '@/lib/types/supplier-overview-api'
import {
  faultIncident,
  gpuCardType,
  resourcePoolBinding,
  supplierDevice,
  supplierDeviceChangeLog,
} from '@workspace/db/schema'
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm'

import { globalOpsDataAccess } from './global-ops'
import { loadGpuTargetPlanBatches } from './gpu-target'
import {
  bucketDurationHours,
  buildPeriodBuckets,
  formatDateKey,
  type PeriodBucket,
  type PeriodGranularity,
} from './period-time'

const BATCH_BOUNDARY = new Set<string>(DASHBOARD_BATCH_BOUNDARY_CHANGE_ACTIONS)

type DeviceBase = {
  id: string
  supplierId: string
  dataCenterId: string | null
  gpuCount: number
  lifecycleStatus: string
  opsStatus: string
  inMaintenance: boolean
  cardTypeName: string
  cardTypeCode?: string | null
  cardTypeRole?: import('@/lib/supplier/gpu-card-type-metrics').GpuCardTypeRole
  cardTypeKey: string
}

type ReplayState = {
  lifecycleStatus: string
  opsStatus: string
  inMaintenance: boolean
}

type PoolBinding = { poolCode: string | null; workloadProfile: string }

type Aggregates = {
  totalGpu: number
  totalDevices: number
  online: { gpu: number; devices: number }
  pendingAccess: { gpu: number; devices: number }
  onboarding: { gpu: number; devices: number }
  maintenance: { gpu: number; devices: number }
  retiring: { gpu: number; devices: number }
  elasticGpu: number
  bareMetalGpu: number
  dualPoolGpu: number
  internalTestGpu: number
  pendingAccessDcIds: Set<string>
  lifecycle: Record<string, { gpu: number; devices: number }>
  poolCardHours: { elastic: number; bareMetal: number; machineHoursElastic: number; machineHoursBare: number }
  poolBreakdown: Map<string, { elastic: number; bareMetal: number; machineHours: number; cardHours: number }>
}

function toOverviewFilters(filters: GlobalDashboardFilters): OverviewFiltersInput {
  return {
    region: filters.region ?? 'all',
    supplierId: filters.supplierId ?? 'all',
    cardType: filters.cardType ?? 'all',
    poolCode: 'all',
  }
}

function matchesDeviceFilters(
  d: DeviceBase,
  filters: GlobalDashboardFilters,
): boolean {
  if (filters.supplierId && filters.supplierId !== 'all' && d.supplierId !== filters.supplierId) {
    return false
  }
  if (filters.dataCenterId && d.dataCenterId !== filters.dataCenterId) return false
  if (filters.cardType && filters.cardType !== 'all') {
    if (d.cardTypeKey !== normalizeCardKey(filters.cardType)) return false
  }
  return true
}

function isOnlineState(s: ReplayState): boolean {
  return s.lifecycleStatus === '在线' && !s.inMaintenance
}

function emptyAggregates(): Aggregates {
  const lifecycle: Aggregates['lifecycle'] = {}
  for (const stage of LIFECYCLE_ORDER) {
    lifecycle[stage] = { gpu: 0, devices: 0 }
  }
  return {
    totalGpu: 0,
    totalDevices: 0,
    online: { gpu: 0, devices: 0 },
    pendingAccess: { gpu: 0, devices: 0 },
    onboarding: { gpu: 0, devices: 0 },
    maintenance: { gpu: 0, devices: 0 },
    retiring: { gpu: 0, devices: 0 },
    elasticGpu: 0,
    bareMetalGpu: 0,
    dualPoolGpu: 0,
    internalTestGpu: 0,
    pendingAccessDcIds: new Set(),
    lifecycle,
    poolCardHours: { elastic: 0, bareMetal: 0, machineHoursElastic: 0, machineHoursBare: 0 },
    poolBreakdown: new Map(),
  }
}

function aggregateAt(
  devices: DeviceBase[],
  states: Map<string, ReplayState>,
  bindingsByDevice: Map<string, PoolBinding[]>,
  internalTestGpu: number,
  bucketHours: number,
): Aggregates {
  const agg = emptyAggregates()
  agg.internalTestGpu = internalTestGpu

  for (const d of devices) {
    const s = states.get(d.id)
    if (!s) continue
    const gpu = metricGpuCount(d)
    agg.totalDevices += 1
    agg.totalGpu += gpu

    const bindings = bindingsByDevice.get(d.id) ?? []
    const memberships = resolveDevicePoolMemberships(s.opsStatus)

    if (LIFECYCLE_ORDER.includes(s.lifecycleStatus as (typeof LIFECYCLE_ORDER)[number])) {
      const bucket = agg.lifecycle[s.lifecycleStatus]!
      bucket.gpu += gpu
      bucket.devices += 1
    }

    if (s.lifecycleStatus === '待接入') {
      agg.pendingAccess.gpu += gpu
      agg.pendingAccess.devices += 1
      if (d.dataCenterId) agg.pendingAccessDcIds.add(d.dataCenterId)
    }
    if (s.lifecycleStatus === '接入中') {
      agg.onboarding.gpu += gpu
      agg.onboarding.devices += 1
    }
    if (s.lifecycleStatus === '维护中' || s.inMaintenance) {
      agg.maintenance.gpu += gpu
      agg.maintenance.devices += 1
    }
    if (s.lifecycleStatus === '下线中') {
      agg.retiring.gpu += gpu
      agg.retiring.devices += 1
    }
    if (isOnlineState(s)) {
      agg.online.gpu += gpu
      agg.online.devices += 1
    }

    if (memberships.has('elastic_service')) {
      agg.elasticGpu += gpu
      if (isOnlineState(s)) {
        agg.poolCardHours.elastic += gpu * bucketHours
        agg.poolCardHours.machineHoursElastic += bucketHours
      }
    }
    if (memberships.has('bare_metal')) {
      agg.bareMetalGpu += gpu
      if (isOnlineState(s)) {
        agg.poolCardHours.bareMetal += gpu * bucketHours
        agg.poolCardHours.machineHoursBare += bucketHours
      }
    }
    if (isDualPool(memberships)) agg.dualPoolGpu += gpu

    if (isOnlineState(s) && (memberships.has('elastic_service') || memberships.has('bare_metal'))) {
      const bd = agg.poolBreakdown.get(d.cardTypeName) ?? {
        elastic: 0,
        bareMetal: 0,
        machineHours: 0,
        cardHours: 0,
      }
      if (memberships.has('elastic_service')) {
        bd.elastic += gpu
        bd.cardHours += gpu * bucketHours
        bd.machineHours += bucketHours
      }
      if (memberships.has('bare_metal')) {
        bd.bareMetal += gpu
        if (!memberships.has('elastic_service')) {
          bd.cardHours += gpu * bucketHours
          bd.machineHours += bucketHours
        }
      }
      agg.poolBreakdown.set(d.cardTypeName, bd)
    }
  }

  return agg
}

function formatNetChange(delta: number, unit: string): { label: string; up: boolean } {
  if (delta === 0) return { label: `0 ${unit}`, up: true }
  const sign = delta > 0 ? '+' : ''
  return { label: `${sign}${delta.toLocaleString()} ${unit}`, up: delta >= 0 }
}

function buildPeriodKpis(
  end: Aggregates,
  start: Aggregates,
  trends: Record<GlobalKpiKey, GlobalKpiTrendPoint[]>,
  abnormalEnd: number,
  abnormalInPeriod: number,
  gpuTarget: { end: number; start: number },
): GlobalKpiItem[] {
  const items: Array<{
    key: GlobalKpiKey
    title: string
    unit: string
    endGpu: number
    endDevices: number
    startGpu: number
    startDevices: number
    netUnit: string
    warning?: boolean
    href?: string
    useAbnormalPeriod?: boolean
  }> = [
    {
      key: 'gpu_total',
      title: 'GPU 总卡数',
      unit: '卡',
      endGpu: end.totalGpu,
      endDevices: end.totalDevices,
      startGpu: start.totalGpu,
      startDevices: start.totalDevices,
      netUnit: '卡',
      href: '/supplier/overview',
    },
    {
      key: 'device_online',
      title: '在线设备',
      unit: '卡 · 台',
      endGpu: end.online.gpu,
      endDevices: end.online.devices,
      startGpu: start.online.gpu,
      startDevices: start.online.devices,
      netUnit: '卡',
      href: '/supplier/overview',
    },
    {
      key: 'pool_elastic',
      title: '弹性资源池',
      unit: '卡',
      endGpu: end.elasticGpu,
      endDevices: 0,
      startGpu: start.elasticGpu,
      startDevices: 0,
      netUnit: '卡',
    },
    {
      key: 'pool_bare_metal',
      title: '裸金属池',
      unit: '卡',
      endGpu: end.bareMetalGpu,
      endDevices: 0,
      startGpu: start.bareMetalGpu,
      startDevices: 0,
      netUnit: '卡',
    },
    {
      key: 'internal_test',
      title: '内部占用',
      unit: '卡',
      endGpu: end.internalTestGpu,
      endDevices: 0,
      startGpu: start.internalTestGpu,
      startDevices: 0,
      netUnit: '卡',
    },
    {
      key: 'device_abnormal',
      title: '异常设备',
      unit: '台',
      endGpu: 0,
      endDevices: abnormalEnd,
      startGpu: 0,
      startDevices: 0,
      netUnit: '台',
      warning: abnormalEnd > 0,
      useAbnormalPeriod: true,
    },
    {
      key: 'device_pending_access',
      title: '待接入设备',
      unit: '卡 · 台',
      endGpu: end.pendingAccess.gpu,
      endDevices: end.pendingAccess.devices,
      startGpu: start.pendingAccess.gpu,
      startDevices: start.pendingAccess.devices,
      netUnit: '台',
      warning: end.pendingAccess.devices > 0,
      href: '/supplier/overview',
    },
    {
      key: 'idc_pending_access',
      title: '待接入机房',
      unit: '个',
      endGpu: 0,
      endDevices: end.pendingAccessDcIds.size,
      startGpu: 0,
      startDevices: start.pendingAccessDcIds.size,
      netUnit: '个',
      warning: end.pendingAccessDcIds.size > 0,
    },
  ]

  return items.map((row) => {
    const netGpu = row.endGpu - row.startGpu
    const netDev = row.endDevices - row.startDevices
    const net = row.useAbnormalPeriod
      ? abnormalInPeriod
      : row.unit.includes('台') && !row.unit.includes('卡 ·')
        ? netDev
        : netGpu
    const netFmt = formatNetChange(net, row.netUnit)
    const periodPrimary =
      row.key === 'gpu_total'
        ? `${row.endGpu.toLocaleString()} 卡 · 目标 ${gpuTarget.end.toLocaleString()} 卡`
        : row.unit === '卡 · 台'
        ? `${row.endGpu.toLocaleString()} 卡 · ${row.endDevices.toLocaleString()} 台`
        : row.unit === '台' || row.unit === '个'
          ? row.endDevices.toLocaleString()
          : row.endGpu.toLocaleString()

    const targetNet = gpuTarget.end - gpuTarget.start
    const targetNetFmt = formatNetChange(targetNet, '卡')
    const netChangeLabel =
      row.key === 'gpu_total'
        ? `净增 ${netFmt.label} · 目标 ${targetNetFmt.label}`
        : `净增 ${netFmt.label}`

    return {
      key: row.key,
      title: row.title,
      unit: row.unit,
      metric:
        row.unit === '卡 · 台'
          ? { gpuCount: row.endGpu, deviceCount: row.endDevices }
          : row.unit === '台' || row.unit === '个'
            ? { gpuCount: 0, deviceCount: row.endDevices }
            : { gpuCount: row.endGpu, deviceCount: row.endDevices },
      warning: row.warning,
      href: row.href,
      periodPrimary: `${periodPrimary}`,
      netChangeLabel,
      netChangeUp: row.key === 'gpu_total' ? net >= 0 && targetNet >= 0 : netFmt.up,
      trend: trends[row.key] ?? [],
      targetGpuCount: row.key === 'gpu_total' ? gpuTarget.end : undefined,
    }
  })
}

async function loadReplayContext(filters: GlobalDashboardFilters) {
  const deviceRows = await db
    .select({
      id: supplierDevice.id,
      supplierId: supplierDevice.supplierId,
      dataCenterId: supplierDevice.dataCenterId,
      gpuCount: supplierDevice.gpuCount,
      lifecycleStatus: supplierDevice.lifecycleStatus,
      opsStatus: supplierDevice.opsStatus,
      inMaintenance: supplierDevice.inMaintenance,
      cardTypeName: gpuCardType.name,
      cardTypeCode: gpuCardType.code,
      cardTypeDeviceRole: gpuCardType.deviceRole,
    })
    .from(supplierDevice)
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))

  const devices: DeviceBase[] = deviceRows
    .map((d) => ({
      ...d,
      cardTypeKey: normalizeCardKey(d.cardTypeName),
      cardTypeRole: resolveGpuCardTypeRole({
        name: d.cardTypeName,
        code: d.cardTypeCode,
        deviceRole: d.cardTypeDeviceRole,
      }),
    }))
    .filter((d) => matchesDeviceFilters(d, filters))

  const deviceIds = devices.map((d) => d.id)

  const poolBindingRows = await db
    .select({
      deviceId: resourcePoolBinding.supplierDeviceId,
      poolCode: resourcePoolBinding.poolCode,
      workloadProfile: resourcePoolBinding.workloadProfile,
    })
    .from(resourcePoolBinding)

  const bindingsByDevice = new Map<string, PoolBinding[]>()
  for (const b of poolBindingRows) {
    if (!deviceIds.includes(b.deviceId)) continue
    const list = bindingsByDevice.get(b.deviceId) ?? []
    list.push({ poolCode: b.poolCode, workloadProfile: b.workloadProfile })
    bindingsByDevice.set(b.deviceId, list)
  }

  return { devices, bindingsByDevice }
}

async function loadChangeLogs(deviceIds: string[], beforeEnd: Date) {
  if (deviceIds.length === 0) return []
  return db
    .select({
      deviceId: supplierDeviceChangeLog.supplierDeviceId,
      occurredAt: supplierDeviceChangeLog.occurredAt,
      changeAction: supplierDeviceChangeLog.changeAction,
      newLifecycleStatus: supplierDeviceChangeLog.newLifecycleStatus,
      newOpsStatus: supplierDeviceChangeLog.newOpsStatus,
      previousLifecycleStatus: supplierDeviceChangeLog.previousLifecycleStatus,
      previousOpsStatus: supplierDeviceChangeLog.previousOpsStatus,
    })
    .from(supplierDeviceChangeLog)
    .where(
      and(
        inArray(supplierDeviceChangeLog.supplierDeviceId, deviceIds),
        lte(supplierDeviceChangeLog.occurredAt, beforeEnd),
      ),
    )
    .orderBy(asc(supplierDeviceChangeLog.occurredAt))
}

function buildInitialStates(
  devices: DeviceBase[],
  logs: Awaited<ReturnType<typeof loadChangeLogs>>,
  at: Date,
): Map<string, ReplayState> {
  const lastBefore = new Map<string, (typeof logs)[number]>()
  for (const log of logs) {
    if (log.occurredAt.getTime() > at.getTime()) continue
    if (BATCH_BOUNDARY.has(log.changeAction)) continue
    lastBefore.set(log.deviceId, log)
  }

  const states = new Map<string, ReplayState>()
  for (const d of devices) {
    const log = lastBefore.get(d.id)
    if (log?.newLifecycleStatus) {
      states.set(d.id, {
        lifecycleStatus: log.newLifecycleStatus,
        opsStatus: log.newOpsStatus ?? d.opsStatus,
        inMaintenance: d.inMaintenance,
      })
    } else {
      states.set(d.id, {
        lifecycleStatus: d.lifecycleStatus,
        opsStatus: d.opsStatus,
        inMaintenance: d.inMaintenance,
      })
    }
  }
  return states
}

function applyLogsUntil(
  base: Map<string, ReplayState>,
  logs: Awaited<ReturnType<typeof loadChangeLogs>>,
  until: Date,
): Map<string, ReplayState> {
  const states = new Map(base)
  for (const log of logs) {
    if (log.occurredAt.getTime() > until.getTime()) break
    if (BATCH_BOUNDARY.has(log.changeAction)) continue
    if (!log.newLifecycleStatus) continue
    states.set(log.deviceId, {
      lifecycleStatus: log.newLifecycleStatus,
      opsStatus: log.newOpsStatus ?? states.get(log.deviceId)?.opsStatus ?? '',
      inMaintenance: states.get(log.deviceId)?.inMaintenance ?? false,
    })
  }
  return states
}

type FaultReplayRow = {
  supplierDeviceId: string | null
  openedAt: Date
  closedAt: Date | null
}

function countAbnormalDevicesAt(
  faults: FaultReplayRow[],
  filteredDeviceIds: Set<string>,
  at: Date,
): number {
  const ids = new Set<string>()
  const t = at.getTime()
  for (const fault of faults) {
    if (!fault.supplierDeviceId || !filteredDeviceIds.has(fault.supplierDeviceId)) continue
    if (fault.openedAt.getTime() > t) continue
    if (fault.closedAt && fault.closedAt.getTime() <= t) continue
    ids.add(fault.supplierDeviceId)
  }
  return ids.size
}

async function loadFaultIncidentsForReplay(deviceIds: string[], periodEnd: Date) {
  if (deviceIds.length === 0) return []
  return db
    .select({
      supplierDeviceId: faultIncident.supplierDeviceId,
      openedAt: faultIncident.openedAt,
      closedAt: faultIncident.closedAt,
    })
    .from(faultIncident)
    .where(
      and(inArray(faultIncident.supplierDeviceId, deviceIds), lte(faultIncident.openedAt, periodEnd)),
    )
}

function computeLifecycleThroughput(
  logs: Awaited<ReturnType<typeof loadChangeLogs>>,
  periodStart: Date,
  periodEnd: Date,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const stage of LIFECYCLE_ORDER) counts[stage] = 0

  for (const log of logs) {
    const t = log.occurredAt.getTime()
    if (t < periodStart.getTime() || t > periodEnd.getTime()) continue
    if (BATCH_BOUNDARY.has(log.changeAction)) continue
    const stage = log.newLifecycleStatus
    const prev = log.previousLifecycleStatus
    if (!stage || !(LIFECYCLE_ORDER as readonly string[]).includes(stage)) continue
    if (prev !== stage) counts[stage] = (counts[stage] ?? 0) + 1
  }
  return counts
}

async function tryDailyKpiTrend(
  metricKey: string,
  buckets: PeriodBucket[],
): Promise<GlobalKpiTrendPoint[] | null> {
  if (buckets.length === 0) return null
  const startDate = formatDateKey(buckets[0]!.start)
  const endDate = formatDateKey(buckets[buckets.length - 1]!.end)
  const rows = await db
    .select({
      snapshotDate: globalKpiDaily.snapshotDate,
      gpuCount: globalKpiDaily.gpuCount,
      valueNumeric: globalKpiDaily.valueNumeric,
    })
    .from(globalKpiDaily)
    .where(
      and(
        eq(globalKpiDaily.metricKey, metricKey),
        gte(globalKpiDaily.snapshotDate, startDate),
        lte(globalKpiDaily.snapshotDate, endDate),
      ),
    )

  if (rows.length === 0) return null

  const byDate = new Map(rows.map((r) => [r.snapshotDate, r.gpuCount ?? Number(r.valueNumeric)]))
  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    value: byDate.get(b.key) ?? 0,
  }))
}

export async function computeGlobalPeriod(input: GlobalPeriodInput): Promise<GlobalDashboardPeriod> {
  const filters: GlobalDashboardFilters = {
    region: input.region ?? 'all',
    cardType: input.cardType ?? 'all',
    dataCenterId: input.dataCenterId,
    supplierId: input.supplierId,
  }

  const periodStart = new Date(input.periodStart)
  const periodEnd = new Date(input.periodEnd)
  const granularity: PeriodGranularity = input.granularity
  const view: 'daily' | 'hourly' = granularity === 'day' ? 'daily' : 'hourly'
  const buckets = buildPeriodBuckets(granularity, periodStart, periodEnd)
  const bucketH = bucketDurationHours(granularity)

  const overviewStats = await supplierOverviewDataAccess.getStats(toOverviewFilters(filters))
  const internalTestGpu = overviewStats.kpis.internalTestGpu

  const targetPlanBatches = await loadGpuTargetPlanBatches({
    createdBefore: periodEnd,
    supplierId: filters.supplierId,
  })
  const targetFilters = {
    region: filters.region ?? 'all',
    cardType: filters.cardType ?? 'all',
    supplierId: filters.supplierId ?? 'all',
    dataCenterId: filters.dataCenterId,
  }
  const gpuTargetEnd = aggregateGpuTargetAt(targetPlanBatches, periodEnd, targetFilters)
  const gpuTargetStart = aggregateGpuTargetAt(
    targetPlanBatches,
    new Date(periodStart.getTime() - 1),
    targetFilters,
  )
  const gpuTargetTrend = buildGpuTargetTrend(targetPlanBatches, buckets, targetFilters)

  const { devices, bindingsByDevice } = await loadReplayContext(filters)
  const deviceIds = devices.map((d) => d.id)
  const allLogs = await loadChangeLogs(deviceIds, periodEnd)

  const statesAtStart = buildInitialStates(devices, allLogs, new Date(periodStart.getTime() - 1))
  const statesAtEnd = applyLogsUntil(statesAtStart, allLogs, periodEnd)

  const aggStart = aggregateAt(devices, statesAtStart, bindingsByDevice, internalTestGpu, 0)
  const aggEnd = aggregateAt(devices, statesAtEnd, bindingsByDevice, internalTestGpu, 0)

  const throughput = computeLifecycleThroughput(allLogs, periodStart, periodEnd)

  const filteredDeviceIds = new Set(deviceIds)
  const faultRows = await loadFaultIncidentsForReplay(deviceIds, periodEnd)

  const trendKeys: GlobalKpiKey[] = [
    'gpu_total',
    'device_online',
    'pool_elastic',
    'pool_bare_metal',
    'internal_test',
    'device_abnormal',
    'device_pending_access',
    'idc_pending_access',
  ]

  const trends: Record<GlobalKpiKey, GlobalKpiTrendPoint[]> = {} as Record<
    GlobalKpiKey,
    GlobalKpiTrendPoint[]
  >

  for (const key of trendKeys) {
    if (granularity === 'day') {
      const fromDws = await tryDailyKpiTrend(key, buckets)
      if (fromDws) {
        trends[key] = fromDws
        continue
      }
    }
    trends[key] = []
    for (const bucket of buckets) {
      const states = applyLogsUntil(statesAtStart, allLogs, bucket.end)
      const agg = aggregateAt(devices, states, bindingsByDevice, internalTestGpu, 0)
      let value = 0
      switch (key) {
        case 'gpu_total':
          value = agg.totalGpu
          break
        case 'device_online':
          value = agg.online.gpu
          break
        case 'pool_elastic':
          value = agg.elasticGpu
          break
        case 'pool_bare_metal':
          value = agg.bareMetalGpu
          break
        case 'internal_test':
          value = agg.internalTestGpu
          break
        case 'device_abnormal':
          value = countAbnormalDevicesAt(faultRows, filteredDeviceIds, bucket.end)
          break
        case 'device_pending_access':
          value = agg.pendingAccess.devices
          break
        case 'idc_pending_access':
          value = agg.pendingAccessDcIds.size
          break
        default:
          break
      }
      trends[key].push({ key: bucket.key, label: bucket.label, value })
    }
  }

  const snapshot = await globalOpsDataAccess.getSnapshot(filters)
  const abnormalEnd = snapshot.kpis.find((k) => k.key === 'device_abnormal')?.metric.deviceCount ?? 0

  const periodFaults = await db
    .select({ id: faultIncident.id })
    .from(faultIncident)
    .where(
      and(gte(faultIncident.openedAt, periodStart), lte(faultIncident.openedAt, periodEnd)),
    )
  const faultsInPeriodCount = periodFaults.length

  const kpis = buildPeriodKpis(
    aggEnd,
    aggStart,
    trends,
    abnormalEnd,
    faultsInPeriodCount,
    { end: gpuTargetEnd, start: gpuTargetStart },
  )

  const gpuTotalKpi = kpis.find((k) => k.key === 'gpu_total')
  if (gpuTotalKpi && gpuTargetTrend.length >= 2) {
    gpuTotalKpi.trend = gpuTargetTrend
  }

  const lifecycleFunnel: GlobalLifecycleStagePeriod[] = LIFECYCLE_ORDER.map((stage) => {
    const endBucket = aggEnd.lifecycle[stage]!
    const tp = throughput[stage] ?? 0
    return {
      stage,
      gpuCount: endBucket.gpu,
      deviceCount: endBucket.devices,
      warn: (stage === '待接入' || stage === '接入中') && endBucket.devices > 0,
      throughputDeviceCount: tp,
      secondaryLabel: '本期吞吐',
      secondaryValue: `${tp} 台`,
    }
  })

  let totalCardHours = 0
  const poolSlices: GlobalResourcePoolSlice[] = [
    {
      key: 'elastic_service',
      label: '弹性用量池',
      gpuCount: 0,
      deviceCount: 0,
      cardHours: 0,
      machineHours: 0,
    },
    {
      key: 'bare_metal',
      label: '裸金属池',
      gpuCount: 0,
      deviceCount: 0,
      cardHours: 0,
      machineHours: 0,
    },
  ]

  const breakdownAcc = new Map<string, { machineHours: number; cardHours: number }>()

  for (const bucket of buckets) {
    const states = applyLogsUntil(statesAtStart, allLogs, bucket.end)
    const agg = aggregateAt(devices, states, bindingsByDevice, internalTestGpu, bucketH)
    poolSlices[0]!.cardHours! += agg.poolCardHours.elastic
    poolSlices[0]!.machineHours! += agg.poolCardHours.machineHoursElastic
    poolSlices[1]!.cardHours! += agg.poolCardHours.bareMetal
    poolSlices[1]!.machineHours! += agg.poolCardHours.machineHoursBare
    for (const [cardType, v] of agg.poolBreakdown) {
      const cur = breakdownAcc.get(cardType) ?? { machineHours: 0, cardHours: 0 }
      cur.machineHours += v.machineHours
      cur.cardHours += v.cardHours
      breakdownAcc.set(cardType, cur)
    }
  }

  totalCardHours = (poolSlices[0]!.cardHours ?? 0) + (poolSlices[1]!.cardHours ?? 0)

  const endStates = applyLogsUntil(statesAtStart, allLogs, periodEnd)
  const endPoolAgg = aggregateAt(devices, endStates, bindingsByDevice, internalTestGpu, 0)
  poolSlices[0]!.gpuCount = endPoolAgg.elasticGpu
  poolSlices[1]!.gpuCount = endPoolAgg.bareMetalGpu

  const breakdownPeriod = Array.from(breakdownAcc.entries()).map(([cardType, v]) => ({
    cardType,
    machineHours: Math.round(v.machineHours * 10) / 10,
    cardHours: Math.round(v.cardHours),
  }))

  poolSlices[0]!.breakdownPeriod = breakdownPeriod
  poolSlices[1]!.breakdownPeriod = breakdownPeriod

  const startCardHours =
    (aggStart.poolCardHours.elastic + aggStart.poolCardHours.bareMetal) * buckets.length * bucketH
  poolSlices[0]!.netChangeLabel = formatNetChange(
    Math.round((poolSlices[0]!.cardHours ?? 0) - aggStart.poolCardHours.elastic * buckets.length * bucketH),
    '卡时',
  ).label
  poolSlices[1]!.netChangeLabel = formatNetChange(
    Math.round((poolSlices[1]!.cardHours ?? 0) - aggStart.poolCardHours.bareMetal * buckets.length * bucketH),
    '卡时',
  ).label

  let compare: GlobalDashboardPeriod['compare']
  if (input.comparePrevious) {
    compare = {
      kpis: kpis.map((k) => ({
        key: k.key,
        netChangeLabel: k.netChangeLabel ?? '净增 0',
      })),
    }
  }

  const internalHoldDeviceIds = await loadInternalHoldDeviceIds()
  const periodStartAt = new Date(periodStart.getTime() - 1)

  const toCompositionDevices = (states: Map<string, ReplayState>): CompositionDeviceInput[] => {
    const out: CompositionDeviceInput[] = []
    for (const d of devices) {
      const s = states.get(d.id)
      if (!s) continue
      out.push({
        id: d.id,
        gpuCount: d.gpuCount,
        lifecycleStatus: s.lifecycleStatus,
        opsStatus: s.opsStatus,
        inMaintenance: s.inMaintenance,
        cardTypeName: d.cardTypeName,
        cardTypeCode: d.cardTypeCode,
        cardTypeRole: d.cardTypeRole,
      })
    }
    return out
  }

  const endEntityBuckets = aggregateEntityCompositionBuckets(
    toCompositionDevices(statesAtEnd),
    internalHoldDeviceIds,
  )
  const startEntityBuckets = aggregateEntityCompositionBuckets(
    toCompositionDevices(statesAtStart),
    internalHoldDeviceIds,
  )

  const overviewFilters = toOverviewFilters(filters)
  const [pipelineEnd, pipelineStart] = await Promise.all([
    computePipelineGapsAt(overviewFilters, periodEnd),
    computePipelineGapsAt(overviewFilters, periodStartAt),
  ])

  const periodGpuDeltas = compositionGpuDeltas(
    endEntityBuckets,
    startEntityBuckets,
    pipelineEnd.pendingAccess,
    pipelineStart.pendingAccess,
    pipelineEnd.retiring,
    pipelineStart.retiring,
  )

  const totalEndGpu =
    Object.values(endEntityBuckets).reduce((s, b) => s + b.gpuCount, 0) +
    pipelineEnd.pendingAccess.gpuCount +
    pipelineEnd.retiring.gpuCount
  const totalStartGpu =
    Object.values(startEntityBuckets).reduce((s, b) => s + b.gpuCount, 0) +
    pipelineStart.pendingAccess.gpuCount +
    pipelineStart.retiring.gpuCount

  const resourceComposition = buildResourceCompositionPayload({
    entityBuckets: endEntityBuckets,
    pendingAccessPipeline: pipelineEnd.pendingAccess,
    retiringPipeline: pipelineEnd.retiring,
    displayUnit: 'gpu_cards',
    periodGpuDeltas,
    centerSecondary: `净增 ${formatNetChange(totalEndGpu - totalStartGpu, '卡').label}`,
  })

  const periodAlerts = snapshot.alerts

  return {
    meta: {
      asOf: periodEnd.toISOString(),
      timezone: 'Asia/Shanghai',
      filters,
      view,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      granularity,
      comparePrevious: input.comparePrevious ?? false,
    },
    kpis,
    lifecycleFunnel,
    resourceComposition,
    resourcePools: {
      displayUnit: 'card_hours',
      slices: poolSlices,
      dualPoolGpu: endPoolAgg.dualPoolGpu,
      poolOccupancyGpu: totalCardHours,
      centerPrimary: `${Math.round(totalCardHours).toLocaleString()} 卡时`,
      centerSecondary: `净增 ${formatNetChange(totalCardHours - startCardHours, '卡时').label}`,
      footnote: OVERVIEW_POOL_FOOTNOTE,
    },
    clusters: snapshot.clusters,
    discrepancies: snapshot.discrepancies,
    alerts: periodAlerts,
    todos: snapshot.todos,
    compare,
  }
}
