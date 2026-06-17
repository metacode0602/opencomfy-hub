import 'server-only'

import { createHash } from 'node:crypto'

import { db } from '@/lib/db'
import { appendBatchProgressEvent } from '@/lib/server/aggregation/batch-progress-events'
import { supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import type { FeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import {
  isFeishuAutoCompleteOnApproval,
  shouldAutoCompleteBatchKind,
} from '@/lib/server/integrations/feishu/config'
import {
  buildOperatorHint,
  buildWorkOrderSyncDescription,
  type NormalizedWorkOrderInboundFields,
} from '@/lib/server/integrations/feishu/work-order-inbound-mapper'
import {
  buildCrossChannelDedupeKey,
  resolveBatchStatusFromWorkOrder,
  shouldWriteWorkOrderTimeline,
} from '@/lib/server/integrations/feishu/work-order-inbound-policy'
import type {
  FeishuBatchMetadata,
  FeishuStatusHistoryEntry,
} from '@/lib/server/integrations/feishu/types'
import { FEISHU_TERMINAL_BATCH_STATUSES } from '@/lib/server/integrations/feishu/types'
import type {
  FeishuWorkOrderBitableConfigDto,
  FeishuWorkOrderFieldKey,
  FeishuWorkOrderInboundChannel,
} from '@/lib/types/feishu-work-order'
import { DEFAULT_FEISHU_WORK_ORDER_INBOUND_POLICY } from '@/lib/types/feishu-work-order'
import {
  feishuExternalLink,
  feishuIntegrationJobRun,
  feishuWebhookEvent,
  onboardingBatch,
  supplierActivity,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

const STATUS_HISTORY_LIMIT = 50

export type WorkOrderInboundChannel = 'bitable_automation' | 'event_subscription'

export type SyncWorkOrderInboundInput = {
  inboundChannel: WorkOrderInboundChannel
  recordId: string
  ticketNo: string | null
  workOrderStatus: string
  previousStatus?: string | null
  occurredAt: Date
  idempotencyKey: string
  normalized: NormalizedWorkOrderInboundFields
  runtime: FeishuRuntimeConfig
  woConfig: FeishuWorkOrderBitableConfigDto
  jobKind?: 'webhook' | 'bitable_automation_inbound'
}

export type SyncWorkOrderInboundResult =
  | { ok: true; batchId: string; nextBatchStatus: string }
  | { ok: false; code: string; message?: string }

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function newId() {
  return crypto.randomUUID()
}

function digestFieldsSnapshot(fields: Partial<Record<FeishuWorkOrderFieldKey, unknown>>): string {
  const json = JSON.stringify(fields)
  return `sha256:${createHash('sha256').update(json).digest('hex')}`
}

function mergeBatchMetadata(existing: unknown, patch: FeishuBatchMetadata): FeishuBatchMetadata {
  const base = (existing && typeof existing === 'object' ? existing : {}) as FeishuBatchMetadata
  return {
    ...base,
    feishu: {
      ...(base.feishu ?? {}),
      ...(patch.feishu ?? {}),
    },
  }
}

function appendStatusHistory(
  existing: FeishuStatusHistoryEntry[] | undefined,
  entry: FeishuStatusHistoryEntry,
): FeishuStatusHistoryEntry[] {
  const next = [...(existing ?? []), entry]
  if (next.length <= STATUS_HISTORY_LIMIT) return next
  return next.slice(next.length - STATUS_HISTORY_LIMIT)
}

function isInboundChannelEnabled(
  configChannel: FeishuWorkOrderInboundChannel,
  inboundChannel: WorkOrderInboundChannel,
): boolean {
  if (configChannel === 'dual') return true
  return configChannel === inboundChannel
}

export async function findBatchByWorkOrderRecord(
  recordId: string,
  ticketNo?: string | null,
): Promise<typeof onboardingBatch.$inferSelect | null> {
  const [link] = await db
    .select()
    .from(feishuExternalLink)
    .where(eq(feishuExternalLink.externalId, recordId))
    .limit(1)
  if (link?.domain === 'onboarding_batch') {
    const [batch] = await db
      .select()
      .from(onboardingBatch)
      .where(eq(onboardingBatch.id, link.refId))
      .limit(1)
    if (batch) return batch
  }
  if (ticketNo?.trim()) {
    const [byCode] = await db
      .select()
      .from(onboardingBatch)
      .where(eq(onboardingBatch.workOrderNo, ticketNo.trim()))
      .limit(1)
    if (byCode) return byCode
  }
  return null
}

function buildProgressFlagsPatch(
  batch: typeof onboardingBatch.$inferSelect,
  nextStatus: string,
  inboundChannel: WorkOrderInboundChannel,
) {
  if (nextStatus !== '已完成') return batch.progressFlagsJson
  const touched = batch.touchedDeviceCount ?? 0
  const planned = batch.plannedDeviceCount ?? 0
  if (planned > 0 && touched < planned) {
    const prev =
      batch.progressFlagsJson && typeof batch.progressFlagsJson === 'object'
        ? (batch.progressFlagsJson as Record<string, unknown>)
        : {}
    return {
      ...prev,
      needs_review: true,
      completion_source: inboundChannelToCompletionSource(inboundChannel),
    }
  }
  return batch.progressFlagsJson
}

function inboundChannelToCompletionSource(
  channel: WorkOrderInboundChannel,
): 'feishu_automation' | 'feishu_webhook' {
  return channel === 'bitable_automation' ? 'feishu_automation' : 'feishu_webhook'
}

async function hasTimelineForSync(
  batchId: string,
  recordId: string,
  workOrderStatus: string,
  idempotencyKey: string,
  tx: DbTx,
): Promise<boolean> {
  const rows = await tx
    .select({ id: supplierActivity.id, metadata: supplierActivity.metadata })
    .from(supplierActivity)
    .where(eq(supplierActivity.refId, batchId))
  return rows.some((row) => {
    const meta = row.metadata as {
      feishu_record_id?: string
      feishu_status?: string
      activity_kind?: string
      idempotency_key?: string
    } | null
    if (meta?.idempotency_key === idempotencyKey) return true
    return (
      meta?.feishu_record_id === recordId &&
      meta?.feishu_status === workOrderStatus.trim() &&
      meta?.activity_kind === 'work_order_sync'
    )
  })
}

async function writeWorkOrderSyncTimeline(
  batch: typeof onboardingBatch.$inferSelect,
  input: SyncWorkOrderInboundInput,
  tx: DbTx,
) {
  const exists = await hasTimelineForSync(
    batch.id,
    input.recordId,
    input.workOrderStatus,
    input.idempotencyKey,
    tx,
  )
  if (exists) return

  const wo = batch.workOrderNo ?? input.ticketNo ?? input.recordId
  const now = input.occurredAt
  await tx.insert(supplierActivity).values({
    id: newId(),
    supplierId: batch.supplierId,
    type: 'batch_work_order_sync',
    title: `飞书工单 ${wo}：${input.workOrderStatus.trim()}`,
    description: buildWorkOrderSyncDescription({
      workOrderStatus: input.workOrderStatus,
      previousStatus: input.previousStatus,
      fieldsSnapshot: input.normalized.fieldsSnapshot,
    }),
    authorName: '系统',
    authorRole: 'system',
    refDomain: 'onboarding_batch',
    refId: batch.id,
    metadata: {
      data_center_id: batch.dataCenterId,
      idc_code: batch.idcCode,
      work_order_no: wo,
      feishu_record_id: input.recordId,
      feishu_status: input.workOrderStatus.trim(),
      previous_feishu_status: input.previousStatus?.trim() || undefined,
      activity_kind: 'work_order_sync',
      inbound_channel: input.inboundChannel,
      idempotency_key: input.idempotencyKey,
      fields_snapshot: input.normalized.fieldsSnapshot,
      fields_display: input.normalized.fieldsDisplay,
    },
    occurredAt: now,
    createdAt: now,
  })
}

async function writeWorkOrderCompletedTimeline(
  batch: typeof onboardingBatch.$inferSelect,
  input: {
    recordId: string
    statusText: string
    autoCompleted: boolean
    inboundChannel: WorkOrderInboundChannel
  },
  tx: DbTx,
) {
  const rows = await tx
    .select({ id: supplierActivity.id, metadata: supplierActivity.metadata })
    .from(supplierActivity)
    .where(eq(supplierActivity.refId, batch.id))
  const exists = rows.some((row) => {
    const meta = row.metadata as { feishu_record_id?: string; activity_kind?: string } | null
    return meta?.feishu_record_id === input.recordId && meta?.activity_kind === 'work_order_completed'
  })
  if (exists) return

  const wo = batch.workOrderNo ?? input.recordId
  const now = new Date()
  await tx.insert(supplierActivity).values({
    id: newId(),
    supplierId: batch.supplierId,
    type: 'batch_work_order_completed',
    title: `批次 WO-${wo} 工单已完成`,
    description: [
      `飞书工单状态: ${input.statusText}`,
      input.autoCompleted ? 'CRM 批次已自动结案' : '飞书工单已结束（CRM 批次待变更表结案）',
    ].join(' · '),
    authorName: '系统',
    authorRole: 'system',
    refDomain: 'onboarding_batch',
    refId: batch.id,
    metadata: {
      data_center_id: batch.dataCenterId,
      idc_code: batch.idcCode,
      work_order_no: wo,
      feishu_instance_id: input.recordId,
      feishu_record_id: input.recordId,
      feishu_status: input.statusText,
      activity_kind: 'work_order_completed',
      inbound_channel: input.inboundChannel,
    },
    occurredAt: now,
    createdAt: now,
  })
}

export async function syncWorkOrderInbound(
  input: SyncWorkOrderInboundInput,
): Promise<SyncWorkOrderInboundResult> {
  const { woConfig, runtime } = input
  if (!woConfig.enabled || woConfig.workOrderBackend !== 'bitable') {
    return { ok: false, code: 'work_order_bitable_disabled' }
  }
  if (!isInboundChannelEnabled(woConfig.inboundChannel, input.inboundChannel)) {
    return { ok: false, code: 'inbound_channel_disabled' }
  }

  const policy = { ...DEFAULT_FEISHU_WORK_ORDER_INBOUND_POLICY, ...woConfig.inboundPolicyJson }
  const semantic = woConfig.statusMappingJson[input.workOrderStatus.trim()]
  if (!semantic) {
    return { ok: false, code: 'unknown_status' }
  }

  const batch = await findBatchByWorkOrderRecord(input.recordId, input.ticketNo)
  if (!batch) {
    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: input.jobKind ?? 'bitable_automation_inbound',
      status: 'skipped',
      requestSummary: {
        recordId: input.recordId,
        workOrderStatus: input.workOrderStatus,
        inboundChannel: input.inboundChannel,
      },
      responseSummary: { reason: 'batch_not_found' },
      startedAt: input.occurredAt,
      finishedAt: new Date(),
    })
    return { ok: false, code: 'batch_not_found' }
  }

  const idempotencyKey = `${input.inboundChannel}:${input.idempotencyKey}`
  try {
    await db.insert(feishuWebhookEvent).values({
      id: newId(),
      idempotencyKey,
      instanceId: input.recordId,
      eventType: input.inboundChannel,
      processedAt: input.occurredAt,
    })
  } catch {
    return { ok: false, code: 'duplicate' }
  }

  const crossDedupeKey = buildCrossChannelDedupeKey(
    input.recordId,
    input.workOrderStatus,
    input.occurredAt,
    policy.dedupe_window_seconds,
  )
  if (woConfig.inboundChannel === 'dual') {
    try {
      await db.insert(feishuWebhookEvent).values({
        id: newId(),
        idempotencyKey: `cross:${crossDedupeKey}`,
        instanceId: input.recordId,
        eventType: 'dual_dedupe',
        processedAt: input.occurredAt,
      })
    } catch {
      return { ok: false, code: 'duplicate_cross_channel' }
    }
  }

  const autoCompleteEnabled = isFeishuAutoCompleteOnApproval(runtime)
  const autoCompleteBatchKind = shouldAutoCompleteBatchKind(runtime, batch.batchKind)
  const statusResult = resolveBatchStatusFromWorkOrder({
    workOrderStatus: input.workOrderStatus,
    statusMapping: woConfig.statusMappingJson,
    batchKind: batch.batchKind,
    currentBatchStatus: batch.batchStatus,
    policy,
    autoCompleteEnabled,
    autoCompleteBatchKind,
  })

  const shouldWriteTimeline = shouldWriteWorkOrderTimeline(statusResult.semantic, policy)
  const fieldsDigest = digestFieldsSnapshot(input.normalized.fieldsSnapshot)
  const operatorHint = buildOperatorHint(input.normalized.fieldsSnapshot)
  const now = input.occurredAt
  const previousFeishuStatus =
    (batch.metadata as FeishuBatchMetadata | null)?.feishu?.last_feishu_status ?? input.previousStatus

  let nextBatchStatus = statusResult.nextBatchStatus
  const shouldUpdateBatchStatus =
    statusResult.shouldUpdateBatchStatus &&
    !FEISHU_TERMINAL_BATCH_STATUSES.has(batch.batchStatus) &&
    nextBatchStatus !== batch.batchStatus

  if (FEISHU_TERMINAL_BATCH_STATUSES.has(batch.batchStatus) && statusResult.semantic === 'in_progress') {
    nextBatchStatus = batch.batchStatus
  }

  const historyEntry: FeishuStatusHistoryEntry = {
    at: now.toISOString(),
    from_status: previousFeishuStatus?.trim() || undefined,
    to_status: input.workOrderStatus.trim(),
    batch_status_before: batch.batchStatus,
    batch_status_after: shouldUpdateBatchStatus ? nextBatchStatus : batch.batchStatus,
    inbound_channel: input.inboundChannel,
    idempotency_key: input.idempotencyKey,
    fields_snapshot_digest: fieldsDigest,
    operator_hint: operatorHint,
  }

  const metadata = mergeBatchMetadata(batch.metadata, {
    feishu: {
      instance_id: input.recordId,
      instance_code: input.ticketNo ?? batch.workOrderNo ?? undefined,
      last_webhook_at: now.toISOString(),
      last_sync_at: now.toISOString(),
      last_sync_idempotency_key: input.idempotencyKey,
      last_feishu_status: input.workOrderStatus.trim(),
      inbound_channel: input.inboundChannel,
      status_history: appendStatusHistory(
        (batch.metadata as FeishuBatchMetadata | null)?.feishu?.status_history,
        historyEntry,
      ),
      ...(shouldUpdateBatchStatus && nextBatchStatus === '已完成'
        ? { completion_source: inboundChannelToCompletionSource(input.inboundChannel) }
        : {}),
    },
  })

  const progressSource =
    input.inboundChannel === 'bitable_automation' ? 'feishu_automation' : 'feishu_webhook'

  try {
    await db.transaction(async (tx) => {
      if (shouldWriteTimeline) {
        await writeWorkOrderSyncTimeline(batch, input, tx)
      }

      if (statusResult.isTerminalComplete) {
        await writeWorkOrderCompletedTimeline(
          batch,
          {
            recordId: input.recordId,
            statusText: input.workOrderStatus,
            autoCompleted: shouldUpdateBatchStatus && nextBatchStatus === '已完成',
            inboundChannel: input.inboundChannel,
          },
          tx,
        )
      }

      const progressFlagsJson =
        shouldUpdateBatchStatus && nextBatchStatus === '已完成'
          ? buildProgressFlagsPatch({ ...batch, batchStatus: nextBatchStatus }, nextBatchStatus, input.inboundChannel)
          : batch.progressFlagsJson

      await tx
        .update(onboardingBatch)
        .set({
          batchStatus: shouldUpdateBatchStatus ? nextBatchStatus : batch.batchStatus,
          metadata,
          progressFlagsJson,
          updatedAt: now,
        })
        .where(eq(onboardingBatch.id, batch.id))

      if (statusResult.isTerminalComplete) {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'work_order_closed',
          occurredAt: now,
          tx,
          payload: {
            source: progressSource,
            feishu_status: input.workOrderStatus,
            backend: 'bitable',
            auto_completed: shouldUpdateBatchStatus && nextBatchStatus === '已完成',
          },
        })
      }

      if (shouldUpdateBatchStatus) {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'status_changed',
          occurredAt: now,
          tx,
          payload: {
            source: progressSource,
            from: batch.batchStatus,
            to: nextBatchStatus,
            feishu_status: input.workOrderStatus,
            backend: 'bitable',
          },
        })
        if (nextBatchStatus === '已完成') {
          await appendBatchProgressEvent({
            batchId: batch.id,
            eventType: 'batch_completed',
            occurredAt: now,
            tx,
            payload: { source: progressSource, backend: 'bitable' },
          })
        }
        if (nextBatchStatus === '已取消') {
          await appendBatchProgressEvent({
            batchId: batch.id,
            eventType: 'batch_cancelled',
            occurredAt: now,
            tx,
            payload: { source: progressSource, backend: 'bitable' },
          })
        }
      } else if (shouldWriteTimeline) {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'status_changed',
          occurredAt: now,
          tx,
          payload: {
            source: progressSource,
            feishu_status: input.workOrderStatus,
            backend: 'bitable',
            fields_only: true,
            fields_digest: fieldsDigest,
          },
        })
      }
    })

    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: input.jobKind ?? 'bitable_automation_inbound',
      status: 'success',
      supplierId: batch.supplierId,
      refDomain: 'onboarding_batch',
      refId: batch.id,
      requestSummary: {
        recordId: input.recordId,
        workOrderStatus: input.workOrderStatus,
        inboundChannel: input.inboundChannel,
      },
      responseSummary: {
        batchStatus: shouldUpdateBatchStatus ? nextBatchStatus : batch.batchStatus,
      },
      startedAt: input.occurredAt,
      finishedAt: new Date(),
    })

    supplierLog('feishu-work-order-inbound', 'synced work order', {
      batchId: batch.id,
      workOrderStatus: input.workOrderStatus,
      inboundChannel: input.inboundChannel,
      nextBatchStatus: shouldUpdateBatchStatus ? nextBatchStatus : batch.batchStatus,
    })

    return {
      ok: true,
      batchId: batch.id,
      nextBatchStatus: shouldUpdateBatchStatus ? nextBatchStatus : batch.batchStatus,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'work order inbound sync failed'
    supplierWarn('feishu-work-order-inbound', message, { recordId: input.recordId })
    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: input.jobKind ?? 'bitable_automation_inbound',
      status: 'failed',
      refDomain: 'onboarding_batch',
      refId: batch.id,
      errorMessage: message,
      startedAt: input.occurredAt,
      finishedAt: new Date(),
    })
    throw e
  }
}

export function resolveAutomationWebhookSecret(
  woConfig: FeishuWorkOrderBitableConfigDto,
): string | null {
  const fromConfig = woConfig.automationWebhookSecret?.trim()
  if (fromConfig) return fromConfig
  const fromEnv =
    process.env.FEISHU_AUTOMATION_SECRET?.trim() ||
    process.env.FEISHU_WEBHOOK_SECRET?.trim() ||
    null
  return fromEnv
}

export function resolveAutomationToken(woConfig: FeishuWorkOrderBitableConfigDto): string | null {
  const fromConfig = woConfig.automationToken?.trim()
  if (fromConfig) return fromConfig
  return process.env.FEISHU_AUTOMATION_TOKEN?.trim() || null
}
