import { DATACENTER_RETIRE_LIST_HEADERS } from '@/lib/types/datacenter-device-retire'

/** 与计划 A100×2 + H800×1 对齐的样例行 */
export const DATACENTER_RETIRE_LIST_SAMPLE_ROWS: string[][] = [
  ['A100 80G', '闲时合作', '203.0.113.11:8080', '10.20.30.41', 'EXT-001', 'AST-001'],
  ['A100 80G', '闲时合作', '203.0.113.12', '', 'EXT-002', ''],
  ['H800', '整租合作', '', '10.30.10.10', '', 'AST-H800-01'],
]

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function buildDatacenterRetireListSampleCsv(rows: string[][] = DATACENTER_RETIRE_LIST_SAMPLE_ROWS): string {
  const lines = [
    DATACENTER_RETIRE_LIST_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ]
  return lines.join('\n')
}

export function downloadDatacenterRetireListSampleCsv(fileName = '下架清单-样例.csv') {
  const blob = new Blob(['\ufeff', buildDatacenterRetireListSampleCsv()], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
