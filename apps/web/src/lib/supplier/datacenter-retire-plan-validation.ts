import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
} from '@/lib/types/supplier-domain'
import type {
  DatacenterRetireContext,
  DatacenterRetirePlanLine,
  DatacenterRetirePlanLineDraft,
} from '@/lib/types/datacenter-device-retire'
import { planLineKey } from '@/lib/supplier/datacenter-retire-list-validation'

export function getListedQuantity(
  availability: DatacenterRetireContext['availability'],
  gpuCardTypeId: string,
  cooperationType: DeviceCooperationType,
): number {
  return (
    availability.find(
      (a) => a.gpuCardTypeId === gpuCardTypeId && a.cooperationType === cooperationType,
    )?.listedQuantity ?? 0
  )
}

export function validateRetirePlanLineDrafts(
  drafts: DatacenterRetirePlanLineDraft[],
  context: DatacenterRetireContext,
): {
  ok: boolean
  error?: string
  total: number
  normalized: DatacenterRetirePlanLine[]
} {
  if (drafts.length === 0) {
    return { ok: false, error: '请至少添加一行下架计划', total: 0, normalized: [] }
  }

  const cardTypeIds = new Set(context.cardTypes.map((c) => c.id))
  const seen = new Set<string>()
  const normalized: DatacenterRetirePlanLine[] = []
  let total = 0

  for (const line of drafts) {
    if (!line.gpuCardTypeId) {
      return { ok: false, error: '请为每一行选择卡型', total: 0, normalized: [] }
    }
    if (!cardTypeIds.has(line.gpuCardTypeId)) {
      return { ok: false, error: '所选卡型在本机房不存在', total: 0, normalized: [] }
    }
    if (!line.cooperationType) {
      return { ok: false, error: '请为每一行选择合作类型', total: 0, normalized: [] }
    }
    const qty = line.quantity.trim() ? Number(line.quantity) : NaN
    if (!Number.isInteger(qty) || qty <= 0) {
      return { ok: false, error: '请为每一行填写有效的下架数量（正整数）', total: 0, normalized: [] }
    }

    const key = planLineKey(line.gpuCardTypeId, line.cooperationType)
    if (seen.has(key)) {
      return { ok: false, error: '卡型与合作类型组合不可重复', total: 0, normalized: [] }
    }
    seen.add(key)

    const max = getListedQuantity(context.availability, line.gpuCardTypeId, line.cooperationType)
    if (max <= 0) {
      const card = context.cardTypes.find((c) => c.id === line.gpuCardTypeId)
      return {
        ok: false,
        error: `${card?.name ?? '该卡型'} · ${DEVICE_COOPERATION_TYPE_LABELS[line.cooperationType]} 在本机房无可下架设备`,
        total: 0,
        normalized: [],
      }
    }
    if (qty > max) {
      return {
        ok: false,
        error: `下架数量不能超过可下架数量（当前 ${max} 台）`,
        total: 0,
        normalized: [],
      }
    }

    const card = context.cardTypes.find((c) => c.id === line.gpuCardTypeId)!
    normalized.push({
      gpuCardTypeId: line.gpuCardTypeId,
      gpuCardTypeCode: card.code,
      gpuCardTypeName: card.name,
      cooperationType: line.cooperationType,
      plannedQuantity: qty,
    })
    total += qty
  }

  return { ok: true, total, normalized }
}
