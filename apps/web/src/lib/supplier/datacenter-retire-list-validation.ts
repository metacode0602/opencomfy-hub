import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
} from '@/lib/types/supplier-domain'
import type {
  DatacenterRetireListParseResult,
  DatacenterRetireListRow,
  DatacenterRetirePlanLine,
} from '@/lib/types/datacenter-device-retire'
import { hasAnyEndpoint } from '@/lib/supplier/ip-endpoint-utils'
import { findDeviceForRetire } from '@/lib/supplier/device-retire-validation'
import type { ParsedDatacenterRetireListRow } from '@/lib/supplier/parse-datacenter-retire-list'
import type { SupplierDevice } from '@/lib/types/supplier-domain'

function normKey(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

export function mapCooperationType(raw: string): DeviceCooperationType | null {
  const v = normKey(raw)
  if (!v) return null
  if (v === 'idle_time' || v === '闲时合作' || v === '闲时') return 'idle_time'
  if (v === 'whole_rent' || v === '整租合作' || v === '整租') return 'whole_rent'
  return null
}

export function planLineKey(gpuCardTypeId: string, cooperationType: DeviceCooperationType) {
  return `${gpuCardTypeId}::${cooperationType}`
}

type CardTypeRef = { id: string; code: string; name: string }

function resolveCardType(raw: string, cardTypes: CardTypeRef[]): CardTypeRef | null {
  const v = raw.trim()
  if (!v) return null
  const lower = v.toLowerCase()
  return (
    cardTypes.find(
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

export function validateDatacenterRetireList(params: {
  parsedRows: ParsedDatacenterRetireListRow[]
  originalHeaders: string[]
  fileName: string
  planLines: DatacenterRetirePlanLine[]
  cardTypes: CardTypeRef[]
  devicesInDc: SupplierDevice[]
}): DatacenterRetireListParseResult {
  const planCardIds = new Set(params.planLines.map((l) => l.gpuCardTypeId))
  const matchedDeviceIds = new Set<string>()
  const rows: DatacenterRetireListRow[] = []

  for (const row of params.parsedRows) {
    const errors: string[] = []
    const card = resolveCardType(row.gpuCardTypeRaw, params.cardTypes)
    const cooperationType = mapCooperationType(row.cooperationTypeRaw)

    if (!row.gpuCardTypeRaw.trim()) errors.push('请填写卡型')
    else if (!card) errors.push(`卡型「${row.gpuCardTypeRaw}」在本机房不存在或未纳入下架计划`)
    else if (!planCardIds.has(card.id)) errors.push(`卡型「${card.name}」不在下架计划中`)

    if (!row.cooperationTypeRaw.trim()) errors.push('请填写合作类型')
    else if (!cooperationType) errors.push(`无法识别合作类型「${row.cooperationTypeRaw}」`)

    if (!hasAnyEndpoint(row.externalIp, row.internalIp)) {
      errors.push('外网IP与内网IP不能同时为空')
    }

    let matchedDeviceId: string | null = null

    if (errors.length === 0 && card && cooperationType) {
      const device = findDeviceForRetire(params.devicesInDc, {
        external_device_id: row.externalDeviceId,
        asset_no: row.assetNo,
        external_ip: row.externalIp,
        internal_ip: row.internalIp,
      })

      if (!device) {
        errors.push('设备在本机房中不存在')
      } else {
        const cardOk =
          device.gpu_card_type_id === card.id ||
          normKey(device.card_type) === normKey(card.name) ||
          normKey(device.card_type) === normKey(card.code)
        if (!cardOk) {
          errors.push(`设备卡型为「${device.card_type}」，与清单卡型「${card.name}」不一致`)
        } else if (device.cooperation_type !== cooperationType) {
          errors.push(
            `设备合作类型为「${DEVICE_COOPERATION_TYPE_LABELS[device.cooperation_type ?? 'idle_time']}」，与清单不一致`,
          )
        } else if (matchedDeviceIds.has(device.id)) {
          errors.push('该设备在清单中重复出现')
        } else {
          matchedDeviceId = device.id
          matchedDeviceIds.add(device.id)
        }
      }
    }

    rows.push({
      rowNo: row.rowNo,
      gpuCardTypeCode: card?.code ?? row.gpuCardTypeRaw,
      gpuCardTypeId: card?.id ?? null,
      gpuCardTypeName: card?.name ?? null,
      cooperationType,
      externalIp: row.externalIp,
      internalIp: row.internalIp,
      externalDeviceId: row.externalDeviceId,
      assetNo: row.assetNo,
      matchedDeviceId,
      parseStatus: errors.length === 0 ? 'ok' : 'error',
      errors,
    })
  }

  const okRows = rows.filter((r) => r.parseStatus === 'ok')
  const { planMatch, planMatchErrors } = validateRetireListAgainstPlan(params.planLines, okRows)

  return {
    fileName: params.fileName,
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
