import * as XLSX from 'xlsx'

import {
  DEVICE_RETIRE_EXCEL_HEADERS,
  DEVICE_RETIRE_MAX_ROWS,
  type DeviceRetireParsedRow,
} from '@/lib/types/device-retire'

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

function parseCsvTextToMatrix(text: string): unknown[][] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const lines = rawLines.filter((l) => normCell(l).length > 0)
  return lines.map(splitCsvLine)
}

function pickIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i] ?? '')
    if (aliases.some((a) => normHeader(a) === h)) return i
  }
  return -1
}

function cell(row: unknown[], idx: number): string {
  if (idx === -1) return ''
  const v = row[idx]
  if (v == null) return ''
  return normCell(String(v))
}

export function parseDeviceRetireMatrix(matrix: unknown[][]): {
  rows: Omit<
    DeviceRetireParsedRow,
    'parse_status' | 'errors' | 'warnings' | 'errorColumnIndexes' | 'matched_device_id'
  >[]
  originalHeaders: string[]
} {
  if (matrix.length < 2) {
    throw new Error('文件至少需要表头一行与一行数据')
  }

  const headers = (matrix[0] ?? []).map((h) => normCell(String(h ?? '')))
  const originalHeaders =
    headers.filter(Boolean).length > 0 ? headers : [...DEVICE_RETIRE_EXCEL_HEADERS]

  const iDeviceId = pickIndex(originalHeaders, ['设备id', '设备ID', 'external_device_id'])
  const iAsset = pickIndex(originalHeaders, ['设备标识', 'asset_no', 'sn', '资产号'])
  const iExtIp = pickIndex(originalHeaders, [
    '外网ip',
    '外网IP',
    '公网ip',
    'public_ip',
    'external_ip',
  ])
  const iIntIp = pickIndex(originalHeaders, ['内网ip', '内网IP', '内网ip地址', 'internal_ip'])

  if (iDeviceId === -1 && iAsset === -1 && iExtIp === -1 && iIntIp === -1) {
    throw new Error('未识别到设备标识列，请至少包含：设备ID、设备标识、外网IP 或 内网IP 之一')
  }

  const dataRows = matrix.slice(1).filter((row) => {
    const cells = row as unknown[]
    return cells.some((c) => normCell(String(c ?? '')).length > 0)
  })

  if (dataRows.length === 0) {
    throw new Error('文件无有效数据行')
  }
  if (dataRows.length > DEVICE_RETIRE_MAX_ROWS) {
    throw new Error(`单次最多 ${DEVICE_RETIRE_MAX_ROWS} 行`)
  }

  const rows = dataRows.map((raw, idx) => {
    const row = raw as unknown[]
    const originalCells = originalHeaders.map((_, colIdx) => cell(row, colIdx))
    return {
      row_no: idx + 2,
      external_device_id: cell(row, iDeviceId) || null,
      asset_no: cell(row, iAsset) || null,
      external_ip: cell(row, iExtIp) || null,
      internal_ip: cell(row, iIntIp) || null,
      originalCells,
    }
  })

  return { rows, originalHeaders }
}

function isCsvImportFileName(fileName: string): boolean {
  const name = fileName.toLowerCase()
  return name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')
}

/** 解析 Excel / CSV 设备下架清单 */
export function parseDeviceRetireFile(
  buffer: ArrayBuffer,
  fileName: string,
): {
  rows: Omit<
    DeviceRetireParsedRow,
    'parse_status' | 'errors' | 'warnings' | 'errorColumnIndexes' | 'matched_device_id'
  >[]
  originalHeaders: string[]
} {
  if (isCsvImportFileName(fileName)) {
    const text = new TextDecoder('utf-8').decode(buffer)
    const matrix = parseCsvTextToMatrix(text)
    return parseDeviceRetireMatrix(matrix)
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch (e) {
    throw new Error(`无法解析文件 ${fileName}：${e instanceof Error ? e.message : '格式错误'}`)
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 无有效工作表')

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Excel 工作表为空')

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  return parseDeviceRetireMatrix(matrix)
}
