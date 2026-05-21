import type { DataCenter } from '@/lib/data/types'

/** 平台 OpenAPI 机房信息（与 suanli-supply-api 对齐） */
export type PlatformDatacenterApiRecord = {
  id: number
  tenant_id?: number
  zone_name?: string | null
  name?: string | null
  container_instance_region?: string | null
  scale?: string | null
  audit_status?: string | null
  is_delete?: boolean
  create_time?: string | null
}

export type PlatformDatacenterPreviewItem = {
  externalOnboardingId: string
  platform: {
    name: string
    platformTenantId?: string
    zoneName?: string
    region?: string
    scale?: string
    auditStatus?: string
    status?: DataCenter['status']
    sourceDeleted?: boolean
    createTime?: string
  }
  resolvedSupplier?: {
    supplierId: string
    supplierName: string
  }
  local?: {
    dataCenterId: string
    dataCenterName: string
    supplierName: string
  }
  missingOnPlatform?: boolean
  action: 'create' | 'skip' | 'error'
  skipReason?: string
  errorMessage?: string
}

export type PlatformDatacenterImportPreviewResult = {
  items: PlatformDatacenterPreviewItem[]
  missingPlatformIds: string[]
}

export type PlatformDatacenterImportCommitItem = {
  externalOnboardingId: string
}

export type PlatformDatacenterImportCommitResult = {
  created: number
  skipped: number
  errors: { externalOnboardingId: string; message: string }[]
}
