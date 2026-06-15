import type {
  ConsistencyFlag,
  DevicePlatformProbeDetail,
  DevicePlatformProbeRow,
  ProbeCompareRow,
  ProbeStatus,
  ProxyRentStatus,
} from '@/lib/supplier/device-platform-probe-utils'

export type DevicePlatformProbeListItemDto = DevicePlatformProbeRow

export type DevicePlatformProbeStatsDto = {
  total: number
  consistent: number
  needsAction: number
  notEvaluated: number
}

export type DevicePlatformProbeStateDto = {
  enabled: boolean
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastSnapshotHour: string | null
  cron: string
}

export type DevicePlatformProbeDetailDto = DevicePlatformProbeDetail & {
  compareRows: ProbeCompareRow[]
}

export type DevicePlatformProbeJobRunDto = {
  id: string
  trigger: string
  snapshotHour: string
  startedAt: string
  finishedAt: string | null
  status: string
  inventoryDeviceCount: number
  proxyFetchedCount: number
  k8sFetchedCount: number
  bareMetalHitCount: number
  matchedProxyCount: number
  matchedK8sCount: number
  matchedBareMetalCount: number
  ambiguousCount: number
  missingPlatformCount: number
  errorSummary: string | null
}

export type { ConsistencyFlag, ProbeStatus, ProxyRentStatus }
