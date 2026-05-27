/** 全局运营监控大盘 API 类型（dashboard.globalOps） */

import type { LifecycleFunnelStageDto, OverviewKpiMetric } from './supplier-overview-api'

export type GlobalDashboardView = 'snapshot' | 'daily' | 'hourly'

export type GlobalDashboardFilters = {
  region?: string
  cardType?: string
  dataCenterId?: string
  supplierId?: string
}

export type GlobalKpiKey =
  | 'gpu_total'
  | 'device_online'
  | 'pool_elastic'
  | 'pool_bare_metal'
  | 'internal_test'
  | 'device_abnormal'
  | 'device_pending_access'
  | 'idc_pending_access'

export type GlobalKpiTrendPoint = {
  key: string
  value: number
  label: string
}

export type GlobalKpiItem = {
  key: GlobalKpiKey
  title: string
  unit: string
  metric: OverviewKpiMetric | { gpuCount: number; deviceCount?: number }
  warning?: boolean
  href?: string
  /** Period：期末主值展示文案 */
  periodPrimary?: string
  /** Period：净增文案，如 +120 卡 */
  netChangeLabel?: string
  netChangeUp?: boolean
  /** Period：sparkline */
  trend?: GlobalKpiTrendPoint[]
}

export type GlobalLifecycleStagePeriod = LifecycleFunnelStageDto & {
  throughputDeviceCount?: number
  secondaryLabel?: string
  secondaryValue?: string
}

export type GlobalResourcePoolBreakdownSnapshot = {
  cardType: string
  onlineGpuCards: number
}

export type GlobalResourcePoolBreakdownPeriod = {
  cardType: string
  machineHours: number
  cardHours: number
}

export type GlobalResourcePoolSlice = {
  key: string
  label: string
  gpuCount: number
  deviceCount: number
  /** Period：区间卡时 */
  cardHours?: number
  machineHours?: number
  netChangeLabel?: string
  breakdownSnapshot?: GlobalResourcePoolBreakdownSnapshot[]
  breakdownPeriod?: GlobalResourcePoolBreakdownPeriod[]
}

export type GlobalClusterStatusRow = {
  dataCenterId: string
  name: string
  primaryCardType: string | null
  totalGpu: number
  onlineGpu: number
  abnormalDevices: number
  pendingAccessGpu: number
  onlineRate: number
  netOk: boolean
  owner: string | null
}

export type GlobalDiscrepancyStatus = 'ok' | 'pending' | 'abnormal'

export type GlobalDiscrepancyRow = {
  batchId: string
  supplierName: string
  dataCenterName: string
  plannedDeviceCount: number
  touchedDeviceCount: number
  onlineDeviceCount: number
  gapLabel: string
  status: GlobalDiscrepancyStatus
}

export type GlobalAlertLevel = '严重' | '警告' | '提示'
export type GlobalAlertType = 'fault' | 'network' | 'shelving' | 'pool'

export type GlobalAlertRow = {
  id: string
  time: string
  level: GlobalAlertLevel
  type: GlobalAlertType
  title: string
  detail: string
  state: string
}

export type GlobalTodoRow = {
  id: string
  title: string
  priority: string
  assignee: string | null
  due: string
  overdue: boolean
  href: string
}

export type GlobalDashboardMeta = {
  asOf: string
  timezone: 'Asia/Shanghai'
  filters: GlobalDashboardFilters
  view?: GlobalDashboardView
  periodStart?: string
  periodEnd?: string
  granularity?: 'day' | 'hour'
  comparePrevious?: boolean
}

export type GlobalResourcePoolsPayload = {
  displayUnit: 'gpu_cards' | 'card_hours'
  slices: GlobalResourcePoolSlice[]
  dualPoolGpu: number
  poolOccupancyGpu: number
  centerPrimary: string
  centerSecondary?: string
  footnote: string
}

export type GlobalDashboardSnapshot = {
  meta: GlobalDashboardMeta
  kpis: GlobalKpiItem[]
  lifecycleFunnel: LifecycleFunnelStageDto[]
  resourcePools: GlobalResourcePoolsPayload
  clusters: GlobalClusterStatusRow[]
  discrepancies: GlobalDiscrepancyRow[]
  alerts: GlobalAlertRow[]
  todos: GlobalTodoRow[]
}

/** Period 与 Snapshot 同型，meta.view 为 daily | hourly */
export type GlobalDashboardPeriod = GlobalDashboardSnapshot & {
  lifecycleFunnel: GlobalLifecycleStagePeriod[]
  compare?: {
    kpis: Array<{ key: GlobalKpiKey; netChangeLabel: string }>
  }
}

export type GlobalDashboardFilterOptions = {
  cardTypes: string[]
  regions: string[]
}

export type GlobalPeriodInput = {
  granularity: 'day' | 'hour'
  periodStart: string
  periodEnd: string
  comparePrevious?: boolean
  region?: string
  cardType?: string
  dataCenterId?: string
  supplierId?: string
}
