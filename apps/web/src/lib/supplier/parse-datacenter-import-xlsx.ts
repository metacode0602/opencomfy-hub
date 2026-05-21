import * as XLSX from 'xlsx'

import type { DatacenterImportParsedRow } from '@/lib/types/datacenter-import'
import { DATACENTER_IMPORT_MAX_ROWS } from '@/lib/types/datacenter-import'
import {
  mapDatacenterAuditStatus,
  parseDatacenterDeleted,
  parseImportDate,
  parsePublicIpCount,
} from '@/lib/supplier/datacenter-import-utils'

export const DATACENTER_IMPORT_COLUMN_ALIASES: Record<string, string[]> = {
  ID: ['id', '编号', '机房id'],
  租户ID: ['租户id', '平台租户id', 'tenant_id'],
  名称: ['名称', '机房名称', '数据中心名称'],
  容器实例区域: ['容器实例区域', '容器区域', 'serverless区域', 'serverless_region'],
  裸金属区域: ['裸金属区域', '裸金属区', 'bare_metal_region'],
  描述: ['描述', '备注', '说明'],
  规模: ['规模', '机房规模', 'capacity'],
  公网IP数量: ['公网ip数量', '公网 ip 数量', 'public_ip_count'],
  内网网段: ['内网网段', '内网段', 'private_network', 'cidr'],
  审核状态: ['审核状态', '审批状态'],
  审核备注: ['审核备注', '审批备注'],
  是否删除: ['是否删除', '已删除', 'deleted'],
  创建时间: ['创建时间', '创建日期'],
  最后更新时间: ['最后更新时间', '更新时间', '修改时间'],
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, '').toLowerCase()
}

function buildAliasIndex(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [canonical, aliases] of Object.entries(DATACENTER_IMPORT_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      map.set(normalizeHeader(alias), canonical)
    }
    map.set(normalizeHeader(canonical), canonical)
  }
  return map
}

const ALIAS_INDEX = buildAliasIndex()

function pickCell(row: Record<string, unknown>, canonical: string): string | null {
  for (const alias of DATACENTER_IMPORT_COLUMN_ALIASES[canonical] ?? [canonical]) {
    const norm = normalizeHeader(alias)
    for (const [key, value] of Object.entries(row)) {
      if (normalizeHeader(key) !== norm) continue
      if (value == null || String(value).trim() === '') return null
      return String(value).trim()
    }
  }
  return null
}

function rowToRecord(headers: string[], values: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  headers.forEach((h, i) => {
    out[h] = values[i] ?? null
  })
  return out
}

function normCsvCell(s: string): string {
  return s.replace(/^\ufeff/, '').trim()
}

function splitCsvLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(normCsvCell)
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
      out.push(normCsvCell(cur))
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(normCsvCell(cur))
  return out
}

function parseCsvTextToMatrix(text: string): unknown[][] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const lines = rawLines.filter((l) => normCsvCell(l).length > 0)
  if (lines.length < 2) {
    throw new Error('CSV 至少需要表头行和一行数据')
  }
  return lines.map(splitCsvLine)
}

function parseDatacenterImportMatrix(
  matrix: unknown[][],
): { rows: DatacenterImportParsedRow[]; originalHeaders: string[] } {
  if (matrix.length < 2) throw new Error('文件至少需要表头行和一行数据')

  const headerRow = matrix[0] ?? []
  const originalHeaders = headerRow.map((h) => String(h ?? '').trim())
  const columnCanonical = originalHeaders.map((h) => ALIAS_INDEX.get(normalizeHeader(h)) ?? null)

  const dataRows = matrix.slice(1)
  if (dataRows.length > DATACENTER_IMPORT_MAX_ROWS) {
    throw new Error(`单次导入不能超过 ${DATACENTER_IMPORT_MAX_ROWS} 行`)
  }

  const parsed: DatacenterImportParsedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const rowNo = i + 2
    const values = dataRows[i] ?? []
    const record = rowToRecord(originalHeaders, values)

    const canonicalRecord: Record<string, unknown> = {}
    columnCanonical.forEach((canonical, colIdx) => {
      if (!canonical) return
      canonicalRecord[canonical] = values[colIdx] ?? null
    })

    const name = pickCell(canonicalRecord, '名称')
    if (!name) continue

    const field_warnings: string[] = []
    const auditRaw = pickCell(canonicalRecord, '审核状态')
    const auditMapped = mapDatacenterAuditStatus(auditRaw)
    if (auditRaw && auditMapped.warning) field_warnings.push(auditMapped.warning)

    const publicIpRaw = pickCell(canonicalRecord, '公网IP数量')
    const publicIpParsed = parsePublicIpCount(publicIpRaw)
    if (publicIpRaw && publicIpParsed.error) {
      parsed.push({
        row_no: rowNo,
        name,
        external_onboarding_id: pickCell(canonicalRecord, 'ID') ?? undefined,
        field_warnings: [publicIpParsed.error],
        public_ip_count: undefined,
      })
      continue
    }
    if (publicIpParsed.warning) field_warnings.push(publicIpParsed.warning)

    const cidr = pickCell(canonicalRecord, '内网网段')
    if (cidr && !/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(cidr)) {
      field_warnings.push('内网网段格式可疑')
    }

    parsed.push({
      row_no: rowNo,
      external_onboarding_id: pickCell(canonicalRecord, 'ID') ?? undefined,
      platform_tenant_id: pickCell(canonicalRecord, '租户ID') ?? undefined,
      name,
      container_instance_region: pickCell(canonicalRecord, '容器实例区域') ?? undefined,
      bare_metal_region: pickCell(canonicalRecord, '裸金属区域') ?? undefined,
      description: pickCell(canonicalRecord, '描述') ?? undefined,
      scale: pickCell(canonicalRecord, '规模') ?? undefined,
      public_ip_count: publicIpParsed.value,
      internal_network_cidr: cidr ?? undefined,
      audit_status_raw: auditRaw ?? undefined,
      audit_status: auditMapped.audit_status,
      audit_remark: pickCell(canonicalRecord, '审核备注') ?? undefined,
      source_deleted: parseDatacenterDeleted(pickCell(canonicalRecord, '是否删除')),
      status: auditMapped.status,
      source_created_at: parseImportDate(record, '创建时间') ?? undefined,
      source_updated_at: parseImportDate(record, '最后更新时间') ?? undefined,
      field_warnings,
    })
  }

  return { rows: parsed, originalHeaders }
}

function isCsvImportFileName(fileName: string): boolean {
  const name = fileName.toLowerCase()
  return name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')
}

export function parseDatacenterImportFile(
  buffer: ArrayBuffer,
  fileName: string,
): { rows: DatacenterImportParsedRow[]; originalHeaders: string[] } {
  if (isCsvImportFileName(fileName)) {
    const text = new TextDecoder('utf-8').decode(buffer)
    const matrix = parseCsvTextToMatrix(text)
    return parseDatacenterImportMatrix(matrix)
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch (e) {
    throw new Error(`无法解析文件 ${fileName}：${e instanceof Error ? e.message : '格式错误'}`)
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 无有效工作表')

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Excel 工作表为空')

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  return parseDatacenterImportMatrix(matrix)
}
