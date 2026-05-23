/**
 * 机房设备下架 — Mock 可用量与 preview/commit（阶段一，确认设计后再接 tRPC）
 */
import type { DataCenterDevice } from '@/lib/data/types'
import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
} from '@/lib/types/supplier-domain'
import {
  getDeviceRetireReasonLabel,
  type DeviceRetireReason,
} from '@/lib/types/device-retire'
import type {
  BuildAvailabilityInput,
  DatacenterRetireAvailability,
  DatacenterRetireCommitResult,
  DatacenterRetireContext,
  DatacenterRetireListParseResult,
  DatacenterRetireListRow,
  DatacenterRetirePlanLine,
  DatacenterRetirePlanLineDraft,
  DatacenterRetirePreviewInput,
  DatacenterRetirePreviewResult,
} from '@/lib/types/datacenter-device-retire'
import {
  buildClientDatacenterRetireCommit,
  buildClientDatacenterRetirePreview,
} from '@/lib/supplier/datacenter-device-retire-ui'
import {
  DATACENTER_RETIRE_LIST_HEADERS,
  type RetireActionType,
} from '@/lib/types/datacenter-device-retire'

export function planLineKey(gpuCardTypeId: string, cooperationType: DeviceCooperationType) {
  return `${gpuCardTypeId}::${cooperationType}`
}

/** Mock：将 onlineQuantity 按 60% 闲时 / 40% 整租拆分 */
export function buildDatacenterRetireAvailability({
  gpuInventory,
}: BuildAvailabilityInput): DatacenterRetireAvailability[] {
  const rows: DatacenterRetireAvailability[] = []

  for (const inv of gpuInventory) {
    if (inv.quantity <= 0) continue
    const online = inv.onlineQuantity
    if (online <= 0) continue

    const idleQty = Math.floor(online * 0.6)
    const wholeQty = online - idleQty
    const code = inv.cardTypeId

    if (idleQty > 0) {
      rows.push({
        gpuCardTypeId: inv.cardTypeId,
        gpuCardTypeCode: code,
        gpuCardTypeName: inv.cardTypeName,
        cooperationType: 'idle_time',
        listedQuantity: idleQty,
      })
    }
    if (wholeQty > 0) {
      rows.push({
        gpuCardTypeId: inv.cardTypeId,
        gpuCardTypeCode: code,
        gpuCardTypeName: inv.cardTypeName,
        cooperationType: 'whole_rent',
        listedQuantity: wholeQty,
      })
    }
  }

  return rows
}

export function buildDatacenterRetireContext(params: {
  dataCenterId: string
  dataCenterName: string
  supplierId: string
  supplierName: string
  gpuInventory: DataCenterDevice[]
}): DatacenterRetireContext {
  const availability = buildDatacenterRetireAvailability({
    dataCenterId: params.dataCenterId,
    gpuInventory: params.gpuInventory,
  })

  const cardTypeMap = new Map<string, { id: string; code: string; name: string }>()
  for (const inv of params.gpuInventory) {
    if (inv.quantity <= 0) continue
    if (!cardTypeMap.has(inv.cardTypeId)) {
      cardTypeMap.set(inv.cardTypeId, {
        id: inv.cardTypeId,
        code: inv.cardTypeId,
        name: inv.cardTypeName,
      })
    }
  }

  return {
    dataCenterId: params.dataCenterId,
    dataCenterName: params.dataCenterName,
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    cardTypes: [...cardTypeMap.values()],
    availability,
  }
}

export function getListedQuantity(
  availability: DatacenterRetireAvailability[],
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

function normCell(s: string): string {
  return s.replace(/^\ufeff/, '').trim()
}

function normHeader(s: string): string {
  return normCell(s).replace(/\s+/g, '').toLowerCase()
}

function splitCsvLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(normCell)
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
      continue
    }
    if (!inQ && ch === ',') {
      out.push(normCell(cur))
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(normCell(cur))
  return out
}

function pickIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i] ?? '')
    if (aliases.some((a) => normHeader(a) === h)) return i
  }
  return -1
}

function mapCooperationType(raw: string): DeviceCooperationType | null {
  const v = normCell(raw).toLowerCase()
  if (!v) return null
  if (v === 'idle_time' || v === '闲时合作' || v === '闲时') return 'idle_time'
  if (v === 'whole_rent' || v === '整租合作' || v === '整租') return 'whole_rent'
  return null
}

function resolveCardType(
  raw: string,
  context: DatacenterRetireContext,
): { id: string; code: string; name: string } | null {
  const v = normCell(raw)
  if (!v) return null
  const lower = v.toLowerCase()
  return (
    context.cardTypes.find(
      (c) =>
        c.id.toLowerCase() === lower ||
        c.code.toLowerCase() === lower ||
        c.name.toLowerCase() === lower ||
        c.name === v,
    ) ?? null
  )
}

export function validateRetireListAgainstPlan(
  planLines: DatacenterRetirePlanLine[],
  okRows: DatacenterRetireListRow[],
): { planMatch: boolean; planMatchErrors: string[] } {
  const planMatchErrors: string[] = []
  const listCounts = new Map<string, number>()

  for (const row of okRows) {
    if (!row.gpuCardTypeId || !row.cooperationType) continue
    const key = planLineKey(row.gpuCardTypeId, row.cooperationType)
    listCounts.set(key, (listCounts.get(key) ?? 0) + 1)
  }

  for (const line of planLines) {
    const key = planLineKey(line.gpuCardTypeId, line.cooperationType)
    const actual = listCounts.get(key) ?? 0
    if (actual !== line.plannedQuantity) {
      planMatchErrors.push(
        `${line.gpuCardTypeName} · ${DEVICE_COOPERATION_TYPE_LABELS[line.cooperationType]}：计划 ${line.plannedQuantity} 台，清单 ${actual} 台`,
      )
    }
    listCounts.delete(key)
  }

  for (const [key, count] of listCounts) {
    if (count <= 0) continue
    planMatchErrors.push(`清单包含计划外组合（${key}）共 ${count} 行`)
  }

  const totalPlanned = planLines.reduce((s, l) => s + l.plannedQuantity, 0)
  if (okRows.length !== totalPlanned) {
    planMatchErrors.push(
      `清单有效行数 ${okRows.length} 与计划下架总台数 ${totalPlanned} 不一致`,
    )
  }

  return { planMatch: planMatchErrors.length === 0, planMatchErrors }
}

/** Mock：解析下架清单 CSV/TSV，校验 IP 与计划行卡型/数量 */
export function parseDatacenterRetireListCsv(
  csvText: string,
  fileName: string,
  context: DatacenterRetireContext,
  planLines: DatacenterRetirePlanLine[],
): DatacenterRetireListParseResult {
  const rawLines = csvText.split(/\r?\n/).map((l) => l.trimEnd())
  const lines = rawLines.filter((l) => normCell(l).length > 0)
  if (lines.length < 2) {
    throw new Error('文件至少需要表头一行与一行数据')
  }

  const headers = splitCsvLine(lines[0]!)
  const iCard = pickIndex(headers, ['卡型', 'gpu_card_type', 'card_type'])
  const iCoop = pickIndex(headers, ['合作类型', 'cooperation_type', '合作模式'])
  const iExtIp = pickIndex(headers, ['外网ip', '外网IP', '公网ip', 'external_ip'])
  const iIntIp = pickIndex(headers, ['内网ip', '内网IP', 'internal_ip'])
  const iDeviceId = pickIndex(headers, ['设备id', '设备ID', 'external_device_id'])
  const iAsset = pickIndex(headers, ['设备标识', 'asset_no', 'sn'])

  if (iCard === -1) {
    throw new Error(`未识别到卡型列，请包含「${DATACENTER_RETIRE_LIST_HEADERS[0]}」`)
  }
  if (iCoop === -1) {
    throw new Error(`未识别到合作类型列，请包含「${DATACENTER_RETIRE_LIST_HEADERS[1]}」`)
  }
  if (iExtIp === -1 && iIntIp === -1) {
    throw new Error('请至少包含外网IP或内网IP列')
  }

  const planCardIds = new Set(planLines.map((l) => l.gpuCardTypeId))
  const rows: DatacenterRetireListRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!)
    const cell = (idx: number) => (idx === -1 ? '' : normCell(cells[idx] ?? ''))
    const errors: string[] = []

    const cardRaw = cell(iCard)
    const coopRaw = cell(iCoop)
    const externalIp = cell(iExtIp) || null
    const internalIp = cell(iIntIp) || null
    const externalDeviceId = cell(iDeviceId) || null
    const assetNo = cell(iAsset) || null

    const card = resolveCardType(cardRaw, context)
    const cooperationType = mapCooperationType(coopRaw)

    if (!cardRaw) errors.push('请填写卡型')
    else if (!card) errors.push(`卡型「${cardRaw}」在本机房不存在或未纳入下架计划`)
    else if (!planCardIds.has(card.id)) errors.push(`卡型「${card.name}」不在下架计划中`)

    if (!coopRaw) errors.push('请填写合作类型')
    else if (!cooperationType) errors.push(`无法识别合作类型「${coopRaw}」`)

    if (!externalIp && !internalIp) {
      errors.push('外网IP与内网IP不能同时为空')
    }

    rows.push({
      rowNo: i + 1,
      gpuCardTypeCode: card?.code ?? cardRaw,
      gpuCardTypeId: card?.id ?? null,
      gpuCardTypeName: card?.name ?? null,
      cooperationType,
      externalIp,
      internalIp,
      externalDeviceId,
      assetNo,
      matchedDeviceId: null,
      parseStatus: errors.length === 0 ? 'ok' : 'error',
      errors,
    })
  }

  const okRows = rows.filter((r) => r.parseStatus === 'ok')
  const { planMatch, planMatchErrors } = validateRetireListAgainstPlan(planLines, okRows)

  return {
    fileName,
    rows,
    summary: {
      total: rows.length,
      ok: okRows.length,
      error: rows.length - okRows.length,
    },
    planMatch,
    planMatchErrors,
  }
}

export function mockPreviewDatacenterRetire(
  input: DatacenterRetirePreviewInput & {
    context: DatacenterRetireContext
  },
): DatacenterRetirePreviewResult {
  const actionType = (input.meta.retireActionType ?? 'device_unsubscribe') as RetireActionType
  return buildClientDatacenterRetirePreview({
    context: input.context,
    meta: input.meta,
    retireActionType: actionType,
    planLines: input.planLines,
    list: input.list,
  })
}

export function mockCommitDatacenterRetire(params: {
  context: DatacenterRetireContext
  preview: DatacenterRetirePreviewResult
}): DatacenterRetireCommitResult {
  return buildClientDatacenterRetireCommit(params.preview)
}

/** 文档 §8.3 固定样例（单测 / Storybook） */
export const MOCK_DC_HB_BJ_RETIRE_AVAILABILITY: DatacenterRetireAvailability[] = [
  {
    gpuCardTypeId: 'gpu-a100-80g',
    gpuCardTypeCode: 'A100-80G',
    gpuCardTypeName: 'A100 80G',
    cooperationType: 'idle_time',
    listedQuantity: 12,
  },
  {
    gpuCardTypeId: 'gpu-a100-80g',
    gpuCardTypeCode: 'A100-80G',
    gpuCardTypeName: 'A100 80G',
    cooperationType: 'whole_rent',
    listedQuantity: 8,
  },
  {
    gpuCardTypeId: 'gpu-h800',
    gpuCardTypeCode: 'H800',
    gpuCardTypeName: 'H800',
    cooperationType: 'idle_time',
    listedQuantity: 5,
  },
  {
    gpuCardTypeId: 'gpu-h800',
    gpuCardTypeCode: 'H800',
    gpuCardTypeName: 'H800',
    cooperationType: 'whole_rent',
    listedQuantity: 3,
  },
]

export type { DeviceRetireReason }
