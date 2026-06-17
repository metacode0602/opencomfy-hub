import 'server-only'

import { db } from '@/lib/db'
import { supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import { feishuWorkOrderConfigDataAccess } from '@/lib/server/dataaccess/integrations/feishu/work-order-config'
import { syncWorkOrderInbound } from '@/lib/server/dataaccess/integrations/feishu/sync-work-order-inbound'
import {
  extractFeishuBitableFieldText,
  getFeishuBitableRecord,
  listFeishuBitableFields,
} from '@/lib/server/integrations/feishu/bitable-client'
import { loadFeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import { buildFieldIdToNameMap } from '@/lib/server/integrations/feishu/work-order-bitable-mapper'
import { normalizeWorkOrderInboundFields } from '@/lib/server/integrations/feishu/work-order-inbound-mapper'
import type { FeishuWebhookEnvelope } from '@/lib/server/integrations/feishu/types'
import { feishuIntegrationJobRun } from '@workspace/db/schema'

function newId() {
  return crypto.randomUUID()
}

export async function handleFeishuBitableRecordWebhook(
  envelope: FeishuWebhookEnvelope,
): Promise<{ handled: boolean; message?: string }> {
  const runtime = loadFeishuRuntimeConfig()
  const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
  if (!runtime?.enabled || !woConfig?.enabled || woConfig.workOrderBackend !== 'bitable') {
    return { handled: false, message: 'work_order_bitable_disabled' }
  }

  if (
    woConfig.inboundChannel !== 'event_subscription' &&
    woConfig.inboundChannel !== 'dual'
  ) {
    return { handled: false, message: 'event_subscription_disabled' }
  }

  const event = (envelope.event ?? {}) as Record<string, unknown>
  const recordId = String(event.record_id ?? event.recordId ?? '')
  const tableId = String(event.table_id ?? event.tableId ?? '')
  const fileToken = String(event.file_token ?? event.app_token ?? woConfig.appToken)

  if (!recordId || !tableId) {
    return { handled: false, message: 'missing_record_or_table' }
  }
  if (tableId !== woConfig.tableId) {
    return { handled: false, message: 'table_mismatch' }
  }

  const eventType = envelope.header?.event_type ?? envelope.type ?? 'bitable_record'
  const startedAt = new Date()

  try {
    const record = await getFeishuBitableRecord(runtime, fileToken, tableId, recordId)
    const bitableFields = await listFeishuBitableFields(runtime, fileToken, tableId)
    const fieldIdToName = buildFieldIdToNameMap(
      bitableFields.map((field) => ({ fieldId: field.field_id, fieldName: field.field_name })),
    )

    const rawFields: Record<string, unknown> = {}
    for (const [fieldName, value] of Object.entries(record.fields)) {
      rawFields[fieldName] = value
    }

    const statusFieldId = woConfig.fieldMappingJson.work_order_status
    const ticketFieldId = woConfig.fieldMappingJson.ticket_no
    const statusFieldName = statusFieldId ? fieldIdToName.get(statusFieldId) : undefined
    const ticketFieldName = ticketFieldId ? fieldIdToName.get(ticketFieldId) : undefined
    const workOrderStatus = statusFieldName
      ? extractFeishuBitableFieldText(record.fields[statusFieldName])
      : ''
    const ticketNo = ticketFieldName
      ? extractFeishuBitableFieldText(record.fields[ticketFieldName])
      : null

    if (!workOrderStatus.trim()) {
      return { handled: false, message: 'missing_work_order_status' }
    }

    const normalized = normalizeWorkOrderInboundFields(
      rawFields,
      woConfig.fieldMappingJson,
      fieldIdToName,
    )
    normalized.fieldsSnapshot.work_order_status = workOrderStatus.trim()

    const idempotencyKey = `${eventType}:${recordId}:${envelope.header?.create_time ?? Date.now()}`
    const result = await syncWorkOrderInbound({
      inboundChannel: 'event_subscription',
      recordId,
      ticketNo,
      workOrderStatus: workOrderStatus.trim(),
      occurredAt: startedAt,
      idempotencyKey,
      normalized,
      runtime,
      woConfig,
      jobKind: 'webhook',
    })

    if (!result.ok) {
      if (result.code === 'duplicate' || result.code === 'duplicate_cross_channel') {
        return { handled: true, message: result.code }
      }
      if (result.code === 'batch_not_found') {
        return { handled: false, message: result.code }
      }
      if (result.code === 'unknown_status') {
        await db.insert(feishuIntegrationJobRun).values({
          id: newId(),
          jobKind: 'webhook',
          status: 'skipped',
          requestSummary: { eventType, recordId, workOrderStatus },
          responseSummary: { reason: result.code },
          startedAt,
          finishedAt: new Date(),
        })
        return { handled: false, message: result.code }
      }
      return { handled: false, message: result.code }
    }

    return { handled: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'bitable webhook failed'
    supplierWarn('feishu-bitable-webhook', message, { recordId })
    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: 'webhook',
      status: 'failed',
      errorMessage: message,
      startedAt,
      finishedAt: new Date(),
    })
    throw e
  }
}
