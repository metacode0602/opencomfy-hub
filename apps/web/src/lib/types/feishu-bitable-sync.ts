import type {
  FeishuBitableFieldMapping,
  FeishuBitableSyncCursor,
  FeishuBitableSyncKind,
} from '@/lib/server/integrations/feishu/bitable-field-mapper'

export type { FeishuBitableSyncKind, FeishuBitableFieldMapping, FeishuBitableSyncCursor }

export type FeishuBitableSyncConfigDto = {
  id: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  dataCenterCode: string
  syncKind: FeishuBitableSyncKind
  appToken: string
  tableId: string
  viewId: string | null
  fieldMappingJson: FeishuBitableFieldMapping
  filterFormula: string | null
  cronExpr: string
  autoCommit: boolean
  cursorJson: FeishuBitableSyncCursor
  enabled: boolean
  lastRunAt: string | null
  lastSuccessAt: string | null
  createdAt: string
  updatedAt: string
}

export type FeishuBitableFieldMatchSuggestion = {
  fieldId: string
  fieldName: string
  type: number
  suggestedExcelHeader: string | null
}

export type FeishuBitableSyncPreviewResult = {
  recordCount: number
  parsedRowCount: number
  okCount: number
  warningCount: number
  errorCount: number
  parseError: string | null
  sampleErrors: Array<{ rowNo: number; message: string | null }>
  missingRequiredHeaders: string[]
}

export type FeishuBitableSyncRunResult = {
  jobRunId: string
  status: 'success' | 'failed' | 'skipped' | 'partial'
  message?: string
  preview?: FeishuBitableSyncPreviewResult
  commit?: {
    batchId: string
    batchCode: string
    committedCount: number
  }
}

export type FeishuBitableSyncJobRunDto = {
  id: string
  status: string
  supplierId: string | null
  refId: string | null
  requestSummary: Record<string, unknown> | null
  responseSummary: Record<string, unknown> | null
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
}

export const FEISHU_BITABLE_SYNC_KIND_LABELS: Record<FeishuBitableSyncKind, string> = {
  device_inventory: '设备主数据',
  device_changelog: '设备变更',
}
