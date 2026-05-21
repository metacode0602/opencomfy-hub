import type { CooperationMode, Supplier, SupplierOnboardingType } from '@/lib/data/types'

export const SUPPLIER_IMPORT_MAX_ROWS = 500
export const SUPPLIER_IMPORT_MAX_BYTES = 10 * 1024 * 1024

/** 文件选择器 accept 属性 */
export const SUPPLIER_IMPORT_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt'

export function isSupplierImportFileName(fileName: string): boolean {
  const name = fileName.toLowerCase()
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv') ||
    name.endsWith('.txt')
  )
}

export function isSupplierImportCsvFileName(fileName: string): boolean {
  const name = fileName.toLowerCase()
  return name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')
}

export type SupplierImportAction = 'create' | 'update' | 'skip'

export type SupplierImportParseStatus = 'ok' | 'warning' | 'error'

/** Excel 解析后的单行原始数据 */
export type SupplierImportParsedRow = {
  row_no: number
  external_onboarding_id?: string
  platform_tenant_id?: string
  onboarding_type?: SupplierOnboardingType
  name?: string
  identity_no?: string
  business_scope?: string
  address?: string
  contact_person?: string
  contact_phone?: string
  business_license_uri?: string
  id_card_front_uri?: string
  id_card_back_uri?: string
  bank_name?: string
  bank_branch_name?: string
  bank_account?: string
  bank_branch_address?: string
  admin_phone?: string
  admin_email?: string
  device_info_raw?: string
  audit_status_raw?: string
  audit_status?: string
  audit_confirmed?: boolean
  audit_remark?: string
  cooperation_mode?: CooperationMode
  status?: Supplier['status']
  source_created_at?: string
  source_updated_at?: string
  field_warnings: string[]
  /** 原始 Excel/CSV 单元格（与 originalHeaders 对齐） */
  originalCells: (string | number | null)[]
}

export type SupplierImportPreviewRow = {
  row_no: number
  name?: string
  onboarding_type?: SupplierOnboardingType
  identity_no?: string
  action: SupplierImportAction
  matched_supplier_id?: string
  business_manager_note: 'will_set' | 'keep_existing'
  business_manager_label?: string
  parse_status: SupplierImportParseStatus
  parse_message?: string
  field_warnings: string[]
  /** 阻断导入的错误 */
  errors: string[]
  /** 可导入但需关注的告警 */
  warnings: string[]
  /** 有问题的标准列名 */
  errorFields: string[]
  /** 对应原始文件列索引（0-based） */
  errorColumnIndexes: number[]
  /** 是否可参与 commit */
  selectable: boolean
}

export type SupplierImportPreviewResult = {
  fileName: string
  originalHeaders: string[]
  columnCanonicalByIndex: (string | null)[]
  rows: SupplierImportPreviewRow[]
  parsedRows: SupplierImportParsedRow[]
  /** 原始行快照，供导出错误 Excel */
  parsedSnapshot: Array<{
    row_no: number
    originalCells: (string | number | null)[]
  }>
  summary: {
    total: number
    ok: number
    warn: number
    error: number
    create: number
    update: number
    skip: number
  }
}

export type SupplierImportCommitError = {
  row_no: number
  message: string
}

export type SupplierImportCommitResult = {
  created: number
  updated: number
  failed: number
  skipped: number
  errors: SupplierImportCommitError[]
}

export type SupplierImportErrorExportRow = {
  row_no: number
  originalCells: (string | number | null)[]
  errorColumnIndexes: number[]
  errors: string[]
}
