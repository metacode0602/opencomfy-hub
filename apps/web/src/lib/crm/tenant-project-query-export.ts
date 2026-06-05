import XLSX from 'xlsx-js-style'
import { OPPORTUNITY_SOURCE_LABELS } from '@/lib/crm/commission-constants'
import type { TenantProjectQueryRow } from '@/lib/types/tenant-project-query'

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E8EEF4' } },
}

const HEADERS = [
  '平台租户ID',
  '租户名称',
  '项目名称',
  '客户经理',
  '交付',
  '售前',
  '项目经理',
  '商机来源',
  '成交锚定月',
] as const

function formatRow(row: TenantProjectQueryRow): (string | number)[] {
  return [
    row.platformTenantId,
    row.tenantName,
    row.projectName,
    row.accountManager || '—',
    row.deliveryManager || '—',
    row.preSalesManager || '—',
    row.projectManager || '—',
    row.opportunitySource ? OPPORTUNITY_SOURCE_LABELS[row.opportunitySource] : '—',
    row.dealClosedMonth ?? '—',
  ]
}

export function downloadTenantProjectQueryExcel(rows: TenantProjectQueryRow[]): boolean {
  if (rows.length === 0) return false

  const wsData: (string | number)[][] = [HEADERS as unknown as string[], ...rows.map(formatRow)]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  for (let c = 0; c < HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = HEADER_STYLE
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '租户项目查询')
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `租户项目查询-${stamp}.xlsx`)
  return true
}
