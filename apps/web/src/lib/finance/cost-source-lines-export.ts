import { parseMoney } from '@/lib/finance/income-row-utils'
import type { CostSourceLineDto } from '@/lib/server/dataaccess/finance/list-cost-source-lines'
import XLSX from 'xlsx-js-style'

const kindLabels: Record<string, string> = {
  flex: '弹性',
  baremetal: '裸金属',
}

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E8EEF4' } },
}

const HEADERS = [
  '来源',
  '租户 ID',
  '平台租户 ID',
  '租户名称',
  '总消费',
  '券消费',
  '余额消费',
  '总卡时',
  '券卡时',
  '余额卡时',
  'GPU 卡型',
  '区域',
  '机房名称',
  '价格/分成',
  '客户经理',
] as const

function formatText(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return value
}

function moneyCell(value: string | null | undefined): number | '' {
  if (value == null || value === '') return ''
  return parseMoney(value)
}

function formatRow(row: CostSourceLineDto): (string | number)[] {
  return [
    kindLabels[row.kind] ?? row.kind,
    formatText(row.tenant_id),
    row.tenant_platform_id,
    formatText(row.tenant_name),
    moneyCell(row.total_consumption),
    moneyCell(row.voucher_consumption),
    moneyCell(row.balance_consumption),
    moneyCell(row.total_card_hours),
    moneyCell(row.voucher_card_hours),
    moneyCell(row.balance_card_hours),
    formatText(row.gpu_card_type_name),
    formatText(row.region),
    formatText(row.data_center_name),
    formatText(row.pricing_label),
    formatText(row.staff_name),
  ]
}

export function downloadCostSourceLinesExcel(params: {
  rows: CostSourceLineDto[]
  periodCode: string
}): boolean {
  const { rows, periodCode } = params
  if (rows.length === 0) return false

  const wsData: (string | number)[][] = [
    [...HEADERS],
    ...rows.map(formatRow),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  for (let c = 0; c < HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = HEADER_STYLE
  }

  ws['!cols'] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 28 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 28 },
    { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '成本中间表')
  XLSX.writeFile(wb, `成本中间表-${periodCode}.xlsx`)
  return true
}
