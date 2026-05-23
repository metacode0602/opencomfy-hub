import type { SupplierDevice } from '@/lib/types/supplier-domain'

export const DEVICE_RETIRE_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt'
export const DEVICE_RETIRE_MAX_BYTES = 10 * 1024 * 1024
export const DEVICE_RETIRE_MAX_ROWS = 2000

export const DEVICE_RETIRE_EXCEL_HEADERS = ['设备ID', '设备标识', '外网IP', '内网IP'] as const

export const DEVICE_RETIRE_REASON_OPTIONS = [
  { value: 'contract_expired', label: '合同到期退租' },
  { value: 'hardware_upgrade', label: '硬件升级替换' },
  { value: 'dc_closure', label: '机房裁撤' },
  { value: 'performance_issue', label: '性能不达标' },
  { value: 'business_adjustment', label: '业务调整' },
  { value: 'cost_optimization', label: '成本优化' },
  { value: 'other', label: '其他' },
] as const

export type DeviceRetireReason = (typeof DEVICE_RETIRE_REASON_OPTIONS)[number]['value']

export type DeviceRetireRequestMeta = {
  reason: DeviceRetireReason
  reasonLabel: string
  expectedCompletionDate: string
  remark: string
}

export function getDeviceRetireReasonLabel(reason: DeviceRetireReason): string {
  return DEVICE_RETIRE_REASON_OPTIONS.find((o) => o.value === reason)?.label ?? reason
}

export type DeviceRetireParseStatus = 'ok' | 'warning' | 'error'

export type DeviceRetireParsedRow = {
  row_no: number
  external_device_id: string | null
  asset_no: string | null
  external_ip: string | null
  internal_ip: string | null
  originalCells: string[]
  parse_status: DeviceRetireParseStatus
  errors: string[]
  warnings: string[]
  errorColumnIndexes: number[]
  matched_device_id: string | null
}

export type DeviceRetireBatchPreview = {
  dataCenterId: string
  dataCenterName: string
  fileName: string
  originalHeaders: string[]
  rows: DeviceRetireParsedRow[]
  summary: {
    total: number
    ok: number
    warning: number
    error: number
  }
}

export type DeviceRetirePreviewResult = {
  supplierId: string
  meta: DeviceRetireRequestMeta
  batches: DeviceRetireBatchPreview[]
  summary: {
    total: number
    ok: number
    warning: number
    error: number
    batchCount: number
  }
}

export type DeviceRetireCommitResult = {
  batchCount: number
  retiredCount: number
  skippedCount: number
  batchCodes: string[]
  meta: DeviceRetireRequestMeta
}

export type DeviceRetireErrorExportRow = {
  row_no: number
  originalCells: string[]
  errorColumnIndexes: number[]
  errors: string[]
}

export type DeviceRetireInventoryContext = {
  supplierId: string
  dataCenters: { id: string; name: string; code: string; location: string }[]
  devices: SupplierDevice[]
}

export type DeviceRetireBatchListItem = {
  id: string
  batchCode: string
  supplierId: string
  supplierName: string
  supplierShortName: string | null
  dataCenterId: string
  dataCenterName: string
  idcCode: string
  importStatus: string
  batchStatus: string
  workOrderNo: string | null
  plannedDeviceCount: number
  touchedDeviceCount: number
  retiredDeviceCount: number
  parsedRowCount: number
  parsedSuccessCount: number
  parsedErrorCount: number
  retireReason: string | null
  retireReasonLabel: string | null
  retirePlanMode: import('@/lib/types/datacenter-device-retire').RetirePlanMode | null
  retireActionType: import('@/lib/types/datacenter-device-retire').RetireActionType | null
  scenarioLabel: string | null
  progressFlags: import('@/lib/supplier/retire-changelog-utils').RetireProgressFlags | null
  expectedCompletionDate: string | null
  importFileName: string | null
  committedAt: string | null
  createdAt: string
}

export type DeviceRetireBatchDeviceItem = {
  deviceId: string
  sn: string
  assetNo: string | null
  externalDeviceId: string | null
  externalIp: string | null
  internalIp: string | null
  cardTypeName: string
  lifecycleStatus: string
  opsStatus: string
  previousLifecycleStatus: string | null
  previousOpsStatus: string | null
  linkKind?: string | null
  parseStatus: 'ok' | 'warning' | 'error' | null
  rowNo: number | null
  warnings: string[]
  errors: string[]
}

export type DeviceRetireBatchDetail = DeviceRetireBatchListItem & {
  idcRegion: string | null
  retireRemark: string | null
  parsedAt: string | null
  parsedRows: DeviceRetireParsedRow[]
  plannedLines: import('@/lib/types/onboarding-batch-api').OnboardingBatchPlannedLineJson[]
  devices: DeviceRetireBatchDeviceItem[]
}

export const DEVICE_RETIRE_IMPORT_STATUS_LABELS: Record<string, string> = {
  none: '无清单',
  draft: '草稿',
  uploaded: '已上传',
  parsing: '解析中',
  parsed: '清单已存',
  parse_failed: '解析失败',
  committing: '下架中',
  committed: '已下架',
  cancelled: '已取消',
}

export function isDeviceRetireFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.tsv') ||
    lower.endsWith('.txt')
  )
}
