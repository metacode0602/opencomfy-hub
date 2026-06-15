import * as XLSX from 'xlsx'

export const OFFLINE_BARE_METAL_IMPORT_MAX_ROWS = 500
export const OFFLINE_BARE_METAL_IMPORT_MAX_BYTES = 5 * 1024 * 1024

const REQUIRED_COLUMNS = ['卡型', '卡数', '开始时间', '结束时间', '时长', '卡时单价', '总价'] as const

export const OFFLINE_BARE_METAL_COLUMN_ALIASES: Record<string, string[]> = {
  卡型: ['卡型', 'gpu型号', 'gpu_model', 'card_type'],
  卡数: ['卡数', 'gpu数', 'gpu_count'],
  开始时间: ['开始时间', '起租时间', 'start_time', 'rent_start'],
  结束时间: ['结束时间', '到期时间', 'end_time', 'rent_end'],
  时长: ['时长', '租用时长', 'hours', 'duration_hours'],
  卡时单价: ['卡时单价', '单价', 'unit_price'],
  总价: ['总价', '金额', 'total', 'line_amount'],
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, '').toLowerCase()
}

function buildAliasIndex(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [canonical, aliases] of Object.entries(OFFLINE_BARE_METAL_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      map.set(normalizeHeader(alias), canonical)
    }
    map.set(normalizeHeader(canonical), canonical)
  }
  return map
}

const ALIAS_INDEX = buildAliasIndex()

export type OfflineBareMetalParsedRow = {
  rowNo: number
  cardType: string
  gpuCount: number
  rentStartsAt: Date
  rentEndsAt: Date
  durationHours: number
  unitPricePerCardHour: number
  lineAmount: number
  errors: string[]
}

export type OfflineBareMetalParseResult = {
  rows: OfflineBareMetalParsedRow[]
  headerErrors: string[]
  missingColumns: string[]
}

function parseMoney(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const text = String(raw).replace(/[￥¥,\s]/g, '')
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function parseDateTime(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  if (typeof raw === 'number') {
    const epoch = XLSX.SSF.parse_date_code(raw)
    if (epoch) {
      return new Date(epoch.y, epoch.m - 1, epoch.d, epoch.H, epoch.M, epoch.S)
    }
  }
  const text = String(raw).trim()
  if (!text) return null
  const normalized = text.replace(/\//g, '-')
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseInteger(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  const n = Number(String(raw).trim())
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function parseOfflineBareMetalExcelBuffer(buffer: Buffer): OfflineBareMetalParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], headerErrors: ['Excel 无工作表'], missingColumns: [...REQUIRED_COLUMNS] }
  }

  const sheet = workbook.Sheets[sheetName]!
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as (string | number | Date | null)[][]

  if (matrix.length === 0) {
    return { rows: [], headerErrors: ['Excel 为空'], missingColumns: [...REQUIRED_COLUMNS] }
  }

  const headerRow = matrix[0] ?? []
  const columnIndex = new Map<string, number>()
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i]
    if (cell == null) continue
    const canonical = ALIAS_INDEX.get(normalizeHeader(String(cell)))
    if (canonical && !columnIndex.has(canonical)) {
      columnIndex.set(canonical, i)
    }
  }

  const missingColumns = REQUIRED_COLUMNS.filter((col) => !columnIndex.has(col))
  if (missingColumns.length > 0) {
    return {
      rows: [],
      headerErrors: [`缺少必填列：${missingColumns.join('、')}`],
      missingColumns: [...missingColumns],
    }
  }

  const rows: OfflineBareMetalParsedRow[] = []
  const headerErrors: string[] = []

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i]
    if (!line || line.every((c) => c == null || String(c).trim() === '')) continue
    if (rows.length >= OFFLINE_BARE_METAL_IMPORT_MAX_ROWS) {
      headerErrors.push(`超过最大行数 ${OFFLINE_BARE_METAL_IMPORT_MAX_ROWS}`)
      break
    }

    const pick = (col: (typeof REQUIRED_COLUMNS)[number]) => line[columnIndex.get(col)!]

    const errors: string[] = []
    const cardType = String(pick('卡型') ?? '').trim()
    const gpuCount = parseInteger(pick('卡数'))
    const rentStartsAt = parseDateTime(pick('开始时间'))
    const rentEndsAt = parseDateTime(pick('结束时间'))
    const durationHours = parseMoney(pick('时长'))
    const unitPricePerCardHour = parseMoney(pick('卡时单价'))
    const lineAmount = parseMoney(pick('总价'))

    if (!cardType) errors.push('卡型不能为空')
    if (gpuCount == null || gpuCount <= 0) errors.push('卡数须为正整数')
    if (!rentStartsAt) errors.push('开始时间无效')
    if (!rentEndsAt) errors.push('结束时间无效')
    if (rentStartsAt && rentEndsAt && rentStartsAt > rentEndsAt) {
      errors.push('开始时间不能晚于结束时间')
    }
    if (durationHours == null || durationHours <= 0) errors.push('时长须大于 0')
    if (unitPricePerCardHour == null || unitPricePerCardHour < 0) errors.push('卡时单价无效')
    if (lineAmount == null || lineAmount < 0) errors.push('总价无效')

    if (
      gpuCount != null &&
      durationHours != null &&
      unitPricePerCardHour != null &&
      lineAmount != null &&
      gpuCount > 0
    ) {
      const expected = gpuCount * durationHours * unitPricePerCardHour
      if (Math.abs(expected - lineAmount) > 0.01) {
        errors.push(`总价与 卡数×时长×单价 不一致（期望 ${expected.toFixed(2)}）`)
      }
    }

    rows.push({
      rowNo: i + 1,
      cardType,
      gpuCount: gpuCount ?? 0,
      rentStartsAt: rentStartsAt ?? new Date(0),
      rentEndsAt: rentEndsAt ?? new Date(0),
      durationHours: durationHours ?? 0,
      unitPricePerCardHour: unitPricePerCardHour ?? 0,
      lineAmount: lineAmount ?? 0,
      errors,
    })
  }

  if (rows.length === 0 && headerErrors.length === 0) {
    headerErrors.push('未找到有效数据行')
  }

  return { rows, headerErrors, missingColumns: [] }
}

export function summarizeOfflineBareMetalRows(rows: OfflineBareMetalParsedRow[]) {
  const okRows = rows.filter((r) => r.errors.length === 0)
  const finalAmount = okRows.reduce((sum, r) => sum + r.lineAmount, 0)
  const gpuCount = okRows.reduce((sum, r) => sum + r.gpuCount, 0)
  const rentStartsAt =
    okRows.length > 0
      ? new Date(Math.min(...okRows.map((r) => r.rentStartsAt.getTime())))
      : null
  const rentEndsAt =
    okRows.length > 0
      ? new Date(Math.max(...okRows.map((r) => r.rentEndsAt.getTime())))
      : null

  return {
    deviceLineCount: okRows.length,
    gpuCount,
    finalAmount,
    rentStartsAt,
    rentEndsAt,
    orderedAt: rentStartsAt,
  }
}
