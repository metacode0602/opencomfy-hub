export type CustomerMergePreviewTenant = {
  id: string
  name: string
  platformTenantId?: string
  isDefault: boolean
}

export type CustomerMergePreviewProject = {
  id: string
  name: string
}

export type CustomerMergePreviewSource = {
  id: string
  name: string
  tenantCount: number
  projectCount: number
  tenants: CustomerMergePreviewTenant[]
  projects: CustomerMergePreviewProject[]
}

export type CustomerMergeDefaultTenantCandidate = {
  id: string
  name: string
  fromCustomerName: string
}

export type CustomerMergePreview = {
  targetCustomer: {
    id: string
    name: string
    tenantCount: number
    projectCount: number
  }
  sourceCustomers: CustomerMergePreviewSource[]
  blocked: boolean
  blockReason?: string
  impacts: {
    tenantsToMove: number
    projectsToMove: number
    rowsByTable: Record<string, number>
  }
  defaultTenant: {
    currentTargetDefaultId?: string
    recommendedId: string
    candidates: CustomerMergeDefaultTenantCandidate[]
  }
  backfillFields: string[]
  warnings: string[]
}

export type CustomerMergeResult = {
  targetCustomerId: string
  archivedSourceCustomerIds: string[]
  movedTenantCount: number
  movedProjectCount: number
  defaultTenantId: string
  backfilledFields: string[]
}
