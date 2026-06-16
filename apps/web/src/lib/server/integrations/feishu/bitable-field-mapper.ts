import 'server-only'

import {
  extractFeishuBitableFieldText,
  formatFeishuBitableDateValue,
  type FeishuBitableField,
  type FeishuBitableRecord,
} from './bitable-client'

export type FeishuBitableSyncKind = 'device_inventory' | 'device_changelog'

export type FeishuBitableFieldMapping = Record<string, string>

export type FeishuBitableSyncCursor = {
  lastModifiedMs?: number
  lastRecordId?: string
}

const INVENTORY_CANONICAL_HEADERS = [
  '设备ID',
  '内网IP地址',
  '设备标识',
  '显卡型号',
  '显卡数量',
  '设备状态',
  '维修中',
  'K8s集群',
  '集群中节点名称',
  '集群角色',
  '预期集群提供服务',
  '设备配置',
  '设备接收时间',
  '带宽组',
  '限速',
  '备注',
  '登录用户名',
  '登录密码',
] as const

const CHANGELOG_CANONICAL_HEADERS = [
  '设备ID',
  '内网IP',
  '操作时间',
  '变更动作',
  '变更内容',
  '详细说明',
  '工单',
] as const

const HEADER_ALIASES: Record<string, string[]> = {
  设备ID: ['设备id', 'external_device_id', '记录ID', '记录id'],
  内网IP地址: ['ip地址', 'IP地址', '内网ip', '内网IP', 'internal_ip'],
  内网IP: ['内网ip地址', 'ip地址', 'IP地址', '内网ip', 'internal_ip'],
  设备标识: ['asset_no', 'sn'],
  显卡型号: ['gpu_card_type', '卡型'],
  显卡数量: ['gpu_count'],
  设备状态: ['ops_status'],
  维修中: ['in_maintenance'],
  带宽组: ['bandwidth_group'],
  限速: ['rate_limit'],
  设备配置: ['device_spec'],
  设备接收时间: ['received_at'],
  备注: ['remark'],
  登录用户名: ['root_account', 'login_username'],
  登录密码: ['root_password', 'login_password'],
  'K8s集群': ['k8s集群', '集群', 'cluster_name'],
  集群中节点名称: ['node_name'],
  集群角色: ['node_role'],
  预期集群提供服务: ['expected_service'],
  操作时间: ['occurred_at'],
  变更动作: ['change_action'],
  变更内容: ['change_content'],
  详细说明: ['description'],
  工单: ['ticket_no'],
}

function normHeader(s: string): string {
  return s.replace(/^\ufeff/, '').trim().replace(/\s+/g, '').toLowerCase()
}

function canonicalHeadersForKind(syncKind: FeishuBitableSyncKind): readonly string[] {
  return syncKind === 'device_inventory' ? INVENTORY_CANONICAL_HEADERS : CHANGELOG_CANONICAL_HEADERS
}

function headerMatchesAlias(canonical: string, bitableFieldName: string): boolean {
  const normalized = normHeader(bitableFieldName)
  if (normHeader(canonical) === normalized) return true
  const aliases = HEADER_ALIASES[canonical] ?? []
  return aliases.some((alias) => normHeader(alias) === normalized)
}

export function getCanonicalHeadersForSyncKind(syncKind: FeishuBitableSyncKind): string[] {
  return [...canonicalHeadersForKind(syncKind)]
}

export function autoMatchFeishuBitableFields(
  bitableFields: FeishuBitableField[],
  syncKind: FeishuBitableSyncKind,
): FeishuBitableFieldMapping {
  const mapping: FeishuBitableFieldMapping = {}
  const canonicalHeaders = canonicalHeadersForKind(syncKind)

  for (const canonical of canonicalHeaders) {
    const matched = bitableFields.find((field) => headerMatchesAlias(canonical, field.field_name))
    if (matched) {
      mapping[canonical] = matched.field_id
    }
  }

  return mapping
}

export function buildFieldIdToNameMap(
  bitableFields: FeishuBitableField[],
): Map<string, string> {
  return new Map(bitableFields.map((field) => [field.field_id, field.field_name]))
}

function extractMappedCellValue(
  record: FeishuBitableRecord,
  fieldId: string,
  fieldIdToName: Map<string, string>,
  canonicalHeader: string,
): string {
  const fieldName = fieldIdToName.get(fieldId)
  if (!fieldName) return ''
  const raw = record.fields[fieldName]
  if (canonicalHeader === '操作时间' || canonicalHeader === '设备接收时间') {
    return formatFeishuBitableDateValue(raw)
  }
  return extractFeishuBitableFieldText(raw)
}

export function mapBitableRecordsToImportRows(input: {
  records: FeishuBitableRecord[]
  fieldMapping: FeishuBitableFieldMapping
  fieldIdToName: Map<string, string>
  syncKind: FeishuBitableSyncKind
}): Record<string, string>[] {
  const headers = canonicalHeadersForKind(input.syncKind)
  const mappedHeaders = headers.filter((header) => input.fieldMapping[header])

  return input.records.map((record) => {
    const row: Record<string, string> = {}
    for (const header of mappedHeaders) {
      const fieldId = input.fieldMapping[header]
      if (!fieldId) continue
      row[header] = extractMappedCellValue(record, fieldId, input.fieldIdToName, header)
    }
    return row
  })
}

export function filterRecordsByCursor(
  records: FeishuBitableRecord[],
  cursor: FeishuBitableSyncCursor,
): FeishuBitableRecord[] {
  if (!cursor.lastModifiedMs) return records
  return records.filter((record) => {
    const modified = record.last_modified_time ?? 0
    if (modified > cursor.lastModifiedMs!) return true
    if (modified === cursor.lastModifiedMs && cursor.lastRecordId) {
      return record.record_id > cursor.lastRecordId
    }
    return false
  })
}

export function computeNextCursor(records: FeishuBitableRecord[]): FeishuBitableSyncCursor {
  if (records.length === 0) return {}
  let maxModified = 0
  let lastRecordId: string | undefined
  for (const record of records) {
    const modified = record.last_modified_time ?? 0
    if (modified > maxModified) {
      maxModified = modified
      lastRecordId = record.record_id
    } else if (modified === maxModified && record.record_id > (lastRecordId ?? '')) {
      lastRecordId = record.record_id
    }
  }
  return {
    lastModifiedMs: maxModified || undefined,
    lastRecordId,
  }
}

export function getRequiredHeadersForSyncKind(syncKind: FeishuBitableSyncKind): string[] {
  if (syncKind === 'device_inventory') return ['设备状态']
  return ['操作时间', '变更动作']
}

export function validateFieldMapping(
  fieldMapping: FeishuBitableFieldMapping,
  syncKind: FeishuBitableSyncKind,
): string[] {
  const missing = getRequiredHeadersForSyncKind(syncKind).filter((header) => !fieldMapping[header])
  return missing
}
