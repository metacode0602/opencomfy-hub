import * as XLSX from 'xlsx'

export type GpuCardTypeRef = {
  id: string
  code: string
  name: string
}

export type GpuCardTypeImportIssue = {
  row_no: number
  internal_ip?: string
  raw_value: string
  reason: 'missing' | 'unrecognized'
}

export type InventoryGpuRowRef = {
  row_no: number
  internal_ip?: string
  gpu_card_type_code?: string
  gpu_card_type_id?: string
  parse_status: 'ok' | 'warning' | 'error'
}

export type InventoryGpuRowResolution = {
  gpuCardTypeId: string
  gpuCardTypeCode: string
  gpuCardTypeName: string
  matchedBy: 'name' | 'code' | 'manual' | 'existing_ip'
  raw: string
}

export type ValidateInventoryGpuOptions = {
  gpuCardTypeIdByIp?: Map<string, string> | Record<string, string>
}

export type ValidateInventoryGpuResult = {
  rowResolutions: Map<number, InventoryGpuRowResolution>
  issues: GpuCardTypeImportIssue[]
  uniqueUnrecognized: string[]
  pendingSelectionCount: number
}

const BRAND_PREFIXES = [
  'nvidia',
  '英伟达',
  'huawei',
  '华为',
  'amd',
  'intel',
  'ascend',
  '昇腾',
] as const

export function normalizeInternalIpKey(ip: string): string {
  return ip.trim().toLowerCase()
}

export function buildGpuCardTypeIdByIpMap(
  entries: Array<{ internalIp?: string | null; gpuCardTypeId?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of entries) {
    const ip = entry.internalIp?.trim()
    const id = entry.gpuCardTypeId?.trim()
    if (!ip || !id) continue
    const key = normalizeInternalIpKey(ip)
    if (!map.has(key)) map.set(key, id)
  }
  return map
}

export function lookupGpuCardTypeIdByIp(
  internalIp: string | undefined,
  gpuCardTypeIdByIp: Map<string, string> | Record<string, string> | undefined,
): string | undefined {
  const ip = internalIp?.trim()
  if (!ip || !gpuCardTypeIdByIp) return undefined
  const key = normalizeInternalIpKey(ip)
  if (gpuCardTypeIdByIp instanceof Map) {
    return gpuCardTypeIdByIp.get(key)
  }
  return gpuCardTypeIdByIp[key]
}

export function stripLeadingGpuBrand(raw: string): string {
  let value = raw.trim()
  if (!value) return value

  const lower = value.toLowerCase()
  const ordered = [...BRAND_PREFIXES].sort((a, b) => b.length - a.length)
  for (const brand of ordered) {
    if (lower.startsWith(brand)) {
      value = value.slice(brand.length).trim()
      break
    }
  }
  return value
}

export function normalizeGpuCardComparable(value: string): string {
  return value.toLowerCase().replace(/[\s\-_]/g, '')
}

function comparableCodesMatch(input: string, code: string): boolean {
  const left = normalizeGpuCardComparable(input)
  const right = normalizeGpuCardComparable(code)
  if (!left || !right) return false
  if (left === right) return true
  if (left + 'b' === right || left === right + 'b') return true
  if (right.startsWith(left) || left.startsWith(right)) return true
  return false
}

export function matchGpuCardType(
  raw: string | undefined | null,
  cardTypes: GpuCardTypeRef[],
): (GpuCardTypeRef & { matchedBy: 'name' | 'code' }) | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  const byName = cardTypes.find((card) => card.name.toLowerCase() === trimmed.toLowerCase())
  if (byName) {
    return { ...byName, matchedBy: 'name' }
  }

  const stripped = stripLeadingGpuBrand(trimmed)
  if (!stripped) return null

  const exactCode = cardTypes.find((card) => {
    const normalizedCode = normalizeGpuCardComparable(card.code)
    const normalizedInput = normalizeGpuCardComparable(stripped)
    if (normalizedCode === normalizedInput) return true
    if (normalizedCode === normalizedInput + 'b' || normalizedInput === normalizedCode + 'b') {
      return true
    }
    return false
  })
  if (exactCode) {
    return { ...exactCode, matchedBy: 'code' }
  }

  let best: GpuCardTypeRef | null = null
  let bestScore = -1
  for (const card of cardTypes) {
    if (!comparableCodesMatch(stripped, card.code)) continue
    const score = normalizeGpuCardComparable(card.code).length
    if (score > bestScore) {
      best = card
      bestScore = score
    }
  }
  if (best) {
    return { ...best, matchedBy: 'code' }
  }

  return null
}

function resolveGpuCardTypeById(
  gpuCardTypeId: string | undefined,
  cardTypes: GpuCardTypeRef[],
  matchedBy: InventoryGpuRowResolution['matchedBy'],
): InventoryGpuRowResolution | null {
  const id = gpuCardTypeId?.trim()
  if (!id) return null
  const card = cardTypes.find((item) => item.id === id)
  if (!card) return null
  return {
    gpuCardTypeId: card.id,
    gpuCardTypeCode: card.code,
    gpuCardTypeName: card.name,
    matchedBy,
    raw: '',
  }
}

export function validateInventoryGpuCardTypes(
  rows: InventoryGpuRowRef[],
  cardTypes: GpuCardTypeRef[],
  options: ValidateInventoryGpuOptions = {},
): ValidateInventoryGpuResult {
  const rowResolutions = new Map<number, InventoryGpuRowResolution>()
  const issues: GpuCardTypeImportIssue[] = []
  const unrecognizedSet = new Set<string>()
  const ipMap =
    options.gpuCardTypeIdByIp instanceof Map
      ? options.gpuCardTypeIdByIp
      : new Map(Object.entries(options.gpuCardTypeIdByIp ?? {}))

  for (const row of rows) {
    if (row.parse_status === 'error') continue

    const raw = row.gpu_card_type_code?.trim() ?? ''
    const manualMatched = resolveGpuCardTypeById(row.gpu_card_type_id, cardTypes, 'manual')
    if (manualMatched) {
      rowResolutions.set(row.row_no, {
        ...manualMatched,
        raw: raw || manualMatched.gpuCardTypeCode,
      })
      continue
    }

    const autoMatched = raw ? matchGpuCardType(raw, cardTypes) : null
    if (autoMatched) {
      rowResolutions.set(row.row_no, {
        gpuCardTypeId: autoMatched.id,
        gpuCardTypeCode: autoMatched.code,
        gpuCardTypeName: autoMatched.name,
        matchedBy: autoMatched.matchedBy,
        raw,
      })
      continue
    }

    const existingGpuCardTypeId = lookupGpuCardTypeIdByIp(row.internal_ip, ipMap)
    const existingMatched = resolveGpuCardTypeById(existingGpuCardTypeId, cardTypes, 'existing_ip')
    if (existingMatched) {
      rowResolutions.set(row.row_no, {
        ...existingMatched,
        raw: raw || existingMatched.gpuCardTypeCode,
      })
      continue
    }

    if (!raw) {
      issues.push({ row_no: row.row_no, internal_ip: row.internal_ip, raw_value: '', reason: 'missing' })
      continue
    }

    issues.push({
      row_no: row.row_no,
      internal_ip: row.internal_ip,
      raw_value: raw,
      reason: 'unrecognized',
    })
    unrecognizedSet.add(raw)
  }

  return {
    rowResolutions,
    issues,
    uniqueUnrecognized: [...unrecognizedSet],
    pendingSelectionCount: issues.length,
  }
}

export class DeviceImportUnrecognizedGpuCardError extends Error {
  readonly validation: ValidateInventoryGpuResult

  constructor(validation: ValidateInventoryGpuResult) {
    const labels = validation.uniqueUnrecognized.length
      ? validation.uniqueUnrecognized.join('、')
      : ''
    const pendingHint =
      validation.pendingSelectionCount > 0
        ? `共 ${validation.pendingSelectionCount} 行卡型校验失败`
        : ''
    super(
      labels
        ? `显卡型号无法识别：${labels}；${pendingHint}`
        : pendingHint || '存在卡型校验失败的行，无法入库',
    )
    this.name = 'DeviceImportUnrecognizedGpuCardError'
    this.validation = validation
  }
}

export function buildUnrecognizedGpuCardTypesWorkbook(issues: GpuCardTypeImportIssue[]): ArrayBuffer {
  const rows: Array<Array<string | number>> = [
    ['行号', 'IP地址', '显卡型号', '问题'],
    ...issues.map((issue) => [
      issue.row_no,
      issue.internal_ip ?? '',
      issue.raw_value || '(空)',
      issue.reason === 'missing'
        ? '未填写且无法按 IP 识别已有卡型，请选择卡型'
        : '未识别且无法按 IP 识别已有卡型，请选择卡型',
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '卡型校验失败')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

export function downloadUnrecognizedGpuCardTypesExcel(
  issues: GpuCardTypeImportIssue[],
  fileName = '卡型校验失败.xlsx',
): void {
  if (issues.length === 0) return
  const buffer = buildUnrecognizedGpuCardTypesWorkbook(issues)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function gpuCardTypeMatchLabel(matchedBy: InventoryGpuRowResolution['matchedBy']): string {
  if (matchedBy === 'name') return '名称'
  if (matchedBy === 'code') return '编码'
  if (matchedBy === 'existing_ip') return '已有设备'
  return '手工'
}
