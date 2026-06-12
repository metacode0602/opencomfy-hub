import XLSX from 'xlsx-js-style'
import type { TenantRechargeBalanceQueryRow } from '@/lib/types/tenant-recharge-balance-query'

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E8EEF4' } },
}

const HEADERS = [
  '平台租户ID',
  '租户名称',
  '客户全称',
  '项目标签',
  '充值总额',
  '当前余额',
  '首次充值时间',
  '状态',
] as const

function formatMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function formatProjectTags(row: TenantRechargeBalanceQueryRow): string {
  if (!row.found || row.projectTags.length === 0) return '—'
  return row.projectTags.map((tag) => tag.name).join('、')
}

function formatRow(row: TenantRechargeBalanceQueryRow): (string | number)[] {
  return [
    row.platformTenantId,
    row.found ? (row.tenantName ?? '—') : '—',
    row.found ? (row.customerName ?? '—') : '—',
    formatProjectTags(row),
    row.found ? formatMoney(row.monthlyRechargeTotal) : '—',
    row.found ? formatMoney(row.currentBalance) : '—',
    row.found ? formatDateTime(row.firstRechargeAt) : '—',
    row.found ? '已匹配' : '未找到',
  ]
}

export function downloadTenantRechargeBalanceQueryExcel(params: {
  rows: TenantRechargeBalanceQueryRow[]
  usageMonth: string
}): boolean {
  if (params.rows.length === 0) return false

  const wsData: (string | number)[][] = [HEADERS as unknown as string[], ...params.rows.map(formatRow)]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  for (let c = 0; c < HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = HEADER_STYLE
  }

  ws['!cols'] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 28 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 10 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '租户充值余额查询')
  XLSX.writeFile(wb, `租户充值余额查询-${params.usageMonth}.xlsx`)
  return true
}
