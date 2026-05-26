export type BillingSyncTrigger = 'scheduled' | 'manual'

export type BillingSyncJobStatus = 'running' | 'success' | 'partial' | 'failed' | 'skipped'

export type BillingSyncItemStatus = 'success' | 'failed' | 'skipped'

export type BillingSyncJobRunDto = {
  id: string
  trigger: BillingSyncTrigger
  startedAt: string
  finishedAt?: string | null
  status: BillingSyncJobStatus
  syncEndDate: string
  safetyDays: number
  projectCount: number
  tenantCount: number
  successCount: number
  failedCount: number
  skippedCount: number
  errorSummary?: string | null
}

export type BillingSyncJobItemDto = {
  id: string
  jobRunId: string
  tenantId: string
  tenantName: string
  platformTenantId?: string | null
  projectId?: string | null
  projectName?: string | null
  startDate: string
  endDate: string
  status: BillingSyncItemStatus
  summary?: string | null
  error?: string | null
}

export type BillingSyncJobRunDetailDto = BillingSyncJobRunDto & {
  items: BillingSyncJobItemDto[]
}

export type BillingSyncConfigDto = {
  enabled: boolean
  cron: string
  timezone: string
  safetyDays: number
  projectStatuses: string[]
}

export type BillingSyncRunResult = {
  acquiredLock: boolean
  jobRunId?: string
  status?: BillingSyncJobStatus
  message?: string
}
