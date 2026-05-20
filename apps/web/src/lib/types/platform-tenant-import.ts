/** 平台 OpenAPI 租户行（与 openapi.suanli.cn 响应对齐） */
export type PlatformTenantApiRecord = {
  id: number
  tenant_type?: string | null
  tenant_name: string
  admin_id?: number
  create_time?: string
  merchant_id?: number
  coin?: number
  billing_type?: string | null
  strategy_type?: string | null
  company_name?: string | null
  company_description?: string | null
  contact_user?: string | null
  contact_phone?: string | null
  remark?: string | null
  admin_phone?: string | null
  admin_nickname?: string | null
  limit_coin?: number | null
  insufficient_balance?: string | null
  merchant_mark?: string | null
}

export type PlatformTenantPreviewItem = {
  platformTenantId: string
  platform: {
    tenantName: string
    adminPhone?: string
    coin: number
    limitCoin?: number
    companyName?: string
    contactUser?: string
    contactPhone?: string
    createTime?: string
    tenantType?: string
  }
  local?: {
    tenantId: string
    customerId: string
    customerName: string
  }
  missingOnPlatform?: boolean
}

export type PlatformImportPreviewResult = {
  items: PlatformTenantPreviewItem[]
  missingPlatformIds: string[]
}

export type PlatformImportCustomerCreate = {
  mode: 'create'
  name: string
  type: 'B' | 'C'
  contactPerson: string
  contactPhone: string
}

export type PlatformImportCustomerExisting = {
  mode: 'existing'
  customerId: string
}

export type PlatformImportCustomerAssignment =
  | PlatformImportCustomerCreate
  | PlatformImportCustomerExisting

export type PlatformImportCommitItem = {
  platformTenantId: string
  customer: PlatformImportCustomerAssignment
}

export type PlatformImportCommitResult = {
  createdTenants: number
  updatedTenants: number
  createdCustomers: number
  errors: { platformTenantId: string; message: string }[]
}

export type MockImportCustomerOption = {
  id: string
  name: string
  type: 'B' | 'C'
}
