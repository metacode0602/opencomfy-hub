import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { FinanceError } from './errors'
import { financeLog } from './logger'

export type SheetRow = Record<string, string | number | null>

export type ParsedWorkbook = {
  headers: string[]
  rows: {
    rowNo: number
    cells: (string | number | null)[]
    row: SheetRow
  }[]
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, '')
}

function rowToObject(headers: string[], values: unknown[]): SheetRow {
  const obj: SheetRow = {}
  headers.forEach((h, i) => {
    if (!h) return
    const v = values[i]
    if (v === undefined || v === null || v === '') {
      obj[h] = null
    } else if (typeof v === 'number') {
      obj[h] = v
    } else {
      obj[h] = String(v).trim()
    }
  })
  return obj
}

export function parseWorkbookDetailed(buffer: Buffer, fileName: string): ParsedWorkbook {
  financeLog('excel', 'parsing workbook', { fileName, bytes: buffer.length })
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch (e) {
    throw new FinanceError(
      'BAD_REQUEST',
      `无法解析文件 ${fileName}：${e instanceof Error ? e.message : '格式错误'}`,
    )
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new FinanceError('BAD_REQUEST', 'Excel 无有效工作表')
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new FinanceError('BAD_REQUEST', 'Excel 工作表为空')
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][]
  if (matrix.length < 2) {
    throw new FinanceError('BAD_REQUEST', 'Excel 至少需要表头与一行数据')
  }
  const headerRow = matrix[0] as unknown[]
  const headers = headerRow.map((c) => String(c ?? '').trim())
  const rows: ParsedWorkbook['rows'] = []
  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i] as unknown[]
    if (!values || values.every((c) => c == null || String(c).trim() === '')) continue
    const cells = headers.map((_, ci) => {
      const v = values[ci]
      if (v === undefined || v === null || v === '') return null
      if (typeof v === 'number') return v
      return String(v).trim()
    })
    rows.push({
      rowNo: i + 1,
      cells,
      row: rowToObject(headers, values),
    })
  }
  financeLog('excel', 'parsed rows', { fileName, count: rows.length })
  return { headers, rows }
}

export function parseWorkbookBuffer(buffer: Buffer, fileName: string): SheetRow[] {
  return parseWorkbookDetailed(buffer, fileName).rows.map((r) => r.row)
}

export function pickColumn(row: SheetRow, aliases: string[]): string | null {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const norm = normalizeHeader(alias)
    const hit = keys.find((k) => normalizeHeader(k) === norm)
    if (hit && row[hit] != null && String(row[hit]).trim() !== '') {
      return String(row[hit]).trim()
    }
  }
  return null
}

const TOTAL_ROW_MARKERS = new Set(['总计', '合计', 'total'])

export const TENANT_PLATFORM_ID_ALIASES = [
  '租户ID',
  'tenant_id',
  'tenantId',
  '客户ID',
  'customer_id',
  'customerId',
] as const

const CUSTOMER_CONSUMPTION_LABEL_ALIASES = [
  ['类型', 'product_type'],
  ['项目名称', 'project_name'],
  ['租户类型', 'tenant_type'],
  ['客户类型', 'customer_type'],
] as const

const CUSTOMER_CONSUMPTION_AMOUNT_ALIASES = new Set(
  ['总消费', 'total_consumption', '券消费', 'voucher_consumption', '余额消费', 'balance_consumption'].map(
    normalizeHeader,
  ),
)

function normalizeTotalMarker(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/[：:，,。.；;]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function isAmountColumnKey(key: string): boolean {
  return CUSTOMER_CONSUMPTION_AMOUNT_ALIASES.has(normalizeHeader(key))
}

/** 单元格值为「总计 / 合计 / Total」时视为汇总标识 */
export function isTotalRow(value: string | null): boolean {
  if (!value) return false
  return TOTAL_ROW_MARKERS.has(normalizeTotalMarker(value))
}

/** 行内租户/客户 ID 列为汇总标识时跳过 */
export function isTenantTotalRow(row: SheetRow): boolean {
  return isTotalRow(pickColumn(row, [...TENANT_PLATFORM_ID_ALIASES]))
}

/**
 * 客户消费明细表尾合计行：租户 ID 或其它标识列出现汇总文案时跳过，不参与导入与校验。
 */
export function isCustomerConsumptionTotalRow(row: SheetRow): boolean {
  if (isTenantTotalRow(row)) return true

  for (const aliases of CUSTOMER_CONSUMPTION_LABEL_ALIASES) {
    if (isTotalRow(pickColumn(row, [...aliases]))) return true
  }

  for (const [key, value] of Object.entries(row)) {
    if (value == null || isAmountColumnKey(key)) continue
    if (isTotalRow(String(value))) return true
  }

  return false
}

export function parseMoneyCell(raw: string | null): string {
  if (!raw) return '0'
  const cleaned = raw.replace(/[￥¥,\s]/g, '')
  const n = Number(cleaned)
  if (Number.isNaN(n)) return '0'
  return n.toFixed(4)
}

export function normalizeCustomerType(raw: string | null): 'B' | 'C' | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (s === 'b' || s === 'b端' || s.startsWith('b端')) return 'B'
  if (s === 'c' || s === 'c端' || s.startsWith('c端')) return 'C'
  return null
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
