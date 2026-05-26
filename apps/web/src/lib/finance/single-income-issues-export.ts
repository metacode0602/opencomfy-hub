import type { SingleIncomeIssueRow } from '@/lib/finance/single-income-types'
import XLSX from 'xlsx-js-style'

const HEADERS = [
  '错误类型',
  '错误说明',
  '项目ID',
  '项目名称',
  '租户ID',
  '租户名称',
  '平台租户ID',
  '客户ID',
  '客户名称',
  '账单ID',
] as const

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E8EEF4' } },
}

const ERROR_FILL = {
  patternType: 'solid' as const,
  fgColor: { rgb: 'FFFFC7CE' },
}

function cellValue(value: string | null | undefined): string {
  return value == null ? '' : String(value)
}

function buildAoa(rows: SingleIncomeIssueRow[]): (string | number)[][] {
  return [
    [...HEADERS],
    ...rows.map((r) => [
      cellValue(r.issueType),
      cellValue(r.errorMessage),
      cellValue(r.projectId),
      cellValue(r.projectName),
      cellValue(r.tenantId),
      cellValue(r.tenantName),
      cellValue(r.platformTenantId),
      cellValue(r.customerId),
      cellValue(r.customerName),
      cellValue(r.billId),
    ]),
  ]
}

function applySheetStyles(ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>, rowCount: number) {
  const colCount = HEADERS.length
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) continue
      if (r === 0) {
        ws[addr].s = HEADER_STYLE
      } else {
        ws[addr].s = { fill: ERROR_FILL }
      }
    }
  }
  ws['!cols'] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 28 },
    { wch: 24 },
    { wch: 28 },
    { wch: 20 },
    { wch: 14 },
    { wch: 28 },
    { wch: 24 },
    { wch: 28 },
  ]
}

export function downloadSingleIncomeIssuesExcel(params: {
  rows: SingleIncomeIssueRow[]
  periodCode: string
}): boolean {
  if (params.rows.length === 0) return false

  const wsData = buildAoa(params.rows)
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  applySheetStyles(ws, wsData.length)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '收入计算问题明细')
  XLSX.writeFile(wb, `收入计算问题明细-${params.periodCode}.xlsx`)
  return true
}
