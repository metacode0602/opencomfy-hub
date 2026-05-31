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
  /** GPU 总卡数卡片：目标总卡数（计划台账） */
  targetGpuCount?: number
}

export type GlobalLifecycleStagePeriod = LifecycleFunnelStageDto & {
  throughputDeviceCount?: number
  secondaryLabel?: string
  secondaryValue?: string
}

export type ResourceCompositionDisplayUnit = 'gpu_cards' | 'card_hours'

export type ResourceCompositionSliceKind = 'entity' | 'pipeline_virtual'

export type GlobalResourceCompositionBreakdown = {
  cardType: string
  gpuCount: number
  deviceCount: number
  cardHours?: number
  machineHours?: number
}

export type GlobalResourceCompositionSlice = {
  key: string
  label: string
  kind: ResourceCompositionSliceKind
  gpuCount: number
  deviceCount: number
  cardHours?: number
  machineHours?: number
  netChangeLabel?: string
  breakdownByCardType?: GlobalResourceCompositionBreakdown[]
}

export type GlobalResourceCompositionDenominator = {
  gpuCount: number
  deviceCount: number
  cardHours?: number
  machineHours?: number
}

export type GlobalResourceCompositionPayload = {
  displayUnit: ResourceCompositionDisplayUnit
  denominator: GlobalResourceCompositionDenominator
  slices: GlobalResourceCompositionSlice[]
  centerPrimary: string
  centerSecondary?: string
  footnote: string
  /** 主数据快照缺失时用当前态恒定回填 */
  approximate?: boolean
}

export type GlobalClusterStatusRow = {
  dataCenterId: string
  name: string
  primaryCardType: string | null
  /** 机房容器实例区域，对应平台 region */
  containerInstanceRegion: string | null
  totalDevices: number
  onlineDevices: number
  totalGpu: number
  onlineGpu: number
  abnormalDevices: number
  /** lifecycle = 待接入，含进行中批次管道缺口 */
  pendingAccessGpu: number
  /** lifecycle = 接入中 */
  onboardingGpu: number
  /** lifecycle = 下线中 */
  retiringGpu: number
  onlineRate: number
  /** 平台侧该 region 设备台数（source_statistics） */
  platformTotalDevices: number | null
  /** 平台侧该 region GPU 总量（gpu_usage.total_count） */
  platformTotalGpu: number | null
  /** 平台侧该 region GPU 在用（弹性 + Spot） */
  platformUsedGpu: number | null
  netOk: boolean
  owner: string | null
}

export type GlobalDiscrepancyStatus = 'ok' | 'pending' | 'abnormal'

export type GlobalDiscrepancyRow = {
  batchId: string
  batchKind: string
  supplierName: string
  dataCenterName: string
  plannedDeviceCount: number
  touchedDeviceCount: number
  onlineDeviceCount: number
  progressDoneLabel: string
  gapLabel: string
  status: GlobalDiscrepancyStatus
  detailHref: string
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

export type GlobalDashboardSnapshot = {
  meta: GlobalDashboardMeta
  kpis: GlobalKpiItem[]
  lifecycleFunnel: LifecycleFunnelStageDto[]
  /** 互斥资源构成（权威） */
  resourceComposition: GlobalResourceCompositionPayload
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
