import 'server-only'

import { db } from '@/lib/db'
import { assertSupplierWorkOrderUnique } from '@/lib/server/dataaccess/supplier/work-order-uniqueness'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import {
  createFeishuBitableRecord,
  extractFeishuBitableFieldText,
  getFeishuBitableRecord,
  listFeishuBitableFields,
} from '@/lib/server/integrations/feishu/bitable-client'
import {
  isFeishuAutoCreateEnabled,
  loadFeishuRuntimeConfig,
} from '@/lib/server/integrations/feishu/config'
import {
  buildFieldIdToNameMap,
  buildWorkOrderBitableRecordFields,
  extractTicketNoFromRecordFields,
} from '@/lib/server/integrations/feishu/work-order-bitable-mapper'
import {
  formatUserFieldConvFailHint,
} from '@/lib/server/integrations/feishu/feishu-user-id'
import { resolveContainerInstanceRegion } from '@/lib/server/integrations/feishu/work-order-content-builder'
import type { FeishuBatchMetadata } from '@/lib/server/integrations/feishu/types'
import { feishuWorkOrderConfigDataAccess } from '@/lib/server/dataaccess/integrations/feishu/work-order-config'
import {
  feishuExternalLink,
  feishuIntegrationJobRun,
  internalTestHold,
  onboardingBatch,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

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

async function writeJobRun(input: {
  jobKind: string
  status: string
  supplierId?: string | null
  refDomain?: string | null
  refId?: string | null
  requestSummary?: Record<string, unknown>
  responseSummary?: Record<string, unknown>
  errorMessage?: string
  startedAt: Date
  finishedAt?: Date
}) {
  await db.insert(feishuIntegrationJobRun).values({
    id: newId(),
    jobKind: input.jobKind,
    status: input.status,
    supplierId: input.supplierId ?? null,
    refDomain: input.refDomain ?? null,
    refId: input.refId ?? null,
    requestSummary: input.requestSummary ?? null,
    responseSummary: input.responseSummary ?? null,
    errorMessage: input.errorMessage ?? null,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt ?? null,
  })
}

async function resolveSubmitterOpenId(config: NonNullable<ReturnType<typeof loadFeishuRuntimeConfig>>) {
  if (!config.defaultUserOpenId) {
    throw new Error('未配置 FEISHU_DEFAULT_USER_OPEN_ID，无法写入提交人')
  }
  return config.defaultUserOpenId
}

export async function createBitableWorkOrderForBatch(batchId: string): Promise<{
  workOrderNo: string | null
  createStatus: 'created' | 'failed' | 'skipped'
}> {
  const runtime = loadFeishuRuntimeConfig()
  if (!isFeishuAutoCreateEnabled(runtime)) {
    return { workOrderNo: null, createStatus: 'skipped' }
  }

  const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
  if (!woConfig?.enabled || woConfig.workOrderBackend !== 'bitable') {
    return { workOrderNo: null, createStatus: 'skipped' }
  }
  if (!woConfig.appToken || !woConfig.tableId) {
    return { workOrderNo: null, createStatus: 'skipped' }
  }

  const startedAt = new Date()
  const [batch] = await db
    .select()
    .from(onboardingBatch)
    .where(eq(onboardingBatch.id, batchId))
    .limit(1)
  if (!batch) throw new Error('批次不存在')

  if (!woConfig.fieldMappingJson.work_order_content) {
    const message = '未配置工单内容字段映射（work_order_content）'
    await markFailed(batch, message, startedAt)
    return { workOrderNo: null, createStatus: 'failed' }
  }

  try {
    const submitterOpenId = await resolveSubmitterOpenId(runtime!)
    const containerInstanceRegion = await resolveContainerInstanceRegion(batch.dataCenterId)
    const bitableFields = await listFeishuBitableFields(runtime!, woConfig.appToken, woConfig.tableId)
    const fieldIdToName = buildFieldIdToNameMap(
      bitableFields.map((field) => ({ fieldId: field.field_id, fieldName: field.field_name })),
    )
    const fields = buildWorkOrderBitableRecordFields({
      batch,
      mapping: woConfig.fieldMappingJson,
      defaults: woConfig.defaultsJson,
      submitterOpenId,
      appBaseUrl: runtime!.appBaseUrl,
      fieldIdToName,
      containerInstanceRegion,
    })

    const created = await createFeishuBitableRecord(
      runtime!,
      woConfig.appToken,
      woConfig.tableId,
      fields,
    )

    let ticketNo = extractTicketNoFromRecordFields(
      created.fields,
      woConfig.fieldMappingJson.ticket_no,
      fieldIdToName,
    )
    if (!ticketNo) {
      const refreshed = await getFeishuBitableRecord(
        runtime!,
        woConfig.appToken,
        woConfig.tableId,
        created.record_id,
      )
      ticketNo = extractTicketNoFromRecordFields(
        refreshed.fields,
        woConfig.fieldMappingJson.ticket_no,
        fieldIdToName,
      )
    }
    if (!ticketNo) {
      for (const [fieldId, value] of Object.entries(created.fields)) {
        const text = extractFeishuBitableFieldText(value)
        if (/^\d+$/.test(text)) {
          ticketNo = text
          break
        }
        void fieldId
      }
    }
    if (!ticketNo) {
      throw new Error('建单成功但未读回工单ID编号，请检查 ticket_no 字段映射')
    }

    await assertSupplierWorkOrderUnique(batch.supplierId, ticketNo, {
      excludeOnboardingBatchId: batchId,
    })

    const now = new Date()
    const metadata = mergeBatchMetadata(batch.metadata, {
      feishu: {
        instance_id: created.record_id,
        instance_code: ticketNo,
        create_status: 'created',
        last_feishu_status: woConfig.defaultsJson.initial_status ?? '待审核',
        completion_source: undefined,
      },
    })

    await db.transaction(async (tx) => {
      await tx
        .update(onboardingBatch)
        .set({
          workOrderNo: ticketNo,
          metadata,
          updatedAt: now,
        })
        .where(eq(onboardingBatch.id, batchId))

      await tx.insert(feishuExternalLink).values({
        id: newId(),
        domain: 'onboarding_batch',
        refId: batchId,
        externalType: 'bitable_work_order_record',
        externalId: created.record_id,
        externalCode: ticketNo,
        metadata: { app_token: woConfig.appToken, table_id: woConfig.tableId },
        createdAt: now,
      })

      if (batch.batchKind === 'internal_occupancy') {
        await tx
          .update(internalTestHold)
          .set({ workOrderNo: ticketNo, updatedAt: now })
          .where(eq(internalTestHold.onboardingBatchId, batchId))
      }
    })

    await writeJobRun({
      jobKind: 'work_order_create',
      status: 'success',
      supplierId: batch.supplierId,
      refDomain: 'onboarding_batch',
      refId: batchId,
      requestSummary: { fields, backend: 'bitable' },
      responseSummary: { record_id: created.record_id, ticket_no: ticketNo },
      startedAt,
      finishedAt: new Date(),
    })

    supplierLog('feishu-work-order', 'bitable record created', {
      batchId,
      recordId: created.record_id,
      ticketNo,
    })

    return { workOrderNo: ticketNo, createStatus: 'created' }
  } catch (e) {
    let message = e instanceof Error ? e.message : '飞书工单建单失败'
    if (message === 'UserFieldConvFail') {
      try {
        const submitterOpenId = runtime!.defaultUserOpenId
        const personIds = [
          ...(woConfig.defaultsJson.assignee_open_ids ?? []),
          ...(submitterOpenId ? [submitterOpenId] : []),
        ]
        message = formatUserFieldConvFailHint(personIds)
      } catch {
        message =
          '人员字段写入失败（UserFieldConvFail）：请检查 FEISHU_DEFAULT_USER_OPEN_ID 与默认经办人 ID 是否为当前飞书应用的有效 user_id 或 open_id'
      }
    }
    await markFailed(batch, message, startedAt, batchId, {
      backend: 'bitable',
      mapping: woConfig.fieldMappingJson,
    })
    supplierError('feishu-work-order', 'bitable create failed', e, { batchId })
    return { workOrderNo: null, createStatus: 'failed' }
  }
}

async function markFailed(
  batch: typeof onboardingBatch.$inferSelect,
  message: string,
  startedAt: Date,
  batchId?: string,
  requestSummary?: Record<string, unknown>,
) {
  const id = batchId ?? batch.id
  await db
    .update(onboardingBatch)
    .set({
      metadata: mergeBatchMetadata(batch.metadata, {
        feishu: { create_status: 'failed' },
      }),
      updatedAt: new Date(),
    })
    .where(eq(onboardingBatch.id, id))
  await writeJobRun({
    jobKind: 'work_order_create',
    status: 'failed',
    supplierId: batch.supplierId,
    refDomain: 'onboarding_batch',
    refId: id,
    requestSummary,
    errorMessage: message,
    startedAt,
    finishedAt: new Date(),
  })
  supplierWarn('feishu-work-order', message, { batchId: id })
}
