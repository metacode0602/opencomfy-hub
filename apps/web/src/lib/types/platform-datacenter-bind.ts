export type PlatformDatacenterBindCandidate = {
  idcId: string
  platformTenantId?: string
  name: string
  containerInstanceRegion?: string
  bindable: boolean
  bindMessage?: string
}

export type PlatformDatacenterBindSearchResult = {
  dataCenterId: string
  dataCenterName: string
  supplierName: string
  currentExternalOnboardingId?: string
  currentPlatformTenantId?: string
  candidates: PlatformDatacenterBindCandidate[]
}

export type PlatformDatacenterBindCommitResult = {
  dataCenterId: string
  dataCenterName: string
  externalOnboardingId: string
  platformTenantId?: string
}
