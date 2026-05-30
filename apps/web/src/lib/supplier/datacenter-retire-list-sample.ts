import {
  DATACENTER_RETIRE_LIST_HEADERS,
  type DatacenterRetireListSampleRow,
} from '@/lib/types/datacenter-device-retire'

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function buildDatacenterRetireListSampleCsv(rows: DatacenterRetireListSampleRow[]): string {
  const lines = [
    DATACENTER_RETIRE_LIST_HEADERS.join(','),
    ...rows.map((row) =>
      [
        row.gpuCardTypeName,
        row.cooperationType,
        row.externalIp,
        row.internalIp,
        row.externalDeviceId,
        row.assetNo,
      ]
        .map(escapeCsvCell)
        .join(','),
    ),
  ]
  return lines.join('\n')
}

export function downloadDatacenterRetireListSampleCsv(
  fileName: string,
  rows: DatacenterRetireListSampleRow[],
) {
  const csvContent = buildDatacenterRetireListSampleCsv(rows)
  const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
