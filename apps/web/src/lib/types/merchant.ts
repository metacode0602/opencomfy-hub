import type { PlatformBillingUnit, PlatformProductLine } from '@/lib/types/platform-pricing'

export type MerchantType = 'platform_direct' | 'partner'
export type MerchantStatus = 'active' | 'inactive' | 'suspended'
export type MerchantAccessMode = 'oem' | 'api' | 'iframe'
export type MerchantRechargeStatus = 'pending' | 'completed' | 'cancelled'
export type MerchantRechargeSource = 'manual' | 'platform_sync'
export type MerchantRechargeAuditAction = 'create' | 'update'
export type MerchantActivityType =
  | 'info_updated'
  | 'recharge_created'
  | 'recharge_updated'
  | 'region_added'
  | 'platform_sync'
  | 'status_changed'
  | 'comment'
  | 'file'
export type MerchantRegionStatus = 'open' | 'closed' | 'maintenance'
export type TenantMerchantBindingRole = 'platform_primary' | 'commercial' | 'historical'

export type Merchant = {
  id: string
  platformMerchantId: number
  code: string
  name: string
  companyFullName: string
  unifiedSocialCreditCode: string
  merchantMark?: string
  accessMode: MerchantAccessMode
  type: MerchantType
  isDefault: boolean
  status: MerchantStatus
  contactUser?: string
  contactPhone?: string
  remark?: string
  platformSyncedAt?: string
  createdAt: string
  updatedAt: string
}

export type MerchantListRow = Merchant & {
  tenantCount: number
  openRegionCount: number
  monthConsumption: number
}

export type TenantMerchantBinding = {
  id: string
  tenantId: string
  merchantId: string
  isPrimary: boolean
  bindingRole: TenantMerchantBindingRole
  effectiveFrom: string
  effectiveTo?: string | null
  remark?: string
}

export type MerchantTenantRow = TenantMerchantBinding & {
  tenantName: string
  platformTenantId: string
  customerId: string
  customerName: string
  tenantStatus: 'active' | 'inactive' | 'suspended'
}

export type MerchantDatacenterRegion = {
  id: string
  merchantId: string
  dataCenterId: string
  dataCenterName: string
  displayName?: string
  regionCode: string
  location: string
  status: MerchantRegionStatus
  availableGpuQuota: number | null
  usedGpuCount: number
  enabledCardTypeIds: string[]
  /** 由 tRPC 填充的卡型详情；Mock 层可能为空 */
  enabledCardTypes?: MerchantCardTypeRef[]
  /** 机房全部可售卡型及启用状态 */
  availableCardTypes?: MerchantRegionCardType[]
  effectiveFrom: string
  effectiveTo?: string | null
}

export type MerchantPurchasePrice = {
  id: string
  merchantId: string
  dataCenterId: string
  dataCenterName: string
  gpuCardTypeId: string
  cardTypeName: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  purchasePrice: number
  platformListPrice?: number
  source: 'manual' | 'inherit_l1' | 'platform_sync'
  status: 'draft' | 'active' | 'archived'
  effectiveFrom: string
}

export type MerchantRegionPricingCell = {
  gpuCardTypeId: string
  cardTypeName: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  purchasePrice: number | null
  platformListPrice: number | null
  source: MerchantPurchasePrice['source'] | null
}

export type MerchantRegionPricingForm = {
  effectiveFrom: string
  cells: MerchantRegionPricingCell[]
}

export type MerchantConsumptionDaily = {
  merchantId: string
  usageDate: string
  usageMonth: string
  productLine: PlatformProductLine | 'all'
  tenantCount: number
  amount: number
  voucherAmount: number
  balanceAmount: number
  totalCardHours: number
}

export type MerchantConsumptionSummary = {
  monthAmount: number
  monthVoucherAmount: number
  monthBalanceAmount: number
  activeTenantCount: number
  compareGongjiAmount?: number
}

export type MerchantCardTypeRef = {
  id: string
  name: string
  manufacturer: string
  memoryGB: number
}

/** 机房区域可售卡型及启用状态 */
export type MerchantRegionCardType = MerchantCardTypeRef & {
  enabled: boolean
}

export type MerchantRechargeAttachment = {
  id: string
  name: string
  mimeType: string
  size: number
  /** Mock 层以 data URL 存储；接入后端后改为 fileUrl */
  dataUrl: string
}

export type MerchantRechargeRecord = {
  id: string
  merchantId: string
  amount: number
  paymentMethod: string
  status: MerchantRechargeStatus
  transactionId?: string
  rechargeDate: string
  remark?: string
  attachments: MerchantRechargeAttachment[]
  source: MerchantRechargeSource
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type MerchantRechargeAuditLog = {
  id: string
  rechargeId: string
  merchantId: string
  action: MerchantRechargeAuditAction
  operatorName: string
  occurredAt: string
  changes?: Record<string, { from: unknown; to: unknown }>
  remark?: string
}

export type MerchantActivityAttachment = {
  id: string
  name: string
  size: number
  url: string
  mimeType?: string
}

export type MerchantActivity = {
  id: string
  merchantId: string
  type: MerchantActivityType
  title: string
  description?: string
  authorName: string
  authorRole: 'staff' | 'system'
  occurredAt: string
  attachments?: MerchantActivityAttachment[]
}

/** 平台已有机房（商户区域配置时仅可从中选择） */
export type MerchantPlatformDatacenter = {
  id: string
  name: string
  code: string
  location: string
  regionCode: string
  status: 'online' | 'offline' | 'maintenance'
}
