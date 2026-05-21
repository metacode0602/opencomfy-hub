import type { DataCenter } from '@/lib/data/types'

export const DATACENTER_IMPORT_MAX_ROWS = 500
export const DATACENTER_IMPORT_MAX_BYTES = 10 * 1024 * 1024
export const DATACENTER_IMPORT_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt'

export function isDatacenterImportFileName(fileName: string): boolean {
  const name = fileName.toLowerCase()
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv') ||
    name.endsWith('.txt')
  )
}

export type DatacenterImportAction = 'create' | 'skip' | 'error'

export type DatacenterImportSkipReason =
  | 'already_exists'
  | 'source_deleted'
  | 'empty_name'
  | 'code_collision'

export type DatacenterImportParseStatus = 'ok' | 'warning' | 'error'

export type DatacenterImportParsedRow = {
  row_no: number
  external_onboarding_id?: string
  platform_tenant_id?: string
  name?: string
  container_instance_region?: string
  bare_metal_region?: string
  description?: string
  scale?: string
  public_ip_count?: number
  internal_network_cidr?: string
  audit_status_raw?: string
  audit_status?: string
  audit_remark?: string
  source_deleted?: boolean
  status?: DataCenter['status']
  source_created_at?: string
  source_updated_at?: string
  field_warnings: string[]
}

export type DatacenterImportPreviewRow = {
  row_no: number
  name?: string
  external_onboarding_id?: string
  action: DatacenterImportAction
  skip_reason?: DatacenterImportSkipReason
  matched_data_center_id?: string
  derived_code?: string
  parse_status: DatacenterImportParseStatus
  parse_message?: string
  field_warnings: string[]
}

export type DatacenterImportPreviewResult = {
  fileName: string
  originalHeaders: string[]
  supplierId: string
  rows: DatacenterImportPreviewRow[]
  parsedRows: DatacenterImportParsedRow[]
  summary: {
    total: number
    ok: number
    warn: number
    error: number
    create: number
    skip: number
  }
}

export type DatacenterImportCommitError = {
  row_no: number
  message: string
}

export type DatacenterImportCommitResult = {
  created: number
  skipped: number
  failed: number
  errors: DatacenterImportCommitError[]
  created_ids?: string[]
}
