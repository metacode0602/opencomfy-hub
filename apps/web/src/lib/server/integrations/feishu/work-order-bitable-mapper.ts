import 'server-only'

import { buildWorkOrderContent } from './work-order-content-builder'
import {
  DEFAULT_FEISHU_WORK_ORDER_DEFAULTS,
  FEISHU_WORK_ORDER_BITABLE_COLUMN_SUGGESTIONS,
  type FeishuWorkOrderDefaults,
  type FeishuWorkOrderFieldKey,
  type FeishuWorkOrderFieldMapping,
} from '@/lib/types/feishu-work-order'
import type { onboardingBatch } from '@workspace/db/schema'

type BatchRow = typeof onboardingBatch.$inferSelect

const OUTBOUND_SKIP_KEYS = new Set<FeishuWorkOrderFieldKey>([
  'ticket_no',
  'handler_feedback',
  'completed_at',
  'attachments',
])

export type BuildWorkOrderBitableFieldsInput = {
  batch: BatchRow
  mapping: FeishuWorkOrderFieldMapping
  defaults: FeishuWorkOrderDefaults
  submitterOpenId: string | null
  appBaseUrl: string
  fieldIdToName: Map<string, string>
  containerInstanceRegion?: string | null
}

function resolveBitableFieldName(fieldId: string, fieldIdToName: Map<string, string>): string | null {
  return fieldIdToName.get(fieldId.trim()) ?? null
}

export function buildFieldIdToNameMap(
  bitableFields: Array<{ fieldId: string; fieldName: string }>,
): Map<string, string> {
  return new Map(bitableFields.map((field) => [field.fieldId, field.fieldName]))
}

function personFieldValue(openIds: string[]): Array<{ id: string }> | undefined {
  const ids = openIds.filter(Boolean)
  if (!ids.length) return undefined
  return ids.map((id) => ({ id }))
}

function resolveFieldValues(input: BuildWorkOrderBitableFieldsInput): Record<FeishuWorkOrderFieldKey, unknown> {
  const defaults = { ...DEFAULT_FEISHU_WORK_ORDER_DEFAULTS, ...input.defaults }
  const { batch } = input
  const batchUrl =
    input.appBaseUrl && batch.id
      ? `${input.appBaseUrl}/supplier/onboarding-batches/${batch.id}`
      : null

  return {
    ticket_no: null,
    module: defaults.module ?? '资源接入',
    work_order_content: buildWorkOrderContent(batch, input.containerInstanceRegion),
    work_order_status: defaults.initial_status ?? '待审核',
    priority: defaults.priority ?? '紧急-P0',
    category: defaults.category ?? '集群机器上下架',
    assignees: personFieldValue(defaults.assignee_open_ids ?? []),
    submitter: input.submitterOpenId ? personFieldValue([input.submitterOpenId]) : undefined,
    remark: batch.remark?.trim() || batch.retireRemark?.trim() || null,
    handler_feedback: null,
    completed_at: null,
    attachments: null,
    ...(batchUrl ? {} : {}),
  }
}

/** 构建 Bitable create record 的 fields（键为 field_name，飞书 API 要求用列名而非 field_id） */
export function buildWorkOrderBitableRecordFields(
  input: BuildWorkOrderBitableFieldsInput,
): Record<string, unknown> {
  const values = resolveFieldValues(input)
  const fields: Record<string, unknown> = {}
  const unresolvedFieldIds: string[] = []

  for (const [fieldKey, fieldId] of Object.entries(input.mapping)) {
    const key = fieldKey as FeishuWorkOrderFieldKey
    if (!fieldId?.trim() || OUTBOUND_SKIP_KEYS.has(key)) continue
    const value = values[key]
    if (value == null || value === '') continue

    const fieldName = resolveBitableFieldName(fieldId, input.fieldIdToName)
    if (!fieldName) {
      unresolvedFieldIds.push(fieldId.trim())
      continue
    }
    fields[fieldName] = value
  }

  if (unresolvedFieldIds.length > 0) {
    throw new Error(
      `工单字段映射无效，以下 field_id 在 Bitable 表中不存在：${unresolvedFieldIds.join('、')}。请在设置页重新拉取表字段并保存映射。`,
    )
  }

  return fields
}

export function autoMatchWorkOrderFields(
  bitableFields: Array<{ fieldId: string; fieldName: string }>,
): FeishuWorkOrderFieldMapping {
  const mapping: FeishuWorkOrderFieldMapping = {}

  for (const field of bitableFields) {
    const name = field.fieldName.trim()
    const key = FEISHU_WORK_ORDER_BITABLE_COLUMN_SUGGESTIONS[name]
    if (key) {
      mapping[key] = field.fieldId
    }
  }
  return mapping
}

export function extractTicketNoFromRecordFields(
  fields: Record<string, unknown>,
  ticketNoFieldId: string | undefined,
  fieldIdToName?: Map<string, string>,
): string | null {
  if (!ticketNoFieldId) return null
  const fieldKey = fieldIdToName?.get(ticketNoFieldId.trim()) ?? ticketNoFieldId.trim()
  const raw = fields[fieldKey]
  if (raw == null) return null
  const text = typeof raw === 'number' ? String(raw) : String(raw)
  const trimmed = text.trim()
  return trimmed || null
}
