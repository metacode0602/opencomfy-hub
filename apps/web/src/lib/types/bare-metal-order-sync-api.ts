export type BareMetalOrderSyncTrigger = 'scheduled' | 'manual'

export type BareMetalOrderSyncJobStatus =
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'skipped'

export type BareMetalOrderSyncItemPhase = 'billing_sync' | 'tenant_import' | 'order_upsert'

export type BareMetalOrderSyncItemStatus = 'success' | 'failed' | 'skipped'

export type BareMetalOrderSyncConfigDto = {
  enabled: boolean
  cron: string
  timezone: string
  billingLookbackMonths: number
  autoImportTenantsEnabled: boolean
  lastRunAt: string | null
  lastSuccessAt: string | null
}

export type BareMetalOrderSyncJobRunDto = {
  id: string
  trigger: BareMetalOrderSyncTrigger
  startedAt: string
  finishedAt: string | null
  status: BareMetalOrderSyncJobStatus
  ordersFetchedCount: number
  unknownTenantCount: number
  tenantsAutoImportedCount: number
  billingSyncTenantCount: number
  orderUpsertedCount: number
  successCount: number
  failedCount: number
  errorSummary: string | null
}

export type BareMetalOrderSyncJobItemDto = {
  id: string
  jobRunId: string
  platformTenantId: string
  tenantId: string | null
  tenantName: string | null
  phase: BareMetalOrderSyncItemPhase | string
  status: BareMetalOrderSyncItemStatus | string
  orderCount: number
  errorMessage: string | null
}

export type BareMetalOrderSyncJobRunDetailDto = BareMetalOrderSyncJobRunDto & {
  items: BareMetalOrderSyncJobItemDto[]
}

export type BareMetalOrderSyncRunResult = {
  acquiredLock: boolean
  jobRunId?: string
  status?: BareMetalOrderSyncJobStatus | string
  message?: string
}
