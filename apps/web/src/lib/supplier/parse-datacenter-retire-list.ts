import { DATACENTER_RETIRE_LIST_HEADERS } from '@/lib/types/datacenter-device-retire'

function normCell(s: string): string {
  return s.replace(/^\ufeff/, '').trim()
}

function normHeader(s: string): string {
  return normCell(s).replace(/\s+/g, '').toLowerCase()
}

function splitCsvLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(normCell)
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
      continue
    }
    if (!inQ && ch === ',') {
      out.push(normCell(cur))
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(normCell(cur))
  return out
}

function pickIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i] ?? '')
    if (aliases.some((a) => normHeader(a) === h)) return i
  }
  return -1
}

export type ParsedDatacenterRetireListRow = {
  rowNo: number
  gpuCardTypeRaw: string
  cooperationTypeRaw: string
  externalIp: string | null
  internalIp: string | null
  externalDeviceId: string | null
  assetNo: string | null
  originalCells: string[]
}

export function parseDatacenterRetireListMatrix(matrix: unknown[][]): {
  rows: ParsedDatacenterRetireListRow[]
  originalHeaders: string[]
} {
  if (matrix.length < 2) {
    throw new Error('文件至少需要表头一行与一行数据')
  }

  const headers = (matrix[0] ?? []).map((h) => normCell(String(h ?? '')))
  const originalHeaders =
    headers.filter(Boolean).length > 0 ? headers : [...DATACENTER_RETIRE_LIST_HEADERS]

  const iCard = pickIndex(originalHeaders, ['卡型', 'gpu_card_type', 'card_type'])
  const iCoop = pickIndex(originalHeaders, ['合作类型', 'cooperation_type', '合作模式'])
  const iExtIp = pickIndex(originalHeaders, ['外网ip', '外网IP', '公网ip', 'external_ip'])
  const iIntIp = pickIndex(originalHeaders, ['内网ip', '内网IP', 'internal_ip'])
  const iDeviceId = pickIndex(originalHeaders, ['设备id', '设备ID', 'external_device_id'])
  const iAsset = pickIndex(originalHeaders, ['设备标识', 'asset_no', 'sn'])

  if (iCard === -1) {
    throw new Error(`未识别到卡型列，请包含「${DATACENTER_RETIRE_LIST_HEADERS[0]}」`)
  }
  if (iCoop === -1) {
    throw new Error(`未识别到合作类型列，请包含「${DATACENTER_RETIRE_LIST_HEADERS[1]}」`)
  }
  if (iExtIp === -1 && iIntIp === -1) {
    throw new Error('请至少包含外网IP或内网IP列')
  }

  const dataRows = matrix.slice(1).filter((row) => {
    const cells = row as unknown[]
    return cells.some((c) => normCell(String(c ?? '')).length > 0)
  })

  if (dataRows.length === 0) {
    throw new Error('文件无有效数据行')
  }

  const cellAt = (row: unknown[], idx: number) => (idx === -1 ? '' : normCell(String(row[idx] ?? '')))

  const rows = dataRows.map((raw, idx) => {
    const row = raw as unknown[]
    return {
      rowNo: idx + 2,
      gpuCardTypeRaw: cellAt(row, iCard),
      cooperationTypeRaw: cellAt(row, iCoop),
      externalIp: cellAt(row, iExtIp) || null,
      internalIp: cellAt(row, iIntIp) || null,
      externalDeviceId: cellAt(row, iDeviceId) || null,
      assetNo: cellAt(row, iAsset) || null,
      originalCells: originalHeaders.map((_, colIdx) => cellAt(row, colIdx)),
    }
  })

  return { rows, originalHeaders }
}

export function parseDatacenterRetireListText(csvText: string): {
  rows: ParsedDatacenterRetireListRow[]
  originalHeaders: string[]
} {
  const rawLines = csvText.split(/\r?\n/).map((l) => l.trimEnd())
  const lines = rawLines.filter((l) => normCell(l).length > 0)
  const matrix = lines.map(splitCsvLine)
  return parseDatacenterRetireListMatrix(matrix)
}
