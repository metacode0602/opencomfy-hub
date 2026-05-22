/** 租户账单同步 — 预览 / 提交类型（UI + 后续 tRPC 共用） */

export type TenantBillingImportDialogPhase = 'idle' | 'fetching' | 'preview' | 'committing'

export type TenantBillingImportAction = 'create' | 'update' | 'skip'

export type TenantBillingImportTab = 'metalOrders' | 'monthlyBills' | 'recharges' | 'billDetails'

export type TenantBillingImportSectionSummary = {
  total: number
  toCreate: number
  toUpdate: number
  skipped: number
}

export type TenantBillingImportSection<T> = {
  summary: TenantBillingImportSectionSummary
  items: T[]
  error?: string
}

export type MetalOrderPreviewItem = {
  key: string
  action: TenantBillingImportAction
  orderNo: string
  status: string
  idcName: string
  amountRmb: number
  deviceCount: number
  gpuSummary: string
  createTime: string
}

export type MonthlyBillPreviewItem = {
  key: string
  action: TenantBillingImportAction
  billMonth: string
  periodStart: string
  periodEnd: string
  totalAmountRmb: number
  couponAmountRmb: number
  balanceAmountRmb: number
}

export type RechargePreviewItem = {
  key: string
  action: TenantBillingImportAction
  transactionId: string
  amountRmb: number
  payChannel: string
  status: string
  createTime: string
  remark?: string
}

export type BillDetailPreviewItem = {
  key: string
  action: TenantBillingImportAction
  billMonth: string
  productLine: string
  resourceName: string
  amountRmb: number
  couponAmountRmb: number
  balanceAmountRmb: number
}

export type TenantBillingImportPreviewInput = {
  tenantId: string
  platformTenantId: string
  tenantName: string
  startDate?: string
  endDate?: string
}

export type TenantBillingImportPreviewResult = {
  previewId: string
  tenant: { platformTenantId: string; name: string }
  dateRange: { startDate?: string; endDate?: string }
  sections: {
    metalOrders: TenantBillingImportSection<MetalOrderPreviewItem>
    monthlyBills: TenantBillingImportSection<MonthlyBillPreviewItem>
    recharges: TenantBillingImportSection<RechargePreviewItem>
    billDetails: TenantBillingImportSection<BillDetailPreviewItem>
  }
}

export type TenantBillingImportCommitSectionResult = {
  created: number
  updated: number
  deleted?: number
  errors: { key: string; message: string }[]
}

export type TenantBillingImportCommitResult = {
  metalOrders: TenantBillingImportCommitSectionResult
  monthlyBills: TenantBillingImportCommitSectionResult
  recharges: TenantBillingImportCommitSectionResult
  billDetails: TenantBillingImportCommitSectionResult
}
