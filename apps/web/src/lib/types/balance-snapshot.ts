export type BalanceSnapshotGranularity = 'hour' | 'day'

export type BalanceSnapshotTrigger = 'scheduled' | 'manual'

export type BalanceSnapshotSource =
  | 'platform_sync'
  | 'platform_import'
  | 'manual_edit'
  | 'admin_trigger'

export type BalanceSnapshotJobStatus = 'running' | 'success' | 'partial' | 'failed'

export type BalanceSnapshotJobRunDto = {
  id: string
  trigger: BalanceSnapshotTrigger
  granularity: BalanceSnapshotGranularity | 'all'
  startedAt: string
  finishedAt: string | null
  status: BalanceSnapshotJobStatus
  tenantCount: number
  successCount: number
  failedCount: number
  skippedCount: number
  errorSummary: string | null
}

export type BalanceSnapshotConfigDto = {
  enabled: boolean
  hourlyCron: string
  dailyCron: string
  timezone: string
}

export type BalanceSnapshotRunResult = {
  jobRunId: string
  status: BalanceSnapshotJobStatus
  tenantCount: number
  successCount: number
  failedCount: number
  skippedCount: number
  errorSummary?: string | null
}

export type ProjectBalanceSnapshotTenant = {
  id: string
  name: string
  platformTenantId?: string
  currentBalance: number
}

export type ProjectBalanceSnapshotPoint = {
  bucketStart: string
  label: string
  values: Record<string, number>
}

export type ProjectBalanceSnapshotSeries = {
  granularity: BalanceSnapshotGranularity
  usageMonth?: string
  usageDate?: string
  tenants: ProjectBalanceSnapshotTenant[]
  points: ProjectBalanceSnapshotPoint[]
}
