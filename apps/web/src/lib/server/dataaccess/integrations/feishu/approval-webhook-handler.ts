import 'server-only'

import { db } from '@/lib/db'
import { appendBatchProgressEvent } from '@/lib/server/aggregation/batch-progress-events'
import { supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import {
  isFeishuAutoCompleteOnApproval,
  loadFeishuRuntimeConfig,
  shouldAutoCompleteBatchKind,
} from '@/lib/server/integrations/feishu/config'
import type {
  FeishuApprovalWebhookEvent,
  FeishuBatchMetadata,
  FeishuWebhookEnvelope,
} from '@/lib/server/integrations/feishu/types'
import { FEISHU_TERMINAL_BATCH_STATUSES } from '@/lib/server/integrations/feishu/types'
import {
  feishuExternalLink,
  feishuIntegrationJobRun,
  feishuWebhookEvent,
  onboardingBatch,
  supplierActivity,
} from '@workspace/db/schema'
import { eq, or } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function newId() {
  return crypto.randomUUID()
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

function normalizeFeishuStatus(status: string | undefined): string {
  return (status ?? '').toUpperCase()
}

function mapFeishuStatusToBatchStatus(status: string): '已完成' | '已取消' | null {
  if (status === 'APPROVED') return '已完成'
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'DELETED') return '已取消'
  return null
}

function buildIdempotencyKey(
  eventType: string,
  instanceId: string,
  status: string,
  updateTime: string,
): string {
  return `${eventType}:${instanceId}:${status}:${updateTime}`
}

async function findBatchByWorkOrder(instanceCode: string | undefined, instanceId: string) {
  if (instanceCode?.trim()) {
    const [byCode] = await db
      .select()
      .from(onboardingBatch)
      .where(eq(onboardingBatch.workOrderNo, instanceCode.trim()))
      .limit(1)
    if (byCode) return byCode
  }

  const linkConditions = [eq(feishuExternalLink.externalId, instanceId)]
  if (instanceCode) {
    linkConditions.push(eq(feishuExternalLink.externalCode, instanceCode))
  }
  const [link] = await db
    .select()
    .from(feishuExternalLink)
    .where(or(...linkConditions))
    .limit(1)
  if (!link || link.domain !== 'onboarding_batch') return null

  const [batch] = await db
    .select()
    .from(onboardingBatch)
    .where(eq(onboardingBatch.id, link.refId))
    .limit(1)
  return batch ?? null
}

async function hasExistingActivity(batchId: string, instanceId: string) {
  const rows = await db
    .select({ id: supplierActivity.id, metadata: supplierActivity.metadata })
    .from(supplierActivity)
    .where(eq(supplierActivity.refId, batchId))
  return rows.some((row) => {
    const meta = row.metadata as { feishu_instance_id?: string; activity_kind?: string } | null
    return meta?.feishu_instance_id === instanceId && meta?.activity_kind === 'work_order_completed'
  })
}

function buildProgressFlagsPatch(batch: typeof onboardingBatch.$inferSelect, nextStatus: string) {
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
      completion_source: 'feishu_webhook',
    }
  }
  return batch.progressFlagsJson
}

async function writeWorkOrderCompletedTimeline(
  tx: DbTx,
  batch: typeof onboardingBatch.$inferSelect,
  input: {
    instanceId: string
    feishuStatus: string
    taskName?: string
    autoCompleted: boolean
  },
) {
  if (await hasExistingActivity(batch.id, input.instanceId)) return

  const kindLabels: Record<string, string> = {
    online: '上架',
    order_access: '订单接入',
    device_retire: '下架',
    internal_occupancy: '内部占用',
  }
  const kind = kindLabels[batch.batchKind] ?? batch.batchKind
  const wo = batch.workOrderNo ?? input.instanceId
  const now = new Date()

  const descriptionParts = [
    `飞书审批状态: ${input.feishuStatus}`,
    input.taskName ? `末级节点: ${input.taskName}` : '末级节点: 验收完成',
    input.autoCompleted
      ? 'CRM 批次已自动结案'
      : '飞书审批已通过（CRM 批次待变更表结案）',
  ]

  await tx.insert(supplierActivity).values({
    id: newId(),
    supplierId: batch.supplierId,
    type: 'batch_work_order_completed',
    title: `${kind}批次 WO-${wo} 工单已完成`,
    description: descriptionParts.join(' · '),
    authorName: '系统',
    authorRole: 'system',
    refDomain: 'onboarding_batch',
    refId: batch.id,
    metadata: {
      data_center_id: batch.dataCenterId,
      idc_code: batch.idcCode,
      work_order_no: wo,
      feishu_instance_id: input.instanceId,
      feishu_status: input.feishuStatus,
      activity_kind: 'work_order_completed',
    },
    occurredAt: now,
    createdAt: now,
  })
}

export async function handleFeishuApprovalWebhook(
  envelope: FeishuWebhookEnvelope,
): Promise<{ handled: boolean; message?: string }> {
  const config = loadFeishuRuntimeConfig()
  const startedAt = new Date()
  const eventType = envelope.header?.event_type ?? envelope.type ?? 'unknown'
  const event = (envelope.event ?? {}) as FeishuApprovalWebhookEvent
  const instanceId = String(event.instance_id ?? '')
  const instanceCode = event.instance_code?.trim()
  const feishuStatus = normalizeFeishuStatus(String(event.status ?? ''))
  const updateTime = String(event.operate_time ?? envelope.header?.create_time ?? startedAt.toISOString())
  const taskName = event.task_name?.trim()

  if (!instanceId) {
    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: 'webhook',
      status: 'skipped',
      requestSummary: { eventType, reason: 'missing instance_id' },
      startedAt,
      finishedAt: new Date(),
    })
    return { handled: false, message: 'missing instance_id' }
  }

  const idempotencyKey = buildIdempotencyKey(eventType, instanceId, feishuStatus, updateTime)
  try {
    await db.insert(feishuWebhookEvent).values({
      id: newId(),
      idempotencyKey,
      instanceId,
      eventType,
      processedAt: startedAt,
    })
  } catch {
    supplierWarn('feishu-webhook', 'duplicate event skipped', { idempotencyKey })
    return { handled: true, message: 'duplicate' }
  }

  const batch = await findBatchByWorkOrder(instanceCode, instanceId)
  if (!batch) {
    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: 'webhook',
      status: 'skipped',
      requestSummary: { eventType, instanceId, instanceCode, feishuStatus },
      responseSummary: { reason: 'batch_not_found' },
      startedAt,
      finishedAt: new Date(),
    })
    return { handled: false, message: 'batch_not_found' }
  }

  const mappedStatus = mapFeishuStatusToBatchStatus(feishuStatus)
  const autoCompleteEnabled =
    isFeishuAutoCompleteOnApproval(config) && shouldAutoCompleteBatchKind(config!, batch.batchKind)
  const shouldUpdateBatchStatus =
    mappedStatus != null &&
    autoCompleteEnabled &&
    !FEISHU_TERMINAL_BATCH_STATUSES.has(batch.batchStatus)

  const now = new Date()
  let nextBatchStatus = batch.batchStatus
  if (shouldUpdateBatchStatus && mappedStatus) {
    nextBatchStatus = mappedStatus
  }

  const metadata = mergeBatchMetadata(batch.metadata, {
    feishu: {
      instance_id: instanceId,
      instance_code: instanceCode ?? batch.workOrderNo ?? undefined,
      last_webhook_at: now.toISOString(),
      last_feishu_status: feishuStatus,
      last_task_name: taskName || '验收完成',
      ...(shouldUpdateBatchStatus && mappedStatus === '已完成'
        ? { completion_source: 'feishu_webhook' as const }
        : {}),
    },
  })

  try {
    await db.transaction(async (tx) => {
      if (feishuStatus === 'APPROVED') {
        await writeWorkOrderCompletedTimeline(tx, batch, {
          instanceId,
          feishuStatus,
          taskName: taskName || '验收完成',
          autoCompleted: shouldUpdateBatchStatus && mappedStatus === '已完成',
        })
      }

      const progressFlagsJson =
        shouldUpdateBatchStatus && mappedStatus
          ? buildProgressFlagsPatch(batch, mappedStatus)
          : batch.progressFlagsJson

      if (nextBatchStatus !== batch.batchStatus || progressFlagsJson !== batch.progressFlagsJson) {
        await tx
          .update(onboardingBatch)
          .set({
            batchStatus: nextBatchStatus,
            metadata,
            progressFlagsJson,
            updatedAt: now,
          })
          .where(eq(onboardingBatch.id, batch.id))
      } else {
        await tx
          .update(onboardingBatch)
          .set({ metadata, updatedAt: now })
          .where(eq(onboardingBatch.id, batch.id))
      }

      if (feishuStatus === 'APPROVED') {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'work_order_closed',
          occurredAt: now,
          tx,
          payload: {
            source: 'feishu_webhook',
            feishu_status: feishuStatus,
            task_name: taskName || '验收完成',
            auto_completed: shouldUpdateBatchStatus,
          },
        })
      }

      if (shouldUpdateBatchStatus && mappedStatus && nextBatchStatus !== batch.batchStatus) {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'status_changed',
          occurredAt: now,
          tx,
          payload: {
            source: 'feishu_webhook',
            from: batch.batchStatus,
            to: nextBatchStatus,
            feishu_status: feishuStatus,
          },
        })
        if (mappedStatus === '已完成') {
          await appendBatchProgressEvent({
            batchId: batch.id,
            eventType: 'batch_completed',
            occurredAt: now,
            tx,
            payload: { source: 'feishu_webhook' },
          })
        }
        if (mappedStatus === '已取消') {
          await appendBatchProgressEvent({
            batchId: batch.id,
            eventType: 'batch_cancelled',
            occurredAt: now,
            tx,
            payload: { source: 'feishu_webhook' },
          })
        }
      }
    })

    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: 'webhook',
      status: 'success',
      supplierId: batch.supplierId,
      refDomain: 'onboarding_batch',
      refId: batch.id,
      requestSummary: { eventType, instanceId, feishuStatus, taskName },
      responseSummary: {
        batchStatus: nextBatchStatus,
        autoCompleted: shouldUpdateBatchStatus,
      },
      startedAt,
      finishedAt: new Date(),
    })

    supplierLog('feishu-webhook', 'handled approval event', {
      batchId: batch.id,
      feishuStatus,
      nextBatchStatus,
    })

    return { handled: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'webhook handler failed'
    await db.insert(feishuIntegrationJobRun).values({
      id: newId(),
      jobKind: 'webhook',
      status: 'failed',
      supplierId: batch.supplierId,
      refDomain: 'onboarding_batch',
      refId: batch.id,
      errorMessage: message,
      requestSummary: { eventType, instanceId, feishuStatus },
      startedAt,
      finishedAt: new Date(),
    })
    throw e
  }
}
