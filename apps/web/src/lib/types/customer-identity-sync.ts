export type CustomerIdentitySyncMatchStatus =
  | 'updatable'
  | 'already_verified'
  | 'no_tenant'
  | 'not_approved'

export type CustomerIdentitySyncPreviewItem = {
  auditId: number
  platformTenantId: string
  companyName: string
  companyCode: string
  auditStatus: string
  operatingTime: string | null
  adminId: number | null
  matchStatus: CustomerIdentitySyncMatchStatus
  customerId?: string
  customerName?: string
  localTenantId?: string
  currentIdentityVerified?: boolean
  currentCertCode?: string
  proposedVerificationType?: 'manual' | 'auto'
}

export type CustomerIdentitySyncPreviewResult = {
  platformCount: number
  fetchedCount: number
  items: CustomerIdentitySyncPreviewItem[]
  updatableCount: number
  alreadyVerifiedCount: number
  unmatchedCount: number
  notApprovedCount: number
}

export type CustomerIdentitySyncApplyResult = {
  updatedCount: number
  skippedCount: number
  customerIds: string[]
}
