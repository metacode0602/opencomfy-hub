import 'server-only'

import { extractFeishuBitableFieldText, formatFeishuBitableDateValue } from './bitable-client'
import {
  FEISHU_WORK_ORDER_BITABLE_COLUMN_SUGGESTIONS,
  FEISHU_WORK_ORDER_FIELD_KEY_LABELS,
  type FeishuWorkOrderFieldKey,
  type FeishuWorkOrderFieldMapping,
} from '@/lib/types/feishu-work-order'

function normalizeFieldValue(fieldKey: FeishuWorkOrderFieldKey, raw: unknown): unknown {
  if (raw == null) return null
  if (fieldKey === 'completed_at') {
    const text = formatFeishuBitableDateValue(raw)
    return text || null
  }
  if (fieldKey === 'assignees' || fieldKey === 'submitter') {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>
            return typeof obj.id === 'string' ? obj.id : extractFeishuBitableFieldText(item)
          }
          return extractFeishuBitableFieldText(item)
        })
        .filter(Boolean)
    }
    const text = extractFeishuBitableFieldText(raw)
    return text ? [text] : null
  }
  if (fieldKey === 'attachments') {
    if (Array.isArray(raw)) return raw
    const text = extractFeishuBitableFieldText(raw)
    return text || null
  }
  const text = extractFeishuBitableFieldText(raw)
  return text || null
}

function resolveFieldKeyFromColumnName(
  columnName: string,
  fieldMapping: FeishuWorkOrderFieldMapping,
  fieldIdToName: Map<string, string>,
): FeishuWorkOrderFieldKey | null {
  const trimmed = columnName.trim()
  const bySuggestion = FEISHU_WORK_ORDER_BITABLE_COLUMN_SUGGESTIONS[trimmed]
  if (bySuggestion) return bySuggestion

  for (const [fieldKey, fieldId] of Object.entries(fieldMapping) as Array<
    [FeishuWorkOrderFieldKey, string]
  >) {
    if (!fieldId?.trim()) continue
    if (fieldId.trim() === trimmed) return fieldKey
    const mappedName = fieldIdToName.get(fieldId.trim())
    if (mappedName === trimmed) return fieldKey
  }

  if (trimmed in FEISHU_WORK_ORDER_FIELD_KEY_LABELS) {
    return trimmed as FeishuWorkOrderFieldKey
  }
  return null
}

export type NormalizedWorkOrderInboundFields = {
  fieldsSnapshot: Partial<Record<FeishuWorkOrderFieldKey, unknown>>
  fieldsDisplay: Record<string, unknown>
}

export function normalizeWorkOrderInboundFields(
  rawFields: Record<string, unknown>,
  fieldMapping: FeishuWorkOrderFieldMapping,
  fieldIdToName: Map<string, string> = new Map(),
): NormalizedWorkOrderInboundFields {
  const fieldsSnapshot: Partial<Record<FeishuWorkOrderFieldKey, unknown>> = {}
  const fieldsDisplay: Record<string, unknown> = {}

  for (const [columnName, rawValue] of Object.entries(rawFields)) {
    const displayValue = normalizeFieldValue('remark', rawValue)
    fieldsDisplay[columnName] = displayValue

    const fieldKey = resolveFieldKeyFromColumnName(columnName, fieldMapping, fieldIdToName)
    if (!fieldKey) continue
    fieldsSnapshot[fieldKey] = normalizeFieldValue(fieldKey, rawValue)
    fieldsDisplay[FEISHU_WORK_ORDER_FIELD_KEY_LABELS[fieldKey]] = fieldsSnapshot[fieldKey]
  }

  return { fieldsSnapshot, fieldsDisplay }
}

export function buildOperatorHint(
  fieldsSnapshot: Partial<Record<FeishuWorkOrderFieldKey, unknown>>,
): string | undefined {
  const assignees = fieldsSnapshot.assignees
  if (Array.isArray(assignees) && assignees.length) {
    return `经办人: ${assignees.join(', ')}`
  }
  if (typeof assignees === 'string' && assignees.trim()) {
    return `经办人: ${assignees.trim()}`
  }
  return undefined
}

export function buildWorkOrderSyncDescription(input: {
  workOrderStatus: string
  previousStatus?: string | null
  fieldsSnapshot: Partial<Record<FeishuWorkOrderFieldKey, unknown>>
}): string {
  const parts: string[] = []
  if (input.previousStatus?.trim()) {
    parts.push(`状态: ${input.previousStatus.trim()} → ${input.workOrderStatus.trim()}`)
  } else {
    parts.push(`飞书工单状态: ${input.workOrderStatus.trim()}`)
  }
  const feedback = fieldsSnapshotText(input.fieldsSnapshot.handler_feedback)
  if (feedback) parts.push(`处理反馈: ${feedback}`)
  const remark = fieldsSnapshotText(input.fieldsSnapshot.remark)
  if (remark) parts.push(`备注: ${remark}`)
  return parts.join(' · ')
}

function fieldsSnapshotText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  return extractFeishuBitableFieldText(value) || null
}
