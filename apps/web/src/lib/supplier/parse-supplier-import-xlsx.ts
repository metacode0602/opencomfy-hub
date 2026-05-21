import * as XLSX from 'xlsx'

import type { SupplierImportParsedRow } from '@/lib/types/supplier-import'
import { SUPPLIER_IMPORT_MAX_ROWS } from '@/lib/types/supplier-import'
import {
  isHttpUrl,
  mapAuditStatus,
  mapCooperationMode,
  mapOnboardingType,
  parseAuditConfirmed,
  parseImportDate,
} from './supplier-import-utils'

export const SUPPLIER_IMPORT_COLUMN_ALIASES: Record<string, string[]> = {
  ID: ['id', '编号', '入驻id'],
  租户ID: ['租户id', '平台租户id', 'tenant_id'],
  入驻类型: ['入驻类型', '类型', '主体类型', 'onboardingtype'],
  '企业全称/真实姓名': ['企业全称/真实姓名', '企业全称', '真实姓名', '名称', '供应商名称'],
  '统一社会信用代码/身份证号码': [
    '统一社会信用代码/身份证号码',
    '统一社会信用代码',
    '身份证号码',
    '证件号',
    'uscc',
  ],
  经营范围: ['经营范围'],
  '企业地址/地址': ['企业地址/地址', '企业地址', '地址'],
  联系人: ['联系人'],
  联系人电话: ['联系人电话', '联系电话'],
  营业执照: ['营业执照'],
  '法人身份证正面/身份证正面': ['法人身份证正面/身份证正面', '身份证正面', '法人身份证正面'],
  '法人身份证反面/身份证反面': ['法人身份证反面/身份证反面', '身份证反面', '法人身份证反面'],
  银行名称: ['银行名称'],
  开户行名称: ['开户行名称'],
  银行账号: ['银行账号'],
  开户行地址: ['开户行地址'],
  管理员手机号: ['管理员手机号'],
  管理员邮箱: ['管理员邮箱'],
  设备信息: ['设备信息'],
  审核状态: ['审核状态'],
  审核状态是否已确认: ['审核状态是否已确认', '审核已确认', '状态已确认'],
  合作模式: ['合作模式'],
  审核备注: ['审核备注'],
  创建时间: ['创建时间', '创建日期'],
  最后更新时间: ['最后更新时间', '更新时间', '修改时间'],
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, '').toLowerCase()
}

function buildAliasIndex(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [canonical, aliases] of Object.entries(SUPPLIER_IMPORT_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      map.set(normalizeHeader(alias), canonical)
    }
    map.set(normalizeHeader(canonical), canonical)
  }
  return map
}

const ALIAS_INDEX = buildAliasIndex()

function pickCell(row: Record<string, unknown>, canonical: string): string | null {
  const keysToTry = [canonical, ...(SUPPLIER_IMPORT_COLUMN_ALIASES[canonical] ?? [])]
  const seen = new Set<string>()
  for (const key of keysToTry) {
    const norm = normalizeHeader(key)
    if (seen.has(norm)) continue
    seen.add(norm)
    for (const [rowKey, value] of Object.entries(row)) {
      if (normalizeHeader(rowKey) !== norm) continue
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

function formatOriginalCell(v: unknown): string | number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  return String(v).trim()
}

function parseSupplierImportMatrix(matrix: unknown[][]): {
  rows: SupplierImportParsedRow[]
  originalHeaders: string[]
  columnCanonicalByIndex: (string | null)[]
} {
  if (matrix.length < 2) throw new Error('文件至少需要表头行和一行数据')

  const headerRow = matrix[0] ?? []
  const originalHeaders = headerRow.map((h) => String(h ?? '').trim())
  const columnCanonical = originalHeaders.map((h) => ALIAS_INDEX.get(normalizeHeader(h)) ?? null)

  const dataRows = matrix.slice(1)
  if (dataRows.length > SUPPLIER_IMPORT_MAX_ROWS) {
    throw new Error(`单次导入不能超过 ${SUPPLIER_IMPORT_MAX_ROWS} 行`)
  }

  const parsed: SupplierImportParsedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const rowNo = i + 2
    const values = dataRows[i] ?? []
    const originalCells = originalHeaders.map((_, colIdx) =>
      formatOriginalCell(values[colIdx]),
    )
    const record = rowToRecord(originalHeaders, values)

    const canonicalRecord: Record<string, unknown> = {}
    columnCanonical.forEach((canonical, colIdx) => {
      if (!canonical) return
      canonicalRecord[canonical] = values[colIdx] ?? null
    })

    const name = pickCell(canonicalRecord, '企业全称/真实姓名')
    if (!name) continue

    const onboardingRaw = pickCell(canonicalRecord, '入驻类型')
    const onboarding_type = mapOnboardingType(onboardingRaw)
    const field_warnings: string[] = []

    if (!onboarding_type) {
      const hint = onboardingRaw ? `（当前值：「${onboardingRaw}」）` : '（单元格为空）'
      parsed.push({
        row_no: rowNo,
        name,
        originalCells,
        field_warnings: [`入驻类型无法识别${hint}`],
      })
      continue
    }

    const identity_no = pickCell(canonicalRecord, '统一社会信用代码/身份证号码') ?? undefined
    const auditRaw = pickCell(canonicalRecord, '审核状态')
    const auditMapped = mapAuditStatus(auditRaw)
    if (auditRaw && auditMapped.warning) field_warnings.push(auditMapped.warning)

    const coop = mapCooperationMode(pickCell(canonicalRecord, '合作模式'))
    if (coop.warning) field_warnings.push(coop.warning)

    const licenseUri = pickCell(canonicalRecord, '营业执照')
    const idFront = pickCell(canonicalRecord, '法人身份证正面/身份证正面')
    const idBack = pickCell(canonicalRecord, '法人身份证反面/身份证反面')

    if (onboarding_type === 'enterprise' && licenseUri && !isHttpUrl(licenseUri)) {
      field_warnings.push('营业执照非 URL')
    }
    if (idFront && !isHttpUrl(idFront)) field_warnings.push('身份证正面非 URL')
    if (idBack && !isHttpUrl(idBack)) field_warnings.push('身份证反面非 URL')

    const adminEmail = pickCell(canonicalRecord, '管理员邮箱')
    if (!adminEmail) field_warnings.push('管理员邮箱为空')

    parsed.push({
      row_no: rowNo,
      external_onboarding_id: pickCell(canonicalRecord, 'ID') ?? undefined,
      platform_tenant_id: pickCell(canonicalRecord, '租户ID') ?? undefined,
      onboarding_type,
      name,
      identity_no,
      business_scope: pickCell(canonicalRecord, '经营范围') ?? undefined,
      address: pickCell(canonicalRecord, '企业地址/地址') ?? undefined,
      contact_person: pickCell(canonicalRecord, '联系人') ?? undefined,
      contact_phone: pickCell(canonicalRecord, '联系人电话') ?? undefined,
      business_license_uri:
        onboarding_type === 'enterprise' ? (licenseUri ?? undefined) : undefined,
      id_card_front_uri: idFront ?? undefined,
      id_card_back_uri: idBack ?? undefined,
      bank_name: pickCell(canonicalRecord, '银行名称') ?? undefined,
      bank_branch_name: pickCell(canonicalRecord, '开户行名称') ?? undefined,
      bank_account: pickCell(canonicalRecord, '银行账号') ?? undefined,
      bank_branch_address: pickCell(canonicalRecord, '开户行地址') ?? undefined,
      admin_phone: pickCell(canonicalRecord, '管理员手机号') ?? undefined,
      admin_email: adminEmail ?? undefined,
      device_info_raw: pickCell(canonicalRecord, '设备信息') ?? undefined,
      audit_status_raw: auditRaw ?? undefined,
      audit_status: auditMapped.audit_status,
      audit_confirmed: parseAuditConfirmed(pickCell(canonicalRecord, '审核状态是否已确认')),
      audit_remark: pickCell(canonicalRecord, '审核备注') ?? undefined,
      cooperation_mode: coop.mode,
      status: auditMapped.status,
      source_created_at: parseImportDate(record, '创建时间') ?? undefined,
      source_updated_at: parseImportDate(record, '最后更新时间') ?? undefined,
      field_warnings,
      originalCells,
    })
  }

  return { rows: parsed, originalHeaders, columnCanonicalByIndex: columnCanonical }
}

function isCsvImportFileName(fileName: string): boolean {
  const name = fileName.toLowerCase()
  return name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')
}

/** 解析 Excel / CSV 供应商导入文件 */
export function parseSupplierImportFile(
  buffer: ArrayBuffer,
  fileName: string,
): {
  rows: SupplierImportParsedRow[]
  originalHeaders: string[]
  columnCanonicalByIndex: (string | null)[]
} {
  if (isCsvImportFileName(fileName)) {
    const text = new TextDecoder('utf-8').decode(buffer)
    const matrix = parseCsvTextToMatrix(text)
    return parseSupplierImportMatrix(matrix)
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

  return parseSupplierImportMatrix(matrix)
}

/** @deprecated 使用 parseSupplierImportFile */
export function parseSupplierImportWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): {
  rows: SupplierImportParsedRow[]
  originalHeaders: string[]
  columnCanonicalByIndex: (string | null)[]
} {
  return parseSupplierImportFile(buffer, fileName)
}
