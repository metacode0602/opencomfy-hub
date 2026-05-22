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
  insufficient_balance?: string | boolean | number | null
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
  contactPerson?: string
  contactPhone?: string
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
  /** 本地已存在租户时省略，服务端仅更新 tenant 字段 */
  customer?: PlatformImportCustomerAssignment
}

export type PlatformImportImportedTenant = {
  platformTenantId: string
  tenantId: string
  tenantName: string
}

export type PlatformImportBillingItemResult = {
  platformTenantId: string
  tenantName: string
  success: boolean
  /** 写入摘要，如「裸金属 新增 2 / 更新 1；月度账单 新增 1」 */
  summary?: string
  error?: string
}

export type PlatformImportBillingBatchResult = {
  items: PlatformImportBillingItemResult[]
  successCount: number
  failedCount: number
}

export type PlatformImportCommitResult = {
  createdTenants: number
  updatedTenants: number
  createdCustomers: number
  /** 租户导入成功的平台 ID → CRM 租户映射（供后续账单同步） */
  importedTenants: PlatformImportImportedTenant[]
  errors: { platformTenantId: string; message: string }[]
  /** 勾选「导入账单数据」且租户导入成功后填充（客户端合并） */
  billing?: PlatformImportBillingBatchResult
}

export type MockImportCustomerOption = {
  id: string
  name: string
  type: 'B' | 'C'
}
