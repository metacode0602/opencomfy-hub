/** 资源总览 API 类型（§5.4 supplier.overview） */

import type { GlobalResourceCompositionPayload } from '@/lib/types/global-dashboard-api'

export type OverviewFiltersInput = {
  region: string
  supplierId: string
  cardType: string
  poolCode: string
}

export type OverviewKpiMetric = {
  deviceCount: number
  gpuCount: number
}

export type OverviewKpisDto = {
  total: OverviewKpiMetric
  online: OverviewKpiMetric
  pendingAccess: OverviewKpiMetric
  onboarding: OverviewKpiMetric
  maintenance: OverviewKpiMetric
  sellable: OverviewKpiMetric
  retiring?: OverviewKpiMetric
  nonSchedulable: OverviewKpiMetric
  inMaintenance: OverviewKpiMetric
  reservedIdle: OverviewKpiMetric
  internalTestGpu: number
  faultDownGpu: number
  faultOpenCount: number
  activeTestHolds: number
  activeBatches: number
  sellableRate: number
}

export type LifecycleFunnelStageDto = {
  stage: string
  gpuCount: number
  deviceCount: number
  warn?: boolean
}

export type OpsPipelineGroupDto = {
  group: string
  gpuCount: number
  deviceCount: number
}

export type SupplierOverviewRowDto = {
  supplierId: string
  supplierName: string
  regionCount: number
  totalGpu: number
  onlineGpu: number
  sellableGpu: number
  activeBatches: number
  openFaults: number
  maintenanceGpu: number
  pendingAccessGpu: number
  onboardingGpu: number
  retiringGpu: number
  internalTestGpu: number
  offlineDeliveryGpu: number
  bareMetalPoolGpu: number
  elasticServiceGpu: number
  dualPoolGpu: number
}

export type InventoryOverviewRowDto = {
  id: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  region: string
  cardTypeName: string
  quantity: number
  onlineQuantity: number
  maintenanceQuantity: number
  internalTestGpu: number
  sellableQuantity: number
  offlineQuantity: number
  offlineDeliveryGpu: number
  bareMetalPoolGpu: number
  elasticServiceGpu: number
  dualPoolGpu: number
  status: string
  poolCodes: string[]
}

export type OnboardingBatchSummaryDto = {
  id: string
  batchCode: string
  batchKind: string
  supplierName: string
  dataCenterName: string
  importStatus: string
  batchStatus: string
  plannedDeviceCount: number
  touchedDeviceCount: number
  onlineDeviceCount: number
  retiredDeviceCount: number
  progressDoneCount: number
  progressGap: number
  progressMidLabel: string
  progressDoneLabel: string
  gapDoneLabel: string
  plannedReadyAt: string | null
  workOrderNo: string | null
  detailHref: string
}

export type FaultSlaSummaryDto = {
  openCount: number
  p1Count: number
  p2Count: number
  avgResolutionHours: number | null
  recentOpen: Array<{
    id: string
    supplierId: string
    severity: string
    faultType: string
    incidentStatus: string
    openedAt: string
  }>
}

export type PipelinePendingByDataCenter = Record<
  string,
  { deviceCount: number; gpuCount: number }
>

export type OverviewStatsResult = {
  kpis: OverviewKpisDto
  lifecycleFunnel: LifecycleFunnelStageDto[]
  opsPipeline: OpsPipelineGroupDto[]
  supplierRows: SupplierOverviewRowDto[]
  inventoryRows: InventoryOverviewRowDto[]
  batchSummaries: OnboardingBatchSummaryDto[]
  faultSla: FaultSlaSummaryDto
  /** Snapshot：实体待接入机房 ∪ new_idc 进行中批次机房 */
  pendingAccessDataCenterIds: string[]
  /** 进行中上架/订单接入批次按机房的计划管道缺口（计划 − 已触达） */
  pipelinePendingByDataCenter: PipelinePendingByDataCenter
  /** 目标总卡数：有效上架计划 − 有效下架计划（批次台账） */
  gpuTargetGpu: number
  /** 资源构成饼图（互斥分桶 + 计划虚拟量） */
  resourceComposition: GlobalResourceCompositionPayload
}

export type OverviewFilterOptionsResult = {
  regions: string[]
  suppliers: Array<{ id: string; name: string; shortName: string | null }>
  cardTypes: string[]
  poolCodes: string[]
}

export type GpuResourceTrendRange = '24h' | '7d' | '30d'

export type GpuResourceTrendRegionPoint = {
  region: string
  dataCenterName: string | null
  totalCount: number
  usedCount: number
}

export type GpuResourceTrendPoint = {
  timestamp: string
  label: string
  totalCount: number
  usedCount: number
  regions: GpuResourceTrendRegionPoint[]
}

export type GpuResourceTrendResult = {
  points: GpuResourceTrendPoint[]
  meta: {
    range: GpuResourceTrendRange
    startTime: string
    endTime: string | null
    regionCount: number
    gpuNameCount: number
  }
}

export type GpuRegionUsageRow = {
  region: string
  dataCenterName: string | null
  gpuName: string | null
  totalGpuCount: number
  totalDeviceCount: number
  /** 开放平台 gpu_usage 返回的 GPU 总量（无数据时为 null） */
  platformGpuFromUsage: number | null
  /** 开放平台 source_statistics 返回的 GPU 总量（无数据时为 null） */
  platformGpuFromSource: number | null
  /** 接入台账：GPU 卡数（不含 infra/CPU、退订、线下裸金属交付、内部占用） */
  crmTotalGpuCount: number
  /** 接入台账：算力设备台数（不含 infra/CPU、退订、线下裸金属交付、内部占用） */
  crmTotalDeviceCount: number
  /** 接入台账：lifecycle=在线 的 GPU 卡数（口径同 crmTotalGpuCount） */
  onlineGpuCount: number
  /** 接入台账：lifecycle=在线 的算力设备台数（口径同 crmTotalDeviceCount） */
  onlineDeviceCount: number
  /** gpu_usage 与 source_statistics 的 GPU 总量不一致 */
  platformApiGpuMismatch: boolean
  /** 开放平台总量与接入台账总量（设备或 GPU）不一致 */
  platformLedgerMismatch: boolean
  elasticUsedCount: number
  spotUsedCount: number
  idleCount: number
}

export type GpuRegionOverviewResult = {
  rows: GpuRegionUsageRow[]
  meta: {
    regionCount: number
    gpuNameCount: number
    mismatchRegionCount: number
  }
}

/** 开放平台 /admin/statistics/data_count 汇总（source / gpu 各 type 计数之和） */
export type AdminStatisticsDataCountResult = OverviewKpiMetric
