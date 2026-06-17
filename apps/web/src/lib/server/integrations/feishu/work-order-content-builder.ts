import 'server-only'

import { db } from '@/lib/db'
import { FEISHU_BATCH_KIND_LABELS } from './types'
import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
} from '@/lib/types/supplier-domain'
import { dataCenter, type onboardingBatch } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

type BatchRow = typeof onboardingBatch.$inferSelect

export async function resolveContainerInstanceRegion(dataCenterId: string): Promise<string | null> {
  const [row] = await db
    .select({ containerInstanceRegion: dataCenter.containerInstanceRegion })
    .from(dataCenter)
    .where(eq(dataCenter.id, dataCenterId))
    .limit(1)
  const value = row?.containerInstanceRegion?.trim()
  return value || null
}

export function resolveWorkOrderLocationCode(
  batch: BatchRow,
  containerInstanceRegion?: string | null,
): string {
  return containerInstanceRegion?.trim() || batch.idcCode
}

function cooperationTypeLabel(raw: unknown): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  if (value in DEVICE_COOPERATION_TYPE_LABELS) {
    return DEVICE_COOPERATION_TYPE_LABELS[value as DeviceCooperationType]
  }
  return value
}

function renderPlanLines(plannedLinesJson: unknown): string {
  if (!Array.isArray(plannedLinesJson)) return ''
  return plannedLinesJson
    .map((line) => {
      if (!line || typeof line !== 'object') return ''
      const row = line as Record<string, unknown>
      const code = String(row.gpuCardTypeCode ?? row.gpu_card_type_code ?? '')
      const coop = cooperationTypeLabel(row.cooperationType ?? row.cooperation_type)
      const qty = String(row.plannedQuantity ?? row.planned_quantity ?? '')
      return `${code} · ${coop} × ${qty}`
    })
    .filter(Boolean)
    .join('\n')
}

export function buildWorkOrderContent(
  batch: BatchRow,
  containerInstanceRegion?: string | null,
): string {
  const kindLabel = FEISHU_BATCH_KIND_LABELS[batch.batchKind] ?? batch.batchKind
  const locationCode = resolveWorkOrderLocationCode(batch, containerInstanceRegion)
  const lines: string[] = [
    `【${kindLabel}】${batch.supplierShortName ?? batch.supplierName} · ${locationCode} · ${batch.dataCenterName}`,
    `计划 ${batch.plannedDeviceCount} 台`,
  ]

  const planText = renderPlanLines(batch.plannedLinesJson)
  if (planText) lines.push(planText)

  if (batch.batchKind === 'online' && batch.onlineReason) {
    lines.push(`上架原因：${batch.onlineReason}`)
  }
  if (batch.batchKind === 'order_access' && batch.orderNo) {
    lines.push(`订单号：${batch.orderNo}`)
  }
  if (batch.batchKind === 'device_retire') {
    if (batch.retireReason) lines.push(`下架原因：${batch.retireReason}`)
    if (batch.retirePlanMode === 'datacenter_closure') lines.push('场景：机房裁撤')
  }
  if (batch.remark?.trim()) lines.push(`备注：${batch.remark.trim()}`)
  if (batch.retireRemark?.trim()) lines.push(`下架备注：${batch.retireRemark.trim()}`)

  return lines.join('\n')
}
