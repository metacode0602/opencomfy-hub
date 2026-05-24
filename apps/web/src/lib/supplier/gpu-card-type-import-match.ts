import * as XLSX from 'xlsx'

export type GpuCardTypeRef = {
  id: string
  code: string
  name: string
}

export type GpuCardTypeImportIssue = {
  row_no: number
  raw_value: string
  reason: 'missing' | 'unrecognized' | 'needs_selection'
}

export type InventoryGpuRowRef = {
  row_no: number
  gpu_card_type_code?: string
  gpu_card_type_id?: string
  parse_status: 'ok' | 'warning' | 'error'
}

export type InventoryGpuRowResolution = {
  gpuCardTypeId: string
  gpuCardTypeCode: string
  gpuCardTypeName: string
  matchedBy: 'name' | 'code' | 'manual'
  raw: string
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

function resolveManualGpuCardType(
  gpuCardTypeId: string | undefined,
  cardTypes: GpuCardTypeRef[],
): InventoryGpuRowResolution | null {
  const id = gpuCardTypeId?.trim()
  if (!id) return null
  const card = cardTypes.find((item) => item.id === id)
  if (!card) return null
  return {
    gpuCardTypeId: card.id,
    gpuCardTypeCode: card.code,
    gpuCardTypeName: card.name,
    matchedBy: 'manual',
    raw: '',
  }
}

export function validateInventoryGpuCardTypes(
  rows: InventoryGpuRowRef[],
  cardTypes: GpuCardTypeRef[],
): ValidateInventoryGpuResult {
  const rowResolutions = new Map<number, InventoryGpuRowResolution>()
  const issues: GpuCardTypeImportIssue[] = []
  const unrecognizedSet = new Set<string>()

  for (const row of rows) {
    if (row.parse_status === 'error') continue

    const raw = row.gpu_card_type_code?.trim() ?? ''
    const autoMatched = raw ? matchGpuCardType(raw, cardTypes) : null
    const manualMatched = resolveManualGpuCardType(row.gpu_card_type_id, cardTypes)

    if (manualMatched) {
      rowResolutions.set(row.row_no, {
        ...manualMatched,
        raw: raw || manualMatched.gpuCardTypeCode,
      })
      continue
    }

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

    if (!raw) {
      issues.push({ row_no: row.row_no, raw_value: '', reason: 'missing' })
      continue
    }

    issues.push({ row_no: row.row_no, raw_value: raw, reason: 'unrecognized' })
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
        ? `共 ${validation.pendingSelectionCount} 行尚未选择卡型`
        : ''
    super(
      labels
        ? `显卡型号无法识别：${labels}；${pendingHint}`
        : pendingHint || '存在尚未选择卡型的行，无法入库',
    )
    this.name = 'DeviceImportUnrecognizedGpuCardError'
    this.validation = validation
  }
}

export function buildUnrecognizedGpuCardTypesWorkbook(issues: GpuCardTypeImportIssue[]): ArrayBuffer {
  const rows: Array<Array<string | number>> = [
    ['行号', '显卡型号', '问题'],
    ...issues.map((issue) => [
      issue.row_no,
      issue.raw_value || '(空)',
      issue.reason === 'missing'
        ? '未填写（请在预览中选择卡型，如 CPU 管控节点）'
        : issue.reason === 'unrecognized'
          ? '未识别（请在预览中选择卡型）'
          : '待选择卡型',
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '待确认卡型')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

export function downloadUnrecognizedGpuCardTypesExcel(
  issues: GpuCardTypeImportIssue[],
  fileName = '待确认显卡型号.xlsx',
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
  return '手工'
}
