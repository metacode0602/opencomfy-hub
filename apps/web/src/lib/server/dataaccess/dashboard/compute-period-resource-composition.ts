/**
 * Period 资源构成（卡时）— 独立读路径，禁止从 getSnapshot 拼装（专篇 §6）
 * @see global-dashboard-period-composition-card-hours-design.md
 */

import { db } from '@/lib/db'
import {
  aggregateCompositionCardHoursFromSnapshots,
  type DeviceSnapshotPoint,
} from '@/lib/server/aggregation/aggregate-composition-card-hours-from-snapshots'
import { aggregatePipelineCardHoursFromGapSeries } from '@/lib/server/aggregation/aggregate-pipeline-card-hours'
import {
  computePipelineGapsAt,
  loadInternalHoldDeviceIds,
} from '@/lib/server/aggregation/pipeline-period-replay'
import {
  aggregateEntityCompositionBuckets,
  buildResourceCompositionPayload,
  type CompositionDeviceInput,
  type EntityCardHoursByBucket,
  compositionCardHoursDeltas,
} from '@/lib/server/aggregation/resource-composition-aggregation'
import { normalizeCardKey } from '@/lib/server/aggregation/overview-aggregation'
import { resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import type {
  GlobalDashboardFilters,
  GlobalResourceCompositionPayload,
} from '@/lib/types/global-dashboard-api'
import type { OverviewFiltersInput } from '@/lib/types/supplier-overview-api'
import {
  deviceDailySnapshot,
  deviceHourlySnapshot,
  gpuCardType,
} from '@workspace/db/schema'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'

import { dashboardError, dashboardLog, dashboardWarn } from './logger'
import {
  buildPeriodBuckets,
  formatDateKey,
  parseDateKey,
  type PeriodGranularity,
} from './period-time'

export type PeriodCompositionDeviceRow = {
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
}

function toOverviewFilters(filters: GlobalDashboardFilters): OverviewFiltersInput {
  return {
    region: filters.region ?? 'all',
    supplierId: filters.supplierId ?? 'all',
    cardType: filters.cardType ?? 'all',
    poolCode: 'all',
  }
}

function toCompositionDevice(row: PeriodCompositionDeviceRow): CompositionDeviceInput {
  return {
    id: row.id,
    gpuCount: row.gpuCount,
    lifecycleStatus: row.lifecycleStatus,
    opsStatus: row.opsStatus,
    inMaintenance: row.inMaintenance,
    cardTypeName: row.cardTypeName,
    cardTypeCode: row.cardTypeCode,
    cardTypeRole: row.cardTypeRole,
  }
}

function snapshotRowToDevice(
  row: {
    supplierDeviceId: string
    gpuCount: number
    lifecycleStatus: string
    opsStatus: string
    inMaintenance: boolean
    cardTypeName: string
    cardTypeCode: string | null
    cardTypeDeviceRole: string | null
  },
): CompositionDeviceInput {
  return {
    id: row.supplierDeviceId,
    gpuCount: row.gpuCount,
    lifecycleStatus: row.lifecycleStatus,
    opsStatus: row.opsStatus,
    inMaintenance: row.inMaintenance,
    cardTypeName: row.cardTypeName,
    cardTypeCode: row.cardTypeCode,
    cardTypeRole: resolveGpuCardTypeRole({
      name: row.cardTypeName,
      code: row.cardTypeCode,
      deviceRole: row.cardTypeDeviceRole,
    }),
  }
}

function buildSnapshotConditions(
  filters: GlobalDashboardFilters,
  periodStart: Date,
  periodEnd: Date,
  granularity: PeriodGranularity,
) {
  const conditions = []
  if (filters.supplierId && filters.supplierId !== 'all') {
    conditions.push(eq(deviceDailySnapshot.supplierId, filters.supplierId))
  }
  if (filters.dataCenterId) {
    conditions.push(eq(deviceDailySnapshot.dataCenterId, filters.dataCenterId))
  }

  if (granularity === 'day') {
    conditions.push(
      gte(deviceDailySnapshot.snapshotDate, formatDateKey(periodStart)),
      lte(deviceDailySnapshot.snapshotDate, formatDateKey(periodEnd)),
    )
  }
  return conditions
}

async function loadDeviceSnapshotsInPeriod(input: {
  filters: GlobalDashboardFilters
  periodStart: Date
  periodEnd: Date
  granularity: PeriodGranularity
  deviceIds: string[]
}): Promise<{ points: Map<string, DeviceSnapshotPoint[]>; rowCount: number }> {
  const points = new Map<string, DeviceSnapshotPoint[]>()
  if (input.deviceIds.length === 0) {
    return { points, rowCount: 0 }
  }

  const cardFilterKey =
    input.filters.cardType && input.filters.cardType !== 'all'
      ? normalizeCardKey(input.filters.cardType)
      : null

  const MAX_DEVICE_FILTER = 5000
  const deviceIdFilter =
    input.deviceIds.length > 0 && input.deviceIds.length <= MAX_DEVICE_FILTER
      ? input.deviceIds
      : null

  try {
    if (input.granularity === 'day') {
      const conditions = buildSnapshotConditions(
        input.filters,
        input.periodStart,
        input.periodEnd,
        'day',
      )
      if (deviceIdFilter) {
        conditions.push(inArray(deviceDailySnapshot.supplierDeviceId, deviceIdFilter))
      }

      const rows = await db
        .select({
          supplierDeviceId: deviceDailySnapshot.supplierDeviceId,
          snapshotDate: deviceDailySnapshot.snapshotDate,
          gpuCount: deviceDailySnapshot.gpuCount,
          lifecycleStatus: deviceDailySnapshot.lifecycleStatus,
          opsStatus: deviceDailySnapshot.opsStatus,
          inMaintenance: deviceDailySnapshot.inMaintenance,
          cardTypeName: gpuCardType.name,
          cardTypeCode: gpuCardType.code,
          cardTypeDeviceRole: gpuCardType.deviceRole,
        })
        .from(deviceDailySnapshot)
        .innerJoin(gpuCardType, eq(deviceDailySnapshot.gpuCardTypeId, gpuCardType.id))
        .where(and(...conditions))

      let rowCount = 0
      for (const row of rows) {
        if (cardFilterKey && normalizeCardKey(row.cardTypeName) !== cardFilterKey) continue
        if (!input.deviceIds.includes(row.supplierDeviceId)) continue
        rowCount += 1
        const at = parseDateKey(String(row.snapshotDate)) ?? input.periodStart
        const list = points.get(row.supplierDeviceId) ?? []
        list.push({ at, device: snapshotRowToDevice(row) })
        points.set(row.supplierDeviceId, list)
      }
      for (const list of points.values()) {
        list.sort((a, b) => a.at.getTime() - b.at.getTime())
      }
      return { points, rowCount }
    }

    const hourlyConditions = []
    if (input.filters.supplierId && input.filters.supplierId !== 'all') {
      hourlyConditions.push(eq(deviceHourlySnapshot.supplierId, input.filters.supplierId))
    }
    if (input.filters.dataCenterId) {
      hourlyConditions.push(eq(deviceHourlySnapshot.dataCenterId, input.filters.dataCenterId))
    }
    hourlyConditions.push(
      gte(deviceHourlySnapshot.snapshotHour, input.periodStart),
      lte(deviceHourlySnapshot.snapshotHour, input.periodEnd),
    )
    if (deviceIdFilter) {
      hourlyConditions.push(inArray(deviceHourlySnapshot.supplierDeviceId, deviceIdFilter))
    }

    const rows = await db
      .select({
        supplierDeviceId: deviceHourlySnapshot.supplierDeviceId,
        snapshotHour: deviceHourlySnapshot.snapshotHour,
        gpuCount: deviceHourlySnapshot.gpuCount,
        lifecycleStatus: deviceHourlySnapshot.lifecycleStatus,
        opsStatus: deviceHourlySnapshot.opsStatus,
        inMaintenance: deviceHourlySnapshot.inMaintenance,
        cardTypeName: gpuCardType.name,
        cardTypeCode: gpuCardType.code,
        cardTypeDeviceRole: gpuCardType.deviceRole,
      })
      .from(deviceHourlySnapshot)
      .innerJoin(gpuCardType, eq(deviceHourlySnapshot.gpuCardTypeId, gpuCardType.id))
      .where(and(...hourlyConditions))

    let rowCount = 0
    for (const row of rows) {
      if (cardFilterKey && normalizeCardKey(row.cardTypeName) !== cardFilterKey) continue
      if (!input.deviceIds.includes(row.supplierDeviceId)) continue
      rowCount += 1
      const list = points.get(row.supplierDeviceId) ?? []
      list.push({ at: row.snapshotHour, device: snapshotRowToDevice(row) })
      points.set(row.supplierDeviceId, list)
    }
    for (const list of points.values()) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime())
    }
    return { points, rowCount }
  } catch (error) {
    dashboardError('loadDeviceSnapshots', '查询设备快照失败', error, {
      granularity: input.granularity,
    })
    throw error
  }
}

function cardHoursMapFromAcc(
  acc: ReturnType<typeof aggregateCompositionCardHoursFromSnapshots>,
): EntityCardHoursByBucket {
  const out: EntityCardHoursByBucket = {}
  for (const [key, bucket] of Object.entries(acc)) {
    if (bucket.cardHours > 0 || bucket.machineHours > 0) {
      out[key as keyof EntityCardHoursByBucket] = {
        cardHours: bucket.cardHours,
        machineHours: bucket.machineHours,
        byCardType: bucket.byCardType,
      }
    }
  }
  return out
}

/**
 * Period 资源构成：实体读 device_*_snapshot（无则 approximate 回填），计划读 batch+link 阶梯。
 */
export async function computePeriodResourceComposition(input: {
  filters: GlobalDashboardFilters
  granularity: PeriodGranularity
  periodStart: Date
  periodEnd: Date
  devices: PeriodCompositionDeviceRow[]
}): Promise<GlobalResourceCompositionPayload> {
  const phase = 'computePeriodResourceComposition'
  const overviewFilters = toOverviewFilters(input.filters)
  const buckets = buildPeriodBuckets(input.granularity, input.periodStart, input.periodEnd)

  if (buckets.length === 0) {
    dashboardWarn(phase, '区间无有效时间桶', {
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
    })
    return buildResourceCompositionPayload({
      entityBuckets: aggregateEntityCompositionBuckets([], new Set()),
      pendingAccessPipeline: { deviceCount: 0, gpuCount: 0 },
      retiringPipeline: { deviceCount: 0, gpuCount: 0 },
      displayUnit: 'card_hours',
    })
  }

  const fallbackDevices = input.devices.map(toCompositionDevice)
  const deviceIds = fallbackDevices.map((d) => d.id)

  let internalHoldDeviceIds: Set<string>
  try {
    internalHoldDeviceIds = await loadInternalHoldDeviceIds()
  } catch (error) {
    dashboardError(phase, '加载 internal_test_hold 失败，按空集继续', error)
    internalHoldDeviceIds = new Set()
  }

  const { points: snapshotsByDevice, rowCount } = await loadDeviceSnapshotsInPeriod({
    filters: input.filters,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    granularity: input.granularity,
    deviceIds,
  })

  const approximate = rowCount === 0
  if (approximate) {
    dashboardWarn(phase, '区间内无设备主数据快照，使用 supplier_device 当前态恒定回填', {
      granularity: input.granularity,
      deviceCount: deviceIds.length,
    })
  } else {
    dashboardLog(phase, '已加载设备快照', {
      snapshotRows: rowCount,
      devicesWithTimeline: snapshotsByDevice.size,
      bucketCount: buckets.length,
    })
  }

  let entityCardHoursAcc: ReturnType<typeof aggregateCompositionCardHoursFromSnapshots>
  try {
    entityCardHoursAcc = aggregateCompositionCardHoursFromSnapshots({
      buckets,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      snapshotsByDevice,
      fallbackDevices,
      internalHoldDeviceIds,
    })
  } catch (error) {
    dashboardError(phase, '实体扇区卡时积分失败', error)
    throw error
  }

  const gapAtBucketStart: Array<{
    pendingAccess: { deviceCount: number; gpuCount: number }
    retiring: { deviceCount: number; gpuCount: number }
  }> = []

  try {
    for (const bucket of buckets) {
      const gap = await computePipelineGapsAt(overviewFilters, bucket.start)
      gapAtBucketStart.push(gap)
    }
  } catch (error) {
    dashboardError(phase, '计划管道缺口回放失败', error)
    throw error
  }

  let pipelineCardHours: ReturnType<typeof aggregatePipelineCardHoursFromGapSeries>
  try {
    pipelineCardHours = aggregatePipelineCardHoursFromGapSeries({
      buckets,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      gapAtBucketStart,
    })
  } catch (error) {
    dashboardError(phase, '计划扇区卡时积分失败', error)
    throw error
  }

  const periodStartAt = new Date(input.periodStart.getTime() - 1)
  const [pipelineEnd, pipelineStart] = await Promise.all([
    computePipelineGapsAt(overviewFilters, input.periodEnd),
    computePipelineGapsAt(overviewFilters, periodStartAt),
  ])

  const endEntityBuckets = aggregateEntityCompositionBuckets(
    fallbackDevices,
    internalHoldDeviceIds,
  )

  const entityCardHours = cardHoursMapFromAcc(entityCardHoursAcc)

  // 期初基线：假定期初状态恒定延续全区间（用于净增对比）
  const startCardHoursAcc = aggregateCompositionCardHoursFromSnapshots({
    buckets,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    snapshotsByDevice,
    fallbackDevices,
    internalHoldDeviceIds,
    stateAnchorAt: periodStartAt,
  })

  const startPipelineCardHours = aggregatePipelineCardHoursFromGapSeries({
    buckets,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    gapAtBucketStart: buckets.map(() => ({
      pendingAccess: pipelineStart.pendingAccess,
      retiring: pipelineStart.retiring,
    })),
  })

  const periodCardHoursDeltas = compositionCardHoursDeltas(
    cardHoursMapFromAcc(entityCardHoursAcc) ?? {},
    cardHoursMapFromAcc(startCardHoursAcc) ?? {},
    pipelineCardHours,
    startPipelineCardHours,
  )

  const totalCardHours =
    Object.values(entityCardHoursAcc).reduce((s, b) => s + b.cardHours, 0) +
    pipelineCardHours.pendingAccess.cardHours +
    pipelineCardHours.retiring.cardHours

  const startTotalCardHours =
    Object.values(startCardHoursAcc).reduce((s, b) => s + b.cardHours, 0) +
    startPipelineCardHours.pendingAccess.cardHours +
    startPipelineCardHours.retiring.cardHours

  const netDelta = Math.round(totalCardHours - startTotalCardHours)
  const netLabel =
    netDelta === 0
      ? '0 卡时'
      : `${netDelta > 0 ? '+' : ''}${netDelta.toLocaleString()} 卡时`

  return buildResourceCompositionPayload({
    entityBuckets: endEntityBuckets,
    pendingAccessPipeline: pipelineEnd.pendingAccess,
    retiringPipeline: pipelineEnd.retiring,
    displayUnit: 'card_hours',
    entityCardHours,
    pipelineCardHours,
    periodCardHoursDeltas,
    approximate,
    centerSecondary: `净增 ${netLabel}`,
  })
}
