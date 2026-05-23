/** 导入文件类型（DB file_type） */
export const IMPORT_FILE_TYPES = {
  customer_consumption: 'customer_consumption',
  baremetal_order: 'baremetal_order',
  tenant_bill: 'tenant_bill',
} as const

export type ImportFileType = (typeof IMPORT_FILE_TYPES)[keyof typeof IMPORT_FILE_TYPES]

/** UI 槽位 → DB file_type */
export const SLOT_TO_FILE_TYPE = {
  customer: IMPORT_FILE_TYPES.customer_consumption,
  baremetal: IMPORT_FILE_TYPES.baremetal_order,
  tenantBill: IMPORT_FILE_TYPES.tenant_bill,
} as const

export type ImportSlotKey = keyof typeof SLOT_TO_FILE_TYPE

export const PURGE_SCOPES = ['file_type', 'derived', 'full'] as const
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

export const RULE_VERSION = 'v1.5.2'
