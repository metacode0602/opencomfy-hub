import { parseMoney } from '@/lib/finance/income-row-utils'
import {
  personalIncomeSummaryKindLabel,
  type PersonalIncomeSummaryKind,
} from '@/lib/finance/personal-income-labels'
import XLSX from 'xlsx-js-style'

export type PersonalIncomeSummaryRow = {
  summary_kind: PersonalIncomeSummaryKind
  balance_consumption: string
  bare_metal_consumption: string
  total_consumption: string
  matched_tenant_count: number
}

const HEADERS = [
  '汇总类型',
  '余额消费',
  '线上裸金属消费',
  '总消费',
  '租户数',
] as const

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E8EEF4' } },
}

function moneyCell(value: string): number | '' {
  if (value == null || value === '') return ''
  const n = parseMoney(value)
  return Number.isNaN(n) ? '' : n
}

export function downloadPersonalIncomeSummaryExcel(params: {
  rows: PersonalIncomeSummaryRow[]
  periodCode: string
}): boolean {
  const { rows, periodCode } = params
  if (rows.length === 0) return false

  const wsData: (string | number)[][] = [
    [...HEADERS],
    ...rows.map((row) => [
      personalIncomeSummaryKindLabel(row.summary_kind),
      moneyCell(row.balance_consumption),
      moneyCell(row.bare_metal_consumption),
      moneyCell(row.total_consumption),
      row.matched_tenant_count,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  for (let c = 0; c < HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = HEADER_STYLE
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '收入汇总')
  XLSX.writeFile(wb, `个人收入汇总-${periodCode}.xlsx`)
  return true
}
