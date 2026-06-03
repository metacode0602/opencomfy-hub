export type TenantBlacklistStatus = 'Open' | 'Close' | string

export type TenantBlacklistListItem = {
  id: string
  platformBlacklistId: number
  blacklistType: string
  platformTenantId: string
  status: TenantBlacklistStatus
  platformTenantName?: string
  remark?: string
  merchantId?: number
  platformCreatedAt?: string
  platformUpdatedAt?: string
  localTenantId?: string
  localTenantName?: string
  lastSyncedAt: string
  removedAt?: string
}

export type TenantBlacklistListResult = {
  items: TenantBlacklistListItem[]
  total: number
  page: number
  pageSize: number
  lastPullEndDate?: string | null
  defaultSafetyDays: number
  activeCount: number
}

export type TenantBlacklistSyncDefaults = {
  lastPullStartDate: string | null
  defaultSafetyDays: number
  suggestedEndDate: string
  lastJobFinishedAt: string | null
  lastJobStatus: string | null
  lastJobUpsertedCount: number | null
}

export type TenantBlacklistSyncResult = {
  jobRunId: string
  fetchedCount: number
  upsertedCount: number
  platformCount: number
  dataStartTime: string
  dataEndTime: string
  endDate: string
}
