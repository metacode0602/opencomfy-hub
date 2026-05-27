/**
 * 资源总览 / 全局大盘共享聚合（§5.4）
 * supplier.overview.getStats 与 dashboard.globalOps.getSnapshot 共用。
 */

import type { OverviewKpiMetric, LifecycleFunnelStageDto } from '@/lib/types/supplier-overview-api'

export const CLOSED_FAULT_STATUSES = ['已关闭', 'closed'] as const
export const TERMINAL_BATCH_STATUSES = ['已完成', '已取消'] as const

export const LIFECYCLE_ORDER = ['待接入', '接入中', '在线', '维护中', '下线中'] as const

export const BARE_METAL_DIRECT_OPS = ['网关直连裸金属上架中'] as const
export const BARE_METAL_PROXY_OPS = ['网关代理裸金属上架中'] as const
export const OFFLINE_DELIVERY_OPS = ['线下裸金属交付中'] as const
export const GATEWAY_ONBOARDING_OPS = ['网关节点上架中'] as const
export const NON_SCHEDULABLE_OPS = ['不可调度节点运行中'] as const
export const RESERVED_IDLE_OPS = ['预留闲置中'] as const
export const OTHER_DEPT_OPS = ['其他部门使用中'] as const

/** §5.4.6 表底口径说明 */
export const OVERVIEW_POOL_FOOTNOTE =
  '裸金属池占用：直连/单机上架中、线下交付及已绑定裸金属池设备；弹性用量池：platform/elastic 及网关代理裸金属；双池主要为代理裸金属，两列之和减去双池不等于独占 GPU 总数'

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

export function kpiFromDevices(
  devices: OverviewDeviceRow[],
  pred: (d: OverviewDeviceRow) => boolean,
): OverviewKpiMetric {
  const matched = devices.filter(pred)
  return {
    deviceCount: matched.length,
    gpuCount: matched.reduce((sum, d) => sum + d.gpuCount, 0),
  }
}

export function normalizeLifecycleStage(status: string): (typeof LIFECYCLE_ORDER)[number] {
  if ((LIFECYCLE_ORDER as readonly string[]).includes(status)) {
    return status as (typeof LIFECYCLE_ORDER)[number]
  }
  return '待接入'
}

export function buildLifecycleFunnel(devices: OverviewDeviceRow[]): LifecycleFunnelStageDto[] {
  const lifecycleBuckets: Record<string, { gpu: number; devices: number }> = {}
  for (const stage of LIFECYCLE_ORDER) {
    lifecycleBuckets[stage] = { gpu: 0, devices: 0 }
  }
  for (const d of devices) {
    const key = normalizeLifecycleStage(d.lifecycleStatus)
    const bucket = lifecycleBuckets[key]!
    bucket.gpu += d.gpuCount
    bucket.devices += 1
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
