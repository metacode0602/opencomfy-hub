import type { CooperationMode, Supplier, SupplierOnboardingType } from '@/lib/data/types'

/** 平台 OpenAPI 供应商入驻申请（与 suanli-supply-api 对齐） */
export type PlatformSupplierApiRecord = {
  id: number
  tenant_id?: number
  type?: string | null
  name?: string | null
  credential_code?: string | null
  contact_person?: string | null
  contact_phone?: string | null
  audit_status?: string | null
  split_mode?: string | null
  admin_phone?: string | null
  admin_email?: string | null
  create_time?: string | null
}

export type PlatformSupplierPreviewItem = {
  externalOnboardingId: string
  platform: {
    name: string
    onboardingType?: SupplierOnboardingType
    platformTenantId?: string
    contactPerson?: string
    contactPhone?: string
    adminPhone?: string
    adminEmail?: string
    auditStatus?: string
    cooperationMode?: CooperationMode
    status?: Supplier['status']
    createTime?: string
  }
  local?: {
    supplierId: string
    supplierName: string
    businessManager?: string
  }
  missingOnPlatform?: boolean
  action: 'create' | 'update' | 'skip'
  skipReason?: string
}

export type PlatformSupplierImportPreviewResult = {
  items: PlatformSupplierPreviewItem[]
  missingPlatformIds: string[]
  defaultBusinessManagerStaffId: string
  defaultBusinessManagerLabel: string
}

export type PlatformSupplierImportCommitItem = {
  externalOnboardingId: string
}

export type PlatformSupplierImportCommitInput = {
  defaultBusinessManagerStaffId: string
  items: PlatformSupplierImportCommitItem[]
}

export type PlatformSupplierImportCommitResult = {
  created: number
  updated: number
  skipped: number
  errors: { externalOnboardingId: string; message: string }[]
}
