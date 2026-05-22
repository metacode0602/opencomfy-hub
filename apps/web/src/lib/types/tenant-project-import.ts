import type { ProjectFormValues } from '@/components/dashboard/project-form-fields'

export type TenantProjectImportAction = 'create' | 'skip' | 'error'

export type TenantProjectImportFormValues = Pick<
  ProjectFormValues,
  | 'stage'
  | 'businessLineId'
  | 'preSalesStaffId'
  | 'accountManagerStaffId'
  | 'deliveryManagerStaffId'
  | 'projectManagerStaffId'
  | 'startDate'
> & {
  /** 可选，单选系统预置项目标签 */
  tagId: string
}

export type TenantProjectImportPreviewRow = {
  platformTenantId: string
  tenantName: string
  customerId?: string
  customerName?: string
  /** 拟创建的项目名称 */
  projectName: string
  action: TenantProjectImportAction
  /** 已存在项目（跳过时展示） */
  existingProjectId?: string
  existingProjectName?: string
  errors: string[]
  warnings: string[]
}

export type TenantProjectImportPreviewResult = {
  previewId: string
  formSnapshot: TenantProjectImportFormValues & { platformTenantIds: string[] }
  rows: TenantProjectImportPreviewRow[]
  summary: {
    total: number
    toCreate: number
    toSkip: number
    error: number
  }
}

export type TenantProjectImportCommitResult = {
  created: number
  skipped: number
  errors: { platformTenantId: string; message: string }[]
}

export type TenantProjectImportDialogPhase = 'idle' | 'fetching' | 'preview' | 'committing' | 'done'
