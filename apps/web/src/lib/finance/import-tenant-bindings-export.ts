import type { ImportTenantBindingRow } from '@/lib/server/dataaccess/finance/list-import-tenant-bindings'
import XLSX from 'xlsx-js-style'

const importSourceLabels: Record<string, string> = {
  tenant_bill: '客户账单',
  baremetal: '裸金属订单',
}

const enrichmentSourceLabels: Record<string, string> = {
  auto_single: '自动（单项目）',
  auto_preset: '预置分成',
  manual_period: '账期手动',
}

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E8EEF4' } },
}

const HEADERS = [
  '平台租户 ID',
  '导入来源',
  '租户类型',
  '客户类型',
  '租户名称',
  '客户全称',
  '项目名称',
  '客户经理',
  '经理部门',
  '项目归属部门',
  '分成 %',
  '补全来源',
] as const

function formatTenantType(type: string | null): string {
  if (type === 'internal') return '内部租户'
  if (type === 'external') return '外部租户'
  return '—'
}

function formatCustomerType(type: string | null): string {
  if (type === 'B') return 'B 端（企业）'
  if (type === 'C') return 'C 端（个人）'
  return '—'
}

function formatImportSources(sources: string[]): string {
  if (sources.length === 0) return '—'
  return sources.map((s) => importSourceLabels[s] ?? s).join('、')
}

function formatText(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return value
}

function formatRow(row: ImportTenantBindingRow): string[] {
  return [
    row.tenant_platform_id,
    formatImportSources(row.import_sources),
    formatTenantType(row.tenant_type),
    formatCustomerType(row.customer_type),
    formatText(row.tenant_name),
    formatText(row.customer_full_name),
    formatText(row.project_name),
    formatText(row.account_manager_name),
    formatText(row.staff_department),
    formatText(row.project_revenue_department),
    formatText(row.allocation_percent),
    row.enrichment_source
      ? (enrichmentSourceLabels[row.enrichment_source] ?? row.enrichment_source)
      : '—',
  ]
}

export function downloadImportTenantBindingsExcel(params: {
  rows: ImportTenantBindingRow[]
  periodCode: string
}): boolean {
  const { rows, periodCode } = params
  if (rows.length === 0) return false

  const wsData: string[][] = [HEADERS as unknown as string[], ...rows.map(formatRow)]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  for (let c = 0; c < HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = HEADER_STYLE
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '租户项目映射')
  XLSX.writeFile(wb, `租户项目映射-${periodCode}.xlsx`)
  return true
}
