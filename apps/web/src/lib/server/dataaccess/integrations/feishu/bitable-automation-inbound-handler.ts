import 'server-only'

import { loadFeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import { normalizeWorkOrderInboundFields } from '@/lib/server/integrations/feishu/work-order-inbound-mapper'
import { feishuWorkOrderConfigDataAccess } from '@/lib/server/dataaccess/integrations/feishu/work-order-config'
import { syncWorkOrderInbound } from '@/lib/server/dataaccess/integrations/feishu/sync-work-order-inbound'
import type { FeishuBitableAutomationInboundPayload } from '@/lib/types/feishu-work-order'

export type HandleBitableAutomationInboundResult = {
  ok: boolean
  code?: string
  batchId?: string
  nextBatchStatus?: string
}

function parseOccurredAt(raw: string | undefined): Date {
  if (raw?.trim()) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function buildIdempotencyKey(payload: FeishuBitableAutomationInboundPayload): string {
  if (payload.idempotency_key?.trim()) return payload.idempotency_key.trim()
  const status = payload.work_order_status.trim()
  const occurred = payload.occurred_at?.trim() ?? String(Date.now())
  return `${payload.record_id}:${status}:${occurred}`
}

export async function handleFeishuBitableAutomationInbound(
  payload: FeishuBitableAutomationInboundPayload,
): Promise<HandleBitableAutomationInboundResult> {
  const runtime = loadFeishuRuntimeConfig()
  const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
  if (!runtime?.enabled || !woConfig?.enabled) {
    return { ok: false, code: 'feishu_disabled' }
  }

  const recordId = payload.record_id?.trim()
  const workOrderStatus = payload.work_order_status?.trim()
  if (!recordId || !workOrderStatus) {
    return { ok: false, code: 'invalid_payload' }
  }

  const ticketNo =
    payload.ticket_no?.trim() ||
    (typeof payload.fields['工单ID编号'] === 'string' ? payload.fields['工单ID编号'].trim() : null) ||
    (typeof payload.fields.ticket_no === 'string' ? payload.fields.ticket_no.trim() : null) ||
    null

  const normalized = normalizeWorkOrderInboundFields(
    payload.fields,
    woConfig.fieldMappingJson,
    new Map(),
  )
  if (!normalized.fieldsSnapshot.work_order_status) {
    normalized.fieldsSnapshot.work_order_status = workOrderStatus
  }

  const occurredAt = parseOccurredAt(payload.occurred_at)
  const result = await syncWorkOrderInbound({
    inboundChannel: 'bitable_automation',
    recordId,
    ticketNo,
    workOrderStatus,
    previousStatus: payload.previous_status?.trim() || null,
    occurredAt,
    idempotencyKey: buildIdempotencyKey(payload),
    normalized,
    runtime,
    woConfig,
    jobKind: 'bitable_automation_inbound',
  })

  if (!result.ok) {
    return { ok: false, code: result.code }
  }
  return {
    ok: true,
    batchId: result.batchId,
    nextBatchStatus: result.nextBatchStatus,
  }
}
