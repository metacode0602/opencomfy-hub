import XLSX from 'xlsx-js-style'
import type { ParsedWorkbook } from './excel-parser'

const ERROR_FILL = {
  fill: {
    patternType: 'solid' as const,
    fgColor: { rgb: 'FFFFC7CE' },
  },
}

const ERROR_FONT = {
  color: { rgb: 'FF9C0006' },
}

export type ImportCellError = {
  rowNo: number
  columnAliases: string[]
  message: string
}

function resolveColumnIndex(headers: string[], aliases: string[]): number {
  const normalizeHeader = (h: string) => h.trim().replace(/\s+/g, '')
  for (const alias of aliases) {
    const norm = normalizeHeader(alias)
    const idx = headers.findIndex((h) => normalizeHeader(h) === norm)
    if (idx >= 0) return idx
  }
  return -1
}

export function buildMarkedErrorWorkbookBuffer(input: {
  sheet: ParsedWorkbook
  errors: ImportCellError[]
  includeAllRows?: boolean
}): Buffer {
  const { sheet, errors, includeAllRows = true } = input
  const errorsByRow = new Map<number, ImportCellError[]>()
  for (const err of errors) {
    const list = errorsByRow.get(err.rowNo) ?? []
    list.push(err)
    errorsByRow.set(err.rowNo, list)
  }

  const headers = [...sheet.headers, '错误说明']
  const errorReasonCol = headers.length - 1
  const wsData: (string | number | null)[][] = [headers]

  const sourceRows = includeAllRows
    ? sheet.rows
    : sheet.rows.filter((r) => errorsByRow.has(r.rowNo))

  for (const row of sourceRows) {
    const rowErrors = errorsByRow.get(row.rowNo) ?? []
    const line: (string | number | null)[] = sheet.headers.map((_, idx) => row.cells[idx] ?? null)
    while (line.length < sheet.headers.length) line.push(null)
    line[errorReasonCol] = rowErrors.map((e) => e.message).join('；')
    wsData.push(line)
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  for (let r = 1; r < wsData.length; r++) {
    const sheetRow = sourceRows[r - 1]!
    const rowErrors = errorsByRow.get(sheetRow.rowNo) ?? []
    const errorColIndexes = new Set<number>()
    for (const err of rowErrors) {
      const idx = resolveColumnIndex(sheet.headers, err.columnAliases)
      if (idx >= 0) errorColIndexes.add(idx)
    }

    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) {
        ws[addr] = { t: 's', v: String(wsData[r]![c] ?? '') }
      }
      if (c === errorReasonCol && rowErrors.length > 0) {
        ws[addr].s = { ...ERROR_FILL, font: ERROR_FONT }
      } else if (errorColIndexes.has(c)) {
        ws[addr].s = { ...ERROR_FILL, font: ERROR_FONT }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入错误')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function summarizeImportErrors(errors: ImportCellError[], limit = 3): string {
  if (errors.length === 0) return ''
  const parts = errors.slice(0, limit).map((e) => `第 ${e.rowNo} 行：${e.message}`)
  const suffix = errors.length > limit ? `…共 ${errors.length} 处错误` : ''
  return parts.join('；') + suffix
}
