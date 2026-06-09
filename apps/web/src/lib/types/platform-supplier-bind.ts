export type PlatformSupplierBindCandidate = {
  applicationId: string
  platformTenantId?: string
  name: string
  onboardingType?: 'enterprise' | 'individual'
  identityNo?: string
  bindable: boolean
  bindMessage?: string
}

export type PlatformSupplierBindSearchResult = {
  supplierId: string
  supplierName: string
  currentExternalTenantId?: string
  currentPlatformTenantId?: string
  candidates: PlatformSupplierBindCandidate[]
}

export type PlatformSupplierBindCommitResult = {
  supplierId: string
  supplierName: string
  externalTenantId: string
  platformTenantId?: string
}
