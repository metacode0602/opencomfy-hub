/**
 * 设备下架 Excel 导入 — 样例数据（Mock / 手工测试用）
 * 表头：设备ID、设备标识、外网IP、内网IP
 */
import { DEVICE_RETIRE_EXCEL_HEADERS } from '@/lib/types/device-retire'

/** 华北-北京 DC1 — 含 2 行有效 + 1 行不存在设备 */
export const DEVICE_RETIRE_SAMPLE_BJ_ROWS: string[][] = [
  ['EXT-7C11AA01', 'AST-HB-00092', '203.0.113.11', '10.20.30.41'],
  ['', 'AST-HB-00091', '203.0.113.10', '10.20.30.40'],
  ['NOT-FOUND-999', 'AST-UNKNOWN', '203.0.113.99', '10.99.99.99'],
]

/** 华北-上海 DC2 — 含 1 行有效 + 1 行跨机房误填 */
export const DEVICE_RETIRE_SAMPLE_SH_ROWS: string[][] = [
  ['EXT-SH-001', 'AST-HB-SH-001', '203.0.113.30', '10.30.10.10'],
  ['EXT-7C11AA01', 'AST-HB-00092', '203.0.113.11', '10.20.30.41'],
]

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function buildDeviceRetireSampleCsv(rows: string[][]): string {
  const lines = [
    DEVICE_RETIRE_EXCEL_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ]
  return lines.join('\n')
}

export const DEVICE_RETIRE_SAMPLE_BJ_CSV = buildDeviceRetireSampleCsv(DEVICE_RETIRE_SAMPLE_BJ_ROWS)
export const DEVICE_RETIRE_SAMPLE_SH_CSV = buildDeviceRetireSampleCsv(DEVICE_RETIRE_SAMPLE_SH_ROWS)

export function downloadDeviceRetireSampleCsv(fileName: string, csvContent: string) {
  const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
