import * as XLSX from 'xlsx'

import {
  OPPORTUNITY_SOURCE_LABELS,
  type OpportunitySource,
} from '@/lib/crm/commission-constants'
import { mapOpportunitySourceLabel, parseImportDate } from '@/lib/crm/project-import-utils'
import { todayShanghaiDateString } from '@/lib/crm/project-effective-dates'
import type {
  OpportunityImportField,
  OpportunityImportParseResult,
  OpportunityImportParsedRow,
  OpportunityImportPreviewRow,
} from '@/lib/types/opportunity-import'

export const OPPORTUNITY_IMPORT_MAX_ROWS = 500
export const OPPORTUNITY_IMPORT_MAX_BYTES = 10 * 1024 * 1024

const REQUIRED_HEADERS: OpportunityImportField[] = ['项目名称', '租户ID']

/** 白名单标准表头 → 别名（normalize 后匹配） */
export const OPPORTUNITY_IMPORT_COLUMN_ALIASES: Record<OpportunityImportField, string[]> = {
  项目名称: ['项目名称', '项目名', 'projectname'],
  租户ID: ['租户id', '租户 id', '平台租户id', 'tenant_id', 'tenant_tid'],
  业务线: ['业务线', '产品线', 'businessline'],
  商机来源: ['商机来源', '来源', 'opportunity_source'],
  销售: ['销售', '客户经理', 'am', 'account_manager'],
  交付: ['交付', '交付经理', 'delivery'],
  项目经理: ['项目经理', 'pm', '客成', '客成/项目经理', 'project_manager'],
  售前: ['售前', '售前经理', 'pre_sales'],
  创建时间: ['创建时间', 'created_at', 'createdat'],
}

const WHITELIST_CANONICAL = new Set<string>(Object.keys(OPPORTUNITY_IMPORT_COLUMN_ALIASES))

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, '').toLowerCase()
}

function buildAliasIndex(): Map<string, OpportunityImportField> {
  const map = new Map<string, OpportunityImportField>()
  for (const [canonical, aliases] of Object.entries(OPPORTUNITY_IMPORT_COLUMN_ALIASES)) {
    const field = canonical as OpportunityImportField
    for (const alias of aliases) {
      map.set(normalizeHeader(alias), field)
    }
    map.set(normalizeHeader(canonical), field)
  }
  return map
}

const ALIAS_INDEX = buildAliasIndex()

export function normalizeOpportunityImportHeader(header: string): OpportunityImportField | null {
  const canonical = ALIAS_INDEX.get(normalizeHeader(header))
  if (!canonical || !WHITELIST_CANONICAL.has(canonical)) return null
  return canonical
}

export function pickOpportunityCell(
  row: Record<string, string | number | null>,
  canonical: OpportunityImportField,
): string | null {
  for (const alias of OPPORTUNITY_IMPORT_COLUMN_ALIASES[canonical] ?? [canonical]) {
    const norm = normalizeHeader(alias)
    for (const [key, value] of Object.entries(row)) {
      if (normalizeHeader(key) !== norm) continue
      if (value == null || String(value).trim() === '') return null
      return String(value).trim()
    }
  }
  const direct = row[canonical]
  if (direct == null || String(direct).trim() === '') return null
  return String(direct).trim()
}

const SHORT_OPPORTUNITY_SOURCE: Record<string, OpportunitySource> = {
  市场: 'marketing_sales',
  销售: 'sales_self',
  高管: 'exec_sales',
}

function normalizeOpportunitySourceKey(value: string): string {
  return value.trim().replace(/\s+/g, '').replace(/＋/g, '+').toLowerCase()
}

export function mapOpportunityImportSource(value: string | null): {
  source: OpportunitySource | null
  label: string
} {
  const raw = (value ?? '').trim()
  if (!raw) return { source: null, label: '（空）' }

  const shortKey = normalizeOpportunitySourceKey(raw)
  const fromShort = SHORT_OPPORTUNITY_SOURCE[shortKey]
  if (fromShort) {
    return { source: fromShort, label: OPPORTUNITY_SOURCE_LABELS[fromShort] }
  }

  return mapOpportunitySourceLabel(value)
}

/** 行级默认生效日：优先 Excel「创建时间」，否则今天 */
export function resolveOpportunityEffectiveFrom(raw: Record<string, string | number | null>): {
  effectiveFrom: string
  warning?: string
} {
  const createdRaw = pickOpportunityCell(raw, '创建时间')
  if (createdRaw) {
    const parsed = parseImportDate(createdRaw)
    if (parsed) return { effectiveFrom: parsed }
    return {
      effectiveFrom: todayShanghaiDateString(),
      warning: `创建时间「${createdRaw}」无法解析，生效日已用今天`,
    }
  }
  return {
    effectiveFrom: todayShanghaiDateString(),
    warning: '创建时间为空，生效日已用今天',
  }
}

function cellValue(v: unknown): string | number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return v
  return String(v).trim()
}

function parseWorkbookMatrix(
  buffer: ArrayBuffer,
  fileName: string,
): {
  matrix: unknown[][]
  originalHeaders: string[]
  columnCanonicalByIndex: (string | null)[]
  matchedColumns: Partial<Record<OpportunityImportField, string>>
  ignoredColumnNames: string[]
  duplicateColumnWarnings: string[]
} {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch (e) {
    throw new Error(`无法解析文件 ${fileName}：${e instanceof Error ? e.message : '格式错误'}`)
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('Excel 无有效工作表')
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error('Excel 工作表为空')
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][]

  if (matrix.length < 2) {
    throw new Error('Excel 至少需要表头与一行数据')
  }

  const headerRow = matrix[0] as unknown[]
  const originalHeaders = headerRow.map((c) => String(c ?? '').trim())
  const columnCanonicalByIndex: (string | null)[] = []
  const matchedColumns: Partial<Record<OpportunityImportField, string>> = {}
  const ignoredColumnNames: string[] = []
  const duplicateColumnWarnings: string[] = []
  const seenCanonical = new Set<string>()

  headerRow.forEach((c, colIdx) => {
    const headerText = String(c ?? '').trim()
    const canonical = normalizeOpportunityImportHeader(headerText)
    if (!canonical) {
      if (headerText) ignoredColumnNames.push(headerText)
      else ignoredColumnNames.push(`列${colIdx + 1}`)
      columnCanonicalByIndex[colIdx] = null
      return
    }
    if (seenCanonical.has(canonical)) {
      duplicateColumnWarnings.push(`表头「${headerText}」与前列重复（字段：${canonical}），已忽略`)
      columnCanonicalByIndex[colIdx] = null
      return
    }
    seenCanonical.add(canonical)
    matchedColumns[canonical] = headerText
    columnCanonicalByIndex[colIdx] = canonical
  })

  return {
    matrix,
    originalHeaders,
    columnCanonicalByIndex,
    matchedColumns,
    ignoredColumnNames,
    duplicateColumnWarnings,
  }
}

export function detectMissingOpportunityRequiredHeaders(buffer: ArrayBuffer): OpportunityImportField[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  if (!sheet) return [...REQUIRED_HEADERS]

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]
  const headerRow = (matrix[0] ?? []) as unknown[]
  const found = new Set(
    headerRow
      .map((c) => normalizeOpportunityImportHeader(String(c ?? '')))
      .filter(Boolean) as OpportunityImportField[],
  )

  return REQUIRED_HEADERS.filter((h) => !found.has(h))
}

export function parseOpportunityImportWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): OpportunityImportParseResult {
  const {
    matrix,
    originalHeaders,
    columnCanonicalByIndex,
    matchedColumns,
    ignoredColumnNames,
    duplicateColumnWarnings,
  } = parseWorkbookMatrix(buffer, fileName)

  const rows: OpportunityImportParsedRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i] as unknown[]
    if (!values || values.every((c) => c == null || String(c).trim() === '')) continue

    const raw: Record<string, string | number | null> = {}
    columnCanonicalByIndex.forEach((canonical, colIdx) => {
      const v = cellValue(values[colIdx])
      if (!canonical) return
      raw[canonical] = v
    })

    rows.push({ rowIndex: i + 1, raw })
  }

  if (rows.length === 0) {
    throw new Error('未找到有效数据行')
  }
  if (rows.length > OPPORTUNITY_IMPORT_MAX_ROWS) {
    throw new Error(`单次最多导入 ${OPPORTUNITY_IMPORT_MAX_ROWS} 行，当前 ${rows.length} 行`)
  }

  return {
    rows,
    originalHeaders,
    columnCanonicalByIndex,
    matchedColumns,
    ignoredColumnNames,
    duplicateColumnWarnings,
  }
}

export function parseOpportunityImportBuffer(buffer: Buffer, fileName: string): OpportunityImportParseResult {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
  return parseOpportunityImportWorkbook(arrayBuffer, fileName)
}

function newPreviewToken() {
  return `opp-preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function buildOpportunityImportPreviewResult(
  fileName: string,
  rows: OpportunityImportPreviewRow[],
  matchedColumns: Partial<Record<OpportunityImportField, string>>,
  ignoredColumnNames: string[],
  duplicateRowKeys: boolean,
): {
  previewToken: string
  fileName: string
  rows: OpportunityImportPreviewRow[]
  summary: { total: number; ok: number; error: number; warn: number }
  ignoredColumnNames: string[]
  ignoredColumnCount: number
  matchedColumns: Partial<Record<OpportunityImportField, string>>
  duplicateRowKeys: boolean
} {
  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.selectable).length,
    error: rows.filter((r) => r.action === 'error').length,
    warn: rows.filter((r) => r.warnings.length > 0).length,
  }

  return {
    previewToken: newPreviewToken(),
    fileName,
    rows,
    summary,
    ignoredColumnNames,
    ignoredColumnCount: ignoredColumnNames.length,
    matchedColumns,
    duplicateRowKeys,
  }
}
