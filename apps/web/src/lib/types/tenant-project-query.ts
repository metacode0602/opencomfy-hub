import type { OpportunitySource } from '@/lib/crm/commission-constants'

export type TenantProjectQueryRow = {
  platformTenantId: string
  tenantName: string
  projectId: string
  projectName: string
  accountManager: string
  deliveryManager: string
  preSalesManager: string
  projectManager: string
  opportunitySource?: OpportunitySource
  dealClosedMonth?: string
}

export type MultiProjectTenant = {
  platformTenantId: string
  projectCount: number
}

export type TenantProjectQueryResult = {
  rows: TenantProjectQueryRow[]
  summary: {
    total: number
    matchedTenants: number
    withProject: number
    /** 关联多个项目的租户（项目记录数 > 匹配租户数时的差异来源） */
    multiProjectTenants: MultiProjectTenant[]
  }
}
