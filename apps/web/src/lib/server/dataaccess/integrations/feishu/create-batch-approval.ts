import 'server-only'

import { db } from '@/lib/db'
import {
  buildFeishuApprovalFormJson,
  createFeishuApprovalInstance,
  getFeishuApprovalInstance,
} from '@/lib/server/integrations/feishu/approval-client'
import {
  isFeishuAutoCreateEnabled,
  loadFeishuRuntimeConfig,
  resolveApprovalCode,
  type FeishuRuntimeConfig,
} from '@/lib/server/integrations/feishu/config'
import {
  FEISHU_BATCH_KIND_LABELS,
  type FeishuBatchMetadata,
} from '@/lib/server/integrations/feishu/types'
import { assertSupplierWorkOrderUnique } from '@/lib/server/dataaccess/supplier/work-order-uniqueness'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
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

function mergeBatchMetadata(
  existing: unknown,
  patch: FeishuBatchMetadata,
): FeishuBatchMetadata {
  const base = (existing && typeof existing === 'object' ? existing : {}) as FeishuBatchMetadata
  return {
    ...base,
    feishu: {
      ...(base.feishu ?? {}),
      ...(patch.feishu ?? {}),
    },
  }
}

function buildBatchApprovalSummary(batch: typeof onboardingBatch.$inferSelect): string {
  const kindLabel = FEISHU_BATCH_KIND_LABELS[batch.batchKind] ?? batch.batchKind
  const lines = [
    `批次编号: ${batch.batchCode}`,
    `批次类型: ${kindLabel}`,
    `供应商: ${batch.supplierName}`,
    `机房: ${batch.dataCenterName} (${batch.idcCode})`,
    `计划台数: ${batch.plannedDeviceCount}`,
  ]
  if (batch.plannedReadyAt) {
    lines.push(`计划完成: ${batch.plannedReadyAt.toISOString()}`)
  }
  if (batch.onlineReason) lines.push(`上架原因: ${batch.onlineReason}`)
  if (batch.orderNo) lines.push(`订单号: ${batch.orderNo}`)
  if (batch.retireReason) lines.push(`下架原因: ${batch.retireReason}`)
  if (batch.remark) lines.push(`备注: ${batch.remark}`)
  return lines.join('\n')
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

async function resolveUserOpenId(staffId: string | null | undefined, config: FeishuRuntimeConfig) {
  if (staffId) {
    // feishu_open_id 列待扩展；首期回退默认 open_id
    supplierWarn('feishu-integration', 'staff feishu_open_id not mapped, using default', {
      staffId,
    })
  }
  if (!config.defaultUserOpenId) {
    throw new Error('未配置 FEISHU_DEFAULT_USER_OPEN_ID，无法代发飞书审批')
  }
  return config.defaultUserOpenId
}

export async function createFeishuApprovalForBatch(batchId: string): Promise<{
  workOrderNo: string | null
  createStatus: 'created' | 'failed' | 'skipped'
}> {
  const config = loadFeishuRuntimeConfig()
  if (!isFeishuAutoCreateEnabled(config)) {
    return { workOrderNo: null, createStatus: 'skipped' }
  }

  const startedAt = new Date()
  const [batch] = await db
    .select()
    .from(onboardingBatch)
    .where(eq(onboardingBatch.id, batchId))
    .limit(1)
  if (!batch) {
    throw new Error('批次不存在')
  }

  const approvalCode = resolveApprovalCode(config!, batch.batchKind)
  if (!approvalCode) {
    const message = `未配置 batch_kind=${batch.batchKind} 的飞书 approval_code`
    await db
      .update(onboardingBatch)
      .set({
        metadata: mergeBatchMetadata(batch.metadata, {
          feishu: { create_status: 'failed' },
        }),
        updatedAt: new Date(),
      })
      .where(eq(onboardingBatch.id, batchId))
    await writeJobRun({
      jobKind: 'approval_create',
      status: 'failed',
      supplierId: batch.supplierId,
      refDomain: 'onboarding_batch',
      refId: batchId,
      errorMessage: message,
      startedAt,
      finishedAt: new Date(),
    })
    supplierError('feishu-integration', 'approval create failed: missing code', new Error(message), {
      batchId,
    })
    return { workOrderNo: null, createStatus: 'failed' }
  }

  try {
    const userOpenId = await resolveUserOpenId(batch.createdByStaffId, config!)
    const summary = buildBatchApprovalSummary(batch)
    const form = buildFeishuApprovalFormJson(config!, summary)
    const created = await createFeishuApprovalInstance(config!, {
      approvalCode,
      userOpenId,
      form,
    })

    let instanceCode = created.instance_code?.trim() || null
    if (!instanceCode) {
      const detail = await getFeishuApprovalInstance(config!, created.instance_id)
      instanceCode = detail.instance_code?.trim() || created.instance_id
    }

    await assertSupplierWorkOrderUnique(batch.supplierId, instanceCode, {
      excludeOnboardingBatchId: batchId,
    })

    const now = new Date()
    const metadata = mergeBatchMetadata(batch.metadata, {
      feishu: {
        instance_id: created.instance_id,
        instance_code: instanceCode,
        approval_code: approvalCode,
        create_status: 'created',
        last_feishu_status: 'PENDING',
      },
    })

    await db.transaction(async (tx) => {
      await tx
        .update(onboardingBatch)
        .set({
          workOrderNo: instanceCode,
          metadata,
          updatedAt: now,
        })
        .where(eq(onboardingBatch.id, batchId))

      await tx.insert(feishuExternalLink).values({
        id: newId(),
        domain: 'onboarding_batch',
        refId: batchId,
        externalType: 'approval_instance',
        externalId: created.instance_id,
        externalCode: instanceCode,
        metadata: { approval_code: approvalCode },
        createdAt: now,
      })

      if (batch.batchKind === 'internal_occupancy') {
        await tx
          .update(internalTestHold)
          .set({ workOrderNo: instanceCode, updatedAt: now })
          .where(eq(internalTestHold.onboardingBatchId, batchId))
      }
    })

    await writeJobRun({
      jobKind: 'approval_create',
      status: 'success',
      supplierId: batch.supplierId,
      refDomain: 'onboarding_batch',
      refId: batchId,
      requestSummary: { batchKind: batch.batchKind, approvalCode },
      responseSummary: {
        instance_id: created.instance_id,
        instance_code: instanceCode,
      },
      startedAt,
      finishedAt: new Date(),
    })

    supplierLog('feishu-integration', 'approval created', {
      batchId,
      instanceId: created.instance_id,
      instanceCode,
    })

    return { workOrderNo: instanceCode, createStatus: 'created' }
  } catch (e) {
    const message = e instanceof Error ? e.message : '飞书建单失败'
    await db
      .update(onboardingBatch)
      .set({
        metadata: mergeBatchMetadata(batch.metadata, {
          feishu: { create_status: 'failed', approval_code: approvalCode },
        }),
        updatedAt: new Date(),
      })
      .where(eq(onboardingBatch.id, batchId))
    await writeJobRun({
      jobKind: 'approval_create',
      status: 'failed',
      supplierId: batch.supplierId,
      refDomain: 'onboarding_batch',
      refId: batchId,
      errorMessage: message,
      startedAt,
      finishedAt: new Date(),
    })
    supplierError('feishu-integration', 'approval create failed', e, { batchId })
    return { workOrderNo: null, createStatus: 'failed' }
  }
}

export async function retryFeishuApprovalForBatch(batchId: string) {
  return createFeishuApprovalForBatch(batchId)
}
