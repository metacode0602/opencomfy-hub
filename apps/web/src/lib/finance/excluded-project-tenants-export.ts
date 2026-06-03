import XLSX from 'xlsx-js-style'

export type ExcludedProjectTenantRow = {
  platform_tenant_id: string
  project_names: string[]
}

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E8EEF4' } },
}

/** Markdown 表格，便于粘贴到文档 / IM */
export function formatExcludedProjectTenantsMarkdown(
  rows: ExcludedProjectTenantRow[],
  options?: { periodCode?: string },
): string {
  if (rows.length === 0) return ''

  const lines: string[] = []
  if (options?.periodCode) {
    lines.push(`# 已排除的项目关联租户（账期 ${options.periodCode}）`, '')
  } else {
    lines.push('# 已排除的项目关联租户', '')
  }
  lines.push('| 平台租户ID | 关联项目 |')
  lines.push('| --- | --- |')
  for (const row of rows) {
    const projects = row.project_names.join('、') || '—'
    lines.push(`| ${row.platform_tenant_id} | ${projects} |`)
  }
  return lines.join('\n')
}

export function downloadExcludedProjectTenantsExcel(params: {
  rows: ExcludedProjectTenantRow[]
  periodCode: string
}): boolean {
  const { rows, periodCode } = params
  if (rows.length === 0) return false

  const headers = ['平台租户ID', '关联项目']
  const wsData: (string | number)[][] = [
    headers,
    ...rows.map((row) => [row.platform_tenant_id, row.project_names.join('、')]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = HEADER_STYLE
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '已排除租户')
  XLSX.writeFile(wb, `已排除项目关联租户-${periodCode}.xlsx`)
  return true
}
