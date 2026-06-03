/** 导入文件类型（DB file_type） */
export const IMPORT_FILE_TYPES = {
  customer_consumption: 'customer_consumption',
  baremetal_order: 'baremetal_order',
  tenant_bill: 'tenant_bill',
  personal_tenant_bill: 'personal_tenant_bill',
  personal_baremetal_order: 'personal_baremetal_order',
} as const

export type ImportFileType = (typeof IMPORT_FILE_TYPES)[keyof typeof IMPORT_FILE_TYPES]

export const PERSONAL_IMPORT_FILE_TYPES = [
  IMPORT_FILE_TYPES.personal_tenant_bill,
  IMPORT_FILE_TYPES.personal_baremetal_order,
] as const

export type PersonalImportFileType = (typeof PERSONAL_IMPORT_FILE_TYPES)[number]

/** UI 槽位 → DB file_type */
export const SLOT_TO_FILE_TYPE = {
  customer: IMPORT_FILE_TYPES.customer_consumption,
  baremetal: IMPORT_FILE_TYPES.baremetal_order,
  tenantBill: IMPORT_FILE_TYPES.tenant_bill,
  personalTenantBill: IMPORT_FILE_TYPES.personal_tenant_bill,
  personalBaremetal: IMPORT_FILE_TYPES.personal_baremetal_order,
} as const

export type ImportSlotKey = keyof typeof SLOT_TO_FILE_TYPE

export function isPersonalImportFileType(
  fileType: ImportFileType,
): fileType is PersonalImportFileType {
  return (PERSONAL_IMPORT_FILE_TYPES as readonly string[]).includes(fileType)
}

export const PERSONAL_INCOME_RULE_VERSION = 'v1.0'

export const PERSONAL_INCOME_SUMMARY_KINDS = {
  nonProject: 'non_project',
  blacklist: 'blacklist',
} as const

export type PersonalIncomeSummaryKind =
  (typeof PERSONAL_INCOME_SUMMARY_KINDS)[keyof typeof PERSONAL_INCOME_SUMMARY_KINDS]

export const PURGE_SCOPES = [
  'file_type',
  'derived',
  'derived_income',
  'derived_cost',
  'full',
] as const
export type PurgeScope = (typeof PURGE_SCOPES)[number]

export const PERIOD_STATUSES = [
  'draft',
  'imported',
  'import_error',
  'pending_allocation',
  'pending_pricing',
  'computed',
  'published',
  'adjusted',
  'void',
] as const

export type PeriodStatus = (typeof PERIOD_STATUSES)[number]

export const RULE_VERSION = 'v1.6.0'
