import type { OpportunitySource } from '@/lib/crm/commission-constants'

export type OpportunityImportField =
  | '项目名称'
  | '租户ID'
  | '业务线'
  | '商机来源'
  | '销售'
  | '交付'
  | '项目经理'
  | '售前'
  | '创建时间'

export type OpportunityImportStaffRole =
  | 'account_manager'
  | 'delivery_manager'
  | 'project_manager'
  | 'pre_sales'

export type OpportunityImportStaffPreview = {
  name: string
  staffId?: string
  willCreate?: boolean
}

export type OpportunityImportPreviewRow = {
  rowIndex: number
  projectName: string
  excelTenantId: string
  resolvedPlatformTenantId?: string
  resolvedTenantName?: string
  projectId?: string
  resolvedProjectName?: string
  businessLineName?: string

  opportunitySource?: OpportunitySource | null
  opportunitySourceLabel?: string

  staff: Partial<Record<OpportunityImportStaffRole, OpportunityImportStaffPreview>>

  accountManagerStaffId?: string | null
  deliveryManagerStaffId?: string | null
  projectManagerStaffId?: string | null
  preSalesStaffId?: string | null

  effectiveFrom: string

  current?: {
    opportunitySource?: OpportunitySource | null
    accountManager?: string
    deliveryManager?: string
    projectManager?: string
    preSales?: string
  }

  warnings: string[]
  errors: string[]
  selectable: boolean
  action: 'update' | 'skip' | 'error'
  selected: boolean
}

export type OpportunityImportPreviewResult = {
  previewToken: string
  fileName: string
  rows: OpportunityImportPreviewRow[]
  summary: { total: number; ok: number; error: number; warn: number }
  ignoredColumnNames: string[]
  ignoredColumnCount: number
  matchedColumns: Partial<Record<OpportunityImportField, string>>
  duplicateRowKeys: boolean
}

export type OpportunityImportParsedRow = {
  rowIndex: number
  raw: Record<string, string | number | null>
}

export type OpportunityImportParseResult = {
  rows: OpportunityImportParsedRow[]
  columnCanonicalByIndex: (string | null)[]
  originalHeaders: string[]
  matchedColumns: Partial<Record<OpportunityImportField, string>>
  ignoredColumnNames: string[]
  duplicateColumnWarnings: string[]
}

export type OpportunityImportRowOverride = {
  rowIndex: number
  opportunitySource?: OpportunitySource | null
  accountManagerStaffId?: string | null
  deliveryManagerStaffId?: string | null
  projectManagerStaffId?: string | null
  preSalesStaffId?: string | null
  effectiveFrom?: string
  selected?: boolean
}

export type OpportunityImportCommitOptions = {
  allowCreateStaff: boolean
  rowIndexes?: number[]
  rowOverrides?: OpportunityImportRowOverride[]
  createdByStaffId?: string | null
}

export type OpportunityImportCommitResult = {
  updatedOpportunitySource: number
  updatedAccountManager: number
  updatedDeliveryManager: number
  updatedProjectManager: number
  updatedPreSales: number
  skipped: number
  failed: Array<{ rowIndex: number; message: string }>
}
