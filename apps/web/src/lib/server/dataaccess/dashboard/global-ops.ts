import { db } from '@/lib/db'
import { normalizeCardKey } from '@/lib/server/aggregation/overview-aggregation'
import {
  batchTodoTitle,
  computeBatchProgressMetrics,
  resolveBatchDetailHref,
} from '@/lib/server/aggregation/batch-summary-utils'
import { supplierOverviewDataAccess } from '@/lib/server/dataaccess/supplier/overview'
import { metricGpuCount, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import type {
  GlobalAlertLevel,
  GlobalAlertRow,
  GlobalDashboardFilterOptions,
  GlobalDashboardFilters,
  GlobalDashboardPeriod,
  GlobalDashboardSnapshot,
  GlobalDiscrepancyRow,
  GlobalDiscrepancyStatus,
  GlobalKpiItem,
  GlobalPeriodInput,
  GlobalTodoRow,
} from '@/lib/types/global-dashboard-api'
import { computeGlobalPeriod } from '@/lib/server/dataaccess/dashboard/global-period'
import type { OverviewFiltersInput } from '@/lib/types/supplier-overview-api'
import {
  dataCenter,
  faultIncident,
  gpuCardType,
  supplier,
  supplierDevice,
} from '@workspace/db/schema'
import { desc, eq, isNull, notInArray, or } from 'drizzle-orm'

function toOverviewFilters(filters: GlobalDashboardFilters): OverviewFiltersInput {
  return {
    region: filters.region ?? 'all',
    supplierId: filters.supplierId ?? 'all',
    cardType: filters.cardType ?? 'all',
    poolCode: 'all',
  }
}

function severityToLevel(severity: string | null): GlobalAlertLevel {
  if (severity === 'P1') return '严重'
  if (severity === 'P2') return '警告'
  return '提示'
}

function incidentToState(status: string | null): string {
  if (!status) return '未恢复'
  if (status === '处理中' || status === 'investigating') return '处理中'
  if (status === '已关闭' || status === 'closed') return '已恢复'
  return '未恢复'
}

function formatTimeHm(d: Date): string {
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  })
}

function relativeDueLabel(plannedReadyAt: Date | null, now = Date.now()): string {
  if (!plannedReadyAt) return '—'
  const diffMs = plannedReadyAt.getTime() - now
  const absH = Math.floor(Math.abs(diffMs) / (60 * 60 * 1000))
  const absM = Math.floor((Math.abs(diffMs) % (60 * 60 * 1000)) / (60 * 1000))
  if (diffMs < 0) return `超期 ${absH}h ${absM}m`
  if (diffMs < 24 * 60 * 60 * 1000) return `剩余 ${absH}h ${absM}m`
  return plannedReadyAt.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
}

function discrepancyStatus(
  gap: number,
  plannedReadyAt: Date | null,
  now = Date.now(),
): GlobalDiscrepancyStatus {
  if (gap <= 0) return 'ok'
  if (plannedReadyAt && plannedReadyAt.getTime() < now) return 'abnormal'
  return 'pending'
}

function buildKpis(
  stats: Awaited<ReturnType<typeof supplierOverviewDataAccess.getStats>>,
  abnormalDeviceCount: number,
  faultDownGpu: number,
  pendingAccessDcCount: number,
): GlobalKpiItem[] {
  const { kpis, supplierRows, gpuTargetGpu } = stats
  const poolElastic = supplierRows.reduce((s, r) => s + r.elasticServiceGpu, 0)
  const poolBareMetal = supplierRows.reduce((s, r) => s + r.bareMetalPoolGpu, 0)
  const inventoryGpu = kpis.total.gpuCount

  return [
    {
      key: 'gpu_total',
      title: 'GPU 总卡数',
      unit: '卡',
      metric: kpis.total,
      targetGpuCount: gpuTargetGpu,
      warning: inventoryGpu > gpuTargetGpu,
    },
    {
      key: 'device_online',
      title: '在线设备',
      unit: '卡 · 台',
      metric: kpis.online
    },
    {
      key: 'pool_elastic',
      title: '弹性资源池',
      unit: '卡',
      metric: { gpuCount: poolElastic, deviceCount: 0 },
    },
    {
      key: 'pool_bare_metal',
      title: '裸金属池',
      unit: '卡',
      metric: { gpuCount: poolBareMetal, deviceCount: 0 },
    },
    {
      key: 'internal_test',
      title: '内部占用',
      unit: '卡',
      metric: { gpuCount: kpis.internalTestGpu, deviceCount: 0 },
    },
    {
      key: 'device_abnormal',
      title: '异常设备',
      unit: '卡 · 台',
      metric: { gpuCount: faultDownGpu, deviceCount: abnormalDeviceCount },
      warning: abnormalDeviceCount > 0 || faultDownGpu > 0,
    },
    {
      key: 'device_pending_access',
      title: '待接入设备',
      unit: '卡 · 台',
      metric: kpis.pendingAccess,
      warning: kpis.pendingAccess.deviceCount > 0,
    },
    {
      key: 'idc_pending_access',
      title: '待接入机房',
      unit: '个',
      metric: { gpuCount: 0, deviceCount: pendingAccessDcCount },
      warning: pendingAccessDcCount > 0,
    },
  ]
}

export const globalOpsDataAccess = {
  async getFilterOptions(): Promise<GlobalDashboardFilterOptions> {
    const opts = await supplierOverviewDataAccess.getFilterOptions()
    return {
      cardTypes: opts.cardTypes,
      regions: opts.regions,
    }
  },

  async getSnapshot(filters: GlobalDashboardFilters = {}): Promise<GlobalDashboardSnapshot> {
    const normalized: GlobalDashboardFilters = {
      region: filters.region ?? 'all',
      cardType: filters.cardType ?? 'all',
      dataCenterId: filters.dataCenterId,
      supplierId: filters.supplierId,
    }

    const overviewFilters = toOverviewFilters(normalized)
    const stats = await supplierOverviewDataAccess.getStats(overviewFilters)
    const now = new Date()

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

    const cardFilter = normalized.cardType !== 'all' ? normalizeCardKey(normalized.cardType) : null

    const filteredDevices = deviceRows
      .filter((d) => {
        if (normalized.supplierId && normalized.supplierId !== 'all' && d.supplierId !== normalized.supplierId) {
          return false
        }
        if (normalized.dataCenterId && d.dataCenterId !== normalized.dataCenterId) return false
        if (cardFilter && normalizeCardKey(d.cardTypeName) !== cardFilter) return false
        return true
      })
      .map((d) => ({
        ...d,
        cardTypeRole: resolveGpuCardTypeRole({
          name: d.cardTypeName,
          code: d.cardTypeCode,
          deviceRole: d.cardTypeDeviceRole,
        }),
      }))

    const openFaults = await db
      .select({
        id: faultIncident.id,
        supplierId: faultIncident.supplierId,
        supplierDeviceId: faultIncident.supplierDeviceId,
        severity: faultIncident.severity,
        faultType: faultIncident.faultType,
        incidentStatus: faultIncident.incidentStatus,
        openedAt: faultIncident.openedAt,
        supplierName: supplier.shortName,
        supplierFullName: supplier.name,
      })
      .from(faultIncident)
      .leftJoin(supplier, eq(faultIncident.supplierId, supplier.id))
      .where(
        or(
          isNull(faultIncident.closedAt),
          notInArray(faultIncident.incidentStatus, ['已关闭', 'closed']),
        ),
      )
      .orderBy(desc(faultIncident.openedAt))
      .limit(20)

    const abnormalDeviceIds = new Set<string>()
    for (const f of openFaults) {
      if (f.supplierDeviceId) abnormalDeviceIds.add(f.supplierDeviceId)
    }

    const pendingAccessDcIds = new Set(stats.pendingAccessDataCenterIds ?? [])
    const pendingAccessDcCount = normalized.dataCenterId
      ? pendingAccessDcIds.has(normalized.dataCenterId)
        ? 1
        : 0
      : pendingAccessDcIds.size

    const dcRows = await db
      .select({
        id: dataCenter.id,
        name: dataCenter.name,
      })
      .from(dataCenter)

    const dcNameById = new Map(dcRows.map((r) => [r.id, r.name]))

    type ClusterAgg = {
      dataCenterId: string
      name: string
      totalGpu: number
      onlineGpu: number
      abnormalDevices: number
      pendingAccessGpu: number
      onboardingGpu: number
      retiringGpu: number
      cardTypeCounts: Map<string, number>
    }

    const clusterAgg = new Map<string, ClusterAgg>()
    const ensureCluster = (dcId: string): ClusterAgg => {
      const existing = clusterAgg.get(dcId)
      if (existing) return existing
      const row: ClusterAgg = {
        dataCenterId: dcId,
        name: dcNameById.get(dcId) ?? dcId,
        totalGpu: 0,
        onlineGpu: 0,
        abnormalDevices: 0,
        pendingAccessGpu: 0,
        onboardingGpu: 0,
        retiringGpu: 0,
        cardTypeCounts: new Map(),
      }
      clusterAgg.set(dcId, row)
      return row
    }

    for (const d of filteredDevices) {
      if (!d.dataCenterId) continue
      const row = ensureCluster(d.dataCenterId)
      const gpu = metricGpuCount(d)
      row.totalGpu += gpu
      const ct = d.cardTypeName ?? '未知'
      row.cardTypeCounts.set(ct, (row.cardTypeCounts.get(ct) ?? 0) + gpu)
      if (d.lifecycleStatus === '在线') row.onlineGpu += gpu
      if (d.lifecycleStatus === '待接入') row.pendingAccessGpu += gpu
      if (d.lifecycleStatus === '接入中') row.onboardingGpu += gpu
      if (d.lifecycleStatus === '下线中') row.retiringGpu += gpu
      if (abnormalDeviceIds.has(d.id)) row.abnormalDevices += 1
    }

    for (const dcId of stats.pendingAccessDataCenterIds ?? []) {
      ensureCluster(dcId)
    }
    for (const [dcId, gap] of Object.entries(stats.pipelinePendingByDataCenter ?? {})) {
      if (gap.gpuCount <= 0 && gap.deviceCount <= 0) continue
      const row = ensureCluster(dcId)
      row.pendingAccessGpu += gap.gpuCount
    }

    const clusters = Array.from(clusterAgg.values())
      .filter((c) => {
        if (
          c.totalGpu <= 0 &&
          c.pendingAccessGpu <= 0 &&
          c.onboardingGpu <= 0 &&
          c.retiringGpu <= 0
        ) {
          return false
        }
        return true
      })
      .map((c) => {
        let primaryCardType: string | null = null
        let max = 0
        for (const [name, gpu] of c.cardTypeCounts) {
          if (gpu > max) {
            max = gpu
            primaryCardType = name
          }
        }
        const onlineRate =
          c.totalGpu > 0 ? Math.round((c.onlineGpu / c.totalGpu) * 100) : 0
        return {
          dataCenterId: c.dataCenterId,
          name: c.name,
          primaryCardType,
          totalGpu: c.totalGpu,
          onlineGpu: c.onlineGpu,
          abnormalDevices: c.abnormalDevices,
          pendingAccessGpu: c.pendingAccessGpu,
          onboardingGpu: c.onboardingGpu,
          retiringGpu: c.retiringGpu,
          onlineRate,
          netOk: true,
          owner: null,
        }
      })
      .sort((a, b) => b.onlineGpu - a.onlineGpu)
      .slice(0, 8)

    const discrepancies: GlobalDiscrepancyRow[] = stats.batchSummaries.map((b) => {
      const metrics = computeBatchProgressMetrics({
        batchKind: b.batchKind,
        plannedDeviceCount: b.plannedDeviceCount,
        touchedDeviceCount: b.touchedDeviceCount,
        onlineDeviceCount: b.onlineDeviceCount,
        retiredDeviceCount: b.retiredDeviceCount ?? 0,
      })
      const gap = b.progressGap ?? metrics.progressGap
      const gapDoneLabel = b.gapDoneLabel ?? metrics.gapDoneLabel
      const progressDoneCount = b.progressDoneCount ?? metrics.progressDoneCount
      const progressDoneLabel = b.progressDoneLabel ?? metrics.progressDoneLabel
      const plannedAt = b.plannedReadyAt ? new Date(b.plannedReadyAt) : null
      const status = discrepancyStatus(gap, plannedAt, now.getTime())
      const detailHref =
        b.detailHref ?? resolveBatchDetailHref({ id: b.id, batchKind: b.batchKind })
      return {
        batchId: b.id,
        batchKind: b.batchKind,
        supplierName: b.supplierName,
        dataCenterName: b.dataCenterName,
        plannedDeviceCount: b.plannedDeviceCount,
        touchedDeviceCount: b.touchedDeviceCount,
        onlineDeviceCount: progressDoneCount,
        progressDoneLabel,
        gapLabel: gap > 0 ? `计划 − ${gapDoneLabel} = ${gap}` : '一致',
        status,
        detailHref,
      }
    })

    const alerts: GlobalAlertRow[] = openFaults.map((f) => {
      const supplierLabel = f.supplierName ?? f.supplierFullName ?? '未知供应商'
      return {
        id: f.id,
        time: formatTimeHm(f.openedAt),
        level: severityToLevel(f.severity),
        type: 'fault' as const,
        title: `${f.faultType ?? '故障'} · ${supplierLabel}`,
        detail: `状态 ${f.incidentStatus ?? '—'}`,
        state: incidentToState(f.incidentStatus),
      }
    })

    const todos: GlobalTodoRow[] = []

    for (const b of stats.batchSummaries) {
      const metrics = computeBatchProgressMetrics({
        batchKind: b.batchKind,
        plannedDeviceCount: b.plannedDeviceCount,
        touchedDeviceCount: b.touchedDeviceCount,
        onlineDeviceCount: b.onlineDeviceCount,
        retiredDeviceCount: b.retiredDeviceCount ?? 0,
      })
      const gap = b.progressGap ?? metrics.progressGap
      if (gap <= 0) continue
      const plannedAt = b.plannedReadyAt ? new Date(b.plannedReadyAt) : null
      const msToDue = plannedAt ? plannedAt.getTime() - now.getTime() : null
      const urgent =
        plannedAt != null &&
        (plannedAt.getTime() < now.getTime() || (msToDue != null && msToDue < 24 * 60 * 60 * 1000))
      if (!urgent) continue
      const detailHref =
        b.detailHref ?? resolveBatchDetailHref({ id: b.id, batchKind: b.batchKind })
      todos.push({
        id: `batch-${b.id}`,
        title: batchTodoTitle(b.batchKind, b.supplierName, b.dataCenterName),
        priority: 'P2',
        assignee: null,
        due: relativeDueLabel(plannedAt, now.getTime()),
        overdue: plannedAt != null && plannedAt.getTime() < now.getTime(),
        href: detailHref,
      })
    }

    for (const f of openFaults.filter((x) => x.severity === 'P1' || x.severity === 'P2').slice(0, 5)) {
      todos.push({
        id: `fault-${f.id}`,
        title: `故障处理 · ${f.faultType ?? '故障'}`,
        priority: f.severity ?? 'P2',
        assignee: null,
        due: relativeDueLabel(f.openedAt, now.getTime()),
        overdue: false,
        href: '/supplier/overview',
      })
    }

    for (const d of discrepancies.filter((r) => r.status === 'abnormal').slice(0, 3)) {
      todos.push({
        id: `disc-${d.batchId}`,
        title: `差异核对 · ${d.supplierName}`,
        priority: 'P2',
        assignee: null,
        due: '需立即核对',
        overdue: true,
        href: d.detailHref || `/supplier/online-tasks/${d.batchId}`,
      })
    }

    return {
      meta: {
        asOf: now.toISOString(),
        timezone: 'Asia/Shanghai',
        filters: normalized,
        view: 'snapshot',
      },
      kpis: buildKpis(
        stats,
        abnormalDeviceIds.size,
        stats.kpis.faultDownGpu,
        pendingAccessDcCount,
      ),
      lifecycleFunnel: stats.lifecycleFunnel,
      resourceComposition: stats.resourceComposition,
      clusters,
      discrepancies,
      alerts,
      todos: todos.slice(0, 10),
    }
  },

  async getPeriod(input: GlobalPeriodInput): Promise<GlobalDashboardPeriod> {
    return computeGlobalPeriod(input)
  },
}
