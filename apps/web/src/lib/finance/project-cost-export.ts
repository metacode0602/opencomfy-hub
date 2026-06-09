import type {
  ProjectCostMetricRow,
  ProjectCostTenantGroup,
} from '@/lib/finance/project-cost-from-source-lines'
import XLSX from 'xlsx-js-style'

const METRIC_HEADERS = [
  '求和项:余额消费',
  '求和项:余额卡时',
  '求和项:券卡时',
  '确认收入(不含税)',
  '售出时长成本(不含税)',
  '赠送时长成本(不含税)',
  '毛利',
] as const

const LABEL_HEADERS = [
  '项目',
  '平台租户ID',
  '客户全称',
  '客户经理',
  '商机来源',
  '月序',
  '区域',
  '卡型',
] as const
const COL_COUNT = LABEL_HEADERS.length + METRIC_HEADERS.length
const GROSS_PROFIT_COL = COL_COUNT - 1

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFFFF' } },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'FF4472C4' } },
}

const GROSS_PROFIT_FILL = {
  patternType: 'solid' as const,
  fgColor: { rgb: 'FFFFFF00' },
}

type SheetRowMeta =
  | { kind: 'header' }
  | { kind: 'summary' }
  | { kind: 'detail' }
  | { kind: 'blank' }

function metricCells(row: ProjectCostMetricRow): number[] {
  return [
    row.balanceConsumption,
    row.balanceCardHours,
    row.voucherCardHours,
    row.confirmedRevenueExclTax,
    row.soldDurationCostExclTax,
    row.giftedDurationCostExclTax,
    row.grossProfit,
  ]
}

function emptyRow(): (string | number)[] {
  return Array.from({ length: COL_COUNT }, () => '')
}

function formatText(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  return value
}

function sortGroupsForExport(
  groups: ProjectCostTenantGroup[],
): ProjectCostTenantGroup[] {
  return [...groups].sort((a, b) => {
    const amA = a.accountManager.trim()
    const amB = b.accountManager.trim()
    if (!amA && amB) return 1
    if (amA && !amB) return -1
    const amCmp = amA.localeCompare(amB, 'zh-CN')
    if (amCmp !== 0) return amCmp
    return a.tenantName.localeCompare(b.tenantName, 'zh-CN')
  })
}

function buildSheetRows(input: {
  periodCode: string
  groups: ProjectCostTenantGroup[]
}): { wsData: (string | number)[][]; rowMeta: SheetRowMeta[] } {
  const wsData: (string | number)[][] = []
  const rowMeta: SheetRowMeta[] = []

  input.groups.forEach((group, index) => {
    if (index > 0) {
      wsData.push(emptyRow())
      rowMeta.push({ kind: 'blank' })
    }

    wsData.push([input.periodCode, ...LABEL_HEADERS.slice(1), ...METRIC_HEADERS])
    rowMeta.push({ kind: 'header' })

    wsData.push([
      group.tenantName,
      group.tenantPlatformId,
      formatText(group.customerFullName),
      formatText(group.accountManager),
      formatText(group.opportunitySource),
      formatText(group.monthPhaseLabel),
      '',
      '',
      ...metricCells(group.sumRow),
    ])
    rowMeta.push({ kind: 'summary' })

    for (const detail of group.detailRows) {
      wsData.push([
        '',
        '',
        '',
        '',
        '',
        '',
        detail.region,
        detail.cardType,
        ...metricCells(detail),
      ])
      rowMeta.push({ kind: 'detail' })
    }
  })

  return { wsData, rowMeta }
}

function applySheetStyles(
  ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>,
  rowMeta: SheetRowMeta[],
) {
  for (let r = 0; r < rowMeta.length; r++) {
    const meta = rowMeta[r]!
    for (let c = 0; c < COL_COUNT; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) {
        ws[addr] = { t: 's', v: '' }
      }

      if (meta.kind === 'header') {
        ws[addr].s = HEADER_STYLE
        continue
      }

      if (meta.kind === 'summary' && c === GROSS_PROFIT_COL) {
        ws[addr].s = { fill: GROSS_PROFIT_FILL }
      }
    }
  }
}

export function downloadProjectCostExcel(params: {
  groups: ProjectCostTenantGroup[]
  periodCode: string
}): boolean {
  if (params.groups.length === 0) return false

  const { wsData, rowMeta } = buildSheetRows({
    periodCode: params.periodCode,
    groups: sortGroupsForExport(params.groups),
  })

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  applySheetStyles(ws, rowMeta)

  ws['!cols'] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    ...METRIC_HEADERS.map(() => ({ wch: 18 })),
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '项目成本毛利')
  XLSX.writeFile(wb, `项目成本毛利-${params.periodCode}.xlsx`)
  return true
}
