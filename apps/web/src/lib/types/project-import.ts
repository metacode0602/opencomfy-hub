import type { ProjectStage } from '@/lib/types/crm'

export type ProjectImportStage = ProjectStage
export type ProjectImportStatus = 'active' | 'paused' | 'completed'

export type ProjectImportStaffRole =
  | 'pre_sales'
  | 'account_manager'
  | 'delivery_manager'
  | 'project_manager'

export type ProjectImportCustomerStrategy =
  | 'link_tenant'
  | 'create_customer'
  | 'existing_customer'

export type ProjectImportStaffPreview = {
  name: string
  staffId?: string
  willCreate: boolean
}

export type ProjectImportPreviewRow = {
  rowIndex: number
  projectName: string
  platformTenantId?: string
  customerStrategy: ProjectImportCustomerStrategy
  customerPreview: {
    id?: string
    name: string
    shortName: string
  }
  tenantPreview?: {
    id?: string
    platformTenantId?: string
    name?: string
  }
  tags: string[]
  staffPreview: Partial<Record<ProjectImportStaffRole, ProjectImportStaffPreview>>
  mapped: {
    stage: ProjectImportStage
    stageLabel: string
    status: ProjectImportStatus
    statusLabel: string
    businessLineName: string
    businessLineId?: string
    description?: string
    computeScale?: string
    progressUpdate?: string
    nextPlan?: string
    issuesRequirements?: string
    creatorName?: string
    startDate?: string
  }
  financePreview?: {
    totalConsumption?: string
    balanceConsumption?: string
    bareMetalConsumption?: string
  }
  action: 'create' | 'update' | 'skip'
  warnings: string[]
  errors: string[]
  /** 有问题的标准列名 */
  errorFields: string[]
  /** 对应原始 Excel 列索引（0-based，不含错误原因列） */
  errorColumnIndexes: number[]
  selectable: boolean
  existingProjectId?: string
}

export type ProjectImportPreviewResult = {
  previewToken: string
  fileName: string
  rows: ProjectImportPreviewRow[]
  originalHeaders: string[]
  summary: {
    total: number
    ok: number
    error: number
    warn: number
    create: number
    update: number
    skip: number
  }
  missingRequiredHeaders: string[]
  /** 原始行快照，供客户端导出错误 Excel */
  parsedSnapshot: Array<{
    rowIndex: number
    originalCells: (string | number | null)[]
  }>
}

export type ProjectImportCommitOptions = {
  allowCreateStaff: boolean
  rowIndexes?: number[]
}

export type ProjectImportCommitResult = {
  createdProjects: number
  updatedProjects: number
  createdCustomers: number
  createdTenants: number
  createdStaff: number
  skipped: number
  errors: { rowIndex: number; message: string }[]
}

export type ProjectImportParsedRow = {
  rowIndex: number
  raw: Record<string, string | number | null>
  originalCells: (string | number | null)[]
}

export type ProjectImportParseResult = {
  rows: ProjectImportParsedRow[]
  originalHeaders: string[]
  columnCanonicalByIndex: (string | null)[]
}

export type ProjectImportErrorExportRow = {
  rowIndex: number
  originalCells: (string | number | null)[]
  errorColumnIndexes: number[]
  errors: string[]
}
