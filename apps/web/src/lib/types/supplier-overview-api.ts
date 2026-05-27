/** 资源总览 API 类型（§5.4 supplier.overview） */

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
  plannedReadyAt: string | null
  workOrderNo: string | null
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
}

export type OverviewFilterOptionsResult = {
  regions: string[]
  suppliers: Array<{ id: string; name: string; shortName: string | null }>
  cardTypes: string[]
  poolCodes: string[]
}
