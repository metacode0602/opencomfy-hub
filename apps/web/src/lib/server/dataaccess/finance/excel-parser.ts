import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { FinanceError } from './errors'
import { financeLog } from './logger'

export type SheetRow = Record<string, string | number | null>

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

export function parseWorkbookBuffer(buffer: Buffer, fileName: string): SheetRow[] {
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
  const headers = headerRow.map((c) => normalizeHeader(String(c ?? '')))
  const rows: SheetRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i] as unknown[]
    if (!values || values.every((c) => c == null || String(c).trim() === '')) continue
    rows.push(rowToObject(headers, values))
  }
  financeLog('excel', 'parsed rows', { fileName, count: rows.length })
  return rows
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

export function isTotalRow(tenantId: string | null): boolean {
  if (!tenantId) return false
  return TOTAL_ROW_MARKERS.has(tenantId.trim().toLowerCase())
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
