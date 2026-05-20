import * as XLSX from 'xlsx'

import type {
  ProjectImportParseResult,
  ProjectImportParsedRow,
  ProjectImportPreviewRow,
  ProjectImportPreviewResult,
  ProjectImportStage,
  ProjectImportStatus,
} from '@/lib/types/project-import'

export const PROJECT_IMPORT_MAX_ROWS = 500
export const PROJECT_IMPORT_MAX_BYTES = 10 * 1024 * 1024

const REQUIRED_HEADERS = ['项目名称'] as const

/** 标准表头 → 别名列表（normalize 后匹配） */
export const PROJECT_IMPORT_COLUMN_ALIASES: Record<string, string[]> = {
  项目名称: ['项目名称', '项目名', 'projectname'],
  标签: ['标签'],
  租户ID: ['租户id', '平台租户id', 'tenant_id'],
  业务线: ['业务线'],
  描述: ['描述'],
  客户经理: ['客户经理'],
  交付: ['交付'],
  '客成/项目经理': ['客成/项目经理', '项目经理', 'pm', '客成'],
  售前: ['售前'],
  关注人: ['关注人'],
  '所属渠道/生态': ['所属渠道/生态', '渠道', '生态'],
  算力规模: ['算力规模'],
  阶段: ['阶段'],
  健康状态: ['健康状态'],
  进展更新: ['进展更新'],
  下一步计划: ['下一步计划'],
  客群分布: ['客群分布'],
  开始测试日期: ['开始测试日期', '测试开始日期'],
  试用完成日期: ['试用完成日期', '测试完成日期'],
  转正式日期: ['转正式日期', '转正日期', 'conversion_date'],
  '余额+裸金属消费': ['余额+裸金属消费'],
  总消费: ['总消费'],
  余额消费: ['余额消费'],
  券消费: ['券消费'],
  补充消费: ['补充消费'],
  创建时间: ['创建时间'],
  最后更新时间: ['最后更新时间'],
  父记录: ['父记录'],
  创建人: ['创建人'],
  客户全称: ['客户全称', '客户名称', '公司全称'],
  项目问题与需求: ['项目问题与需求'],
  线上裸金属消费: ['线上裸金属消费'],
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, '').toLowerCase()
}

function buildAliasIndex(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [canonical, aliases] of Object.entries(PROJECT_IMPORT_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      map.set(normalizeHeader(alias), canonical)
    }
    map.set(normalizeHeader(canonical), canonical)
  }
  return map
}

const ALIAS_INDEX = buildAliasIndex()

export function normalizeProjectImportHeader(header: string): string | null {
  return ALIAS_INDEX.get(normalizeHeader(header)) ?? null
}

export function pickImportCell(
  row: Record<string, string | number | null>,
  canonical: string,
): string | null {
  for (const alias of PROJECT_IMPORT_COLUMN_ALIASES[canonical] ?? [canonical]) {
    const norm = normalizeHeader(alias)
    for (const [key, value] of Object.entries(row)) {
      if (normalizeHeader(key) !== norm) continue
      if (value == null || String(value).trim() === '') return null
      return String(value).trim()
    }
  }
  return null
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
  const columnCanonicalByIndex = headerRow.map((c) =>
    normalizeProjectImportHeader(String(c ?? '')),
  )

  return { matrix, originalHeaders, columnCanonicalByIndex }
}

export function parseProjectImportWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): ProjectImportParseResult {
  const { matrix, originalHeaders, columnCanonicalByIndex } = parseWorkbookMatrix(buffer, fileName)

  const rows: ProjectImportParsedRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i] as unknown[]
    if (!values || values.every((c) => c == null || String(c).trim() === '')) continue

    const raw: Record<string, string | number | null> = {}
    const originalCells: (string | number | null)[] = []
    columnCanonicalByIndex.forEach((canonical, colIdx) => {
      const v = cellValue(values[colIdx])
      originalCells[colIdx] = v
      if (!canonical) return
      raw[canonical] = v
    })

    rows.push({ rowIndex: i + 1, raw, originalCells })
  }

  if (rows.length === 0) {
    throw new Error('未找到有效数据行')
  }
  if (rows.length > PROJECT_IMPORT_MAX_ROWS) {
    throw new Error(`单次最多导入 ${PROJECT_IMPORT_MAX_ROWS} 行，当前 ${rows.length} 行`)
  }

  return { rows, originalHeaders, columnCanonicalByIndex }
}

export function parseProjectImportBuffer(buffer: Buffer, fileName: string): ProjectImportParseResult {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
  return parseProjectImportWorkbook(arrayBuffer, fileName)
}

export function detectMissingRequiredHeaders(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  if (!sheet) return [...REQUIRED_HEADERS]

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]
  const headerRow = (matrix[0] ?? []) as unknown[]
  const found = new Set(
    headerRow
      .map((c) => normalizeProjectImportHeader(String(c ?? '')))
      .filter(Boolean) as string[],
  )

  return REQUIRED_HEADERS.filter((h) => !found.has(h))
}

export function mapStageLabel(value: string | null): { stage: ProjectImportStage; label: string } {
  const v = (value ?? '').trim()
  if (!v) return { stage: 'lead', label: '（空→线索）' }

  const lower = v.toLowerCase()
  if (/线索|商机|公海|lead/.test(v)) return { stage: 'lead', label: `${v}→线索` }
  if (/测试|试用|poc|testing/.test(lower)) return { stage: 'testing', label: `${v}→测试` }
  if (/生产|运营|转正|正式|converted|运营中/.test(v)) return { stage: 'converted', label: `${v}→已转正` }

  return { stage: 'lead', label: `${v}→线索（未识别）` }
}

export function mapStatusLabel(value: string | null): { status: ProjectImportStatus; label: string } {
  const v = (value ?? '').trim()
  if (!v) return { status: 'active', label: '（空→活跃）' }

  const lower = v.toLowerCase()
  if (/pending|正常|active|进行中|活跃/.test(lower)) return { status: 'active', label: `${v}→活跃` }
  if (/暂停|paused|挂起/.test(v)) return { status: 'paused', label: `${v}→暂停` }
  if (/完成|结项|completed/.test(v)) return { status: 'completed', label: `${v}→完成` }

  return { status: 'active', label: `${v}→活跃（未识别）` }
}

export function splitTags(value: string | null): string[] {
  if (!value?.trim()) return []
  return [...new Set(value.split(/[,，、]/).map((t) => t.trim()).filter(Boolean))]
}

export function sanitizeDescription(value: string | null): string | undefined {
  if (!value?.trim()) return undefined
  return value.replace(/<br\s*\/?>/gi, '\n').trim()
}

export function parseImportDate(value: string | number | null): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && value > 30000 && value < 60000) {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      const y = date.y
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  const s = String(value).trim()
  const m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`
  }
  return null
}

export function resolveImportStartDate(raw: Record<string, string | number | null>): string {
  return (
    parseImportDate(pickImportCell(raw, '开始测试日期')) ??
    parseImportDate(pickImportCell(raw, '创建时间')) ??
    new Date().toISOString().slice(0, 10)
  )
}

export function errorFieldsToColumnIndexes(
  errorFields: string[],
  columnCanonicalByIndex: (string | null)[],
): number[] {
  const indexes = new Set<number>()
  for (const field of errorFields) {
    columnCanonicalByIndex.forEach((canonical, idx) => {
      if (canonical === field) indexes.add(idx)
    })
  }
  return [...indexes].sort((a, b) => a - b)
}

function newPreviewToken() {
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type PreviewEnrichResult = {
  warnings: string[]
  errors: string[]
  errorFields: string[]
  selectable: boolean
  action: ProjectImportPreviewRow['action']
  customerStrategy: ProjectImportPreviewRow['customerStrategy']
  customerPreview: ProjectImportPreviewRow['customerPreview']
  tenantPreview?: ProjectImportPreviewRow['tenantPreview']
  staffPreview: ProjectImportPreviewRow['staffPreview']
  existingProjectId?: string
  mapped?: Partial<ProjectImportPreviewRow['mapped']>
}

export function buildPreviewRowsFromParsed(
  parsed: ProjectImportParsedRow[],
  columnCanonicalByIndex: (string | null)[],
  enrich: (
    row: ProjectImportParsedRow,
    draft: Omit<
      ProjectImportPreviewRow,
      'warnings' | 'errors' | 'errorFields' | 'errorColumnIndexes' | 'selectable'
    >,
  ) => PreviewEnrichResult,
): ProjectImportPreviewRow[] {
  return parsed.map((item) => {
    const projectName = pickImportCell(item.raw, '项目名称') ?? ''
    const stageInfo = mapStageLabel(pickImportCell(item.raw, '阶段'))
    const statusInfo = mapStatusLabel(pickImportCell(item.raw, '健康状态'))

    const draft = {
      rowIndex: item.rowIndex,
      projectName,
      platformTenantId: pickImportCell(item.raw, '租户ID') ?? undefined,
      customerStrategy: 'create_customer' as const,
      customerPreview: {
        name: pickImportCell(item.raw, '客户全称') ?? projectName,
        shortName: projectName,
      },
      tags: splitTags(pickImportCell(item.raw, '标签')),
      staffPreview: {},
      mapped: {
        stage: stageInfo.stage,
        stageLabel: stageInfo.label,
        status: statusInfo.status,
        statusLabel: statusInfo.label,
        businessLineName: pickImportCell(item.raw, '业务线') ?? '（默认：交付型项目）',
        description: sanitizeDescription(pickImportCell(item.raw, '描述')),
        computeScale: pickImportCell(item.raw, '算力规模') ?? undefined,
        progressUpdate: pickImportCell(item.raw, '进展更新') ?? undefined,
        nextPlan: pickImportCell(item.raw, '下一步计划') ?? undefined,
        issuesRequirements: pickImportCell(item.raw, '项目问题与需求') ?? undefined,
        creatorName: pickImportCell(item.raw, '创建人') ?? undefined,
        startDate: resolveImportStartDate(item.raw),
      },
      financePreview: {
        totalConsumption: pickImportCell(item.raw, '总消费') ?? undefined,
        balanceConsumption: pickImportCell(item.raw, '余额消费') ?? undefined,
        bareMetalConsumption: pickImportCell(item.raw, '线上裸金属消费') ?? undefined,
      },
      action: 'create' as const,
    }

    const extra = enrich(item, draft)

    const warnings = [...extra.warnings]
    const errors = [...extra.errors]
    const errorFields = [...extra.errorFields]

    if (!projectName.trim()) {
      errors.push('项目名称为空')
      if (!errorFields.includes('项目名称')) errorFields.push('项目名称')
    }
    if (pickImportCell(item.raw, '父记录')) {
      warnings.push('父记录暂不支持层级导入')
    }
    if (pickImportCell(item.raw, '关注人')) {
      warnings.push('关注人暂不入库，仅预览展示')
    }

    return {
      ...draft,
      ...extra,
      mapped: { ...draft.mapped, ...extra.mapped },
      warnings,
      errors,
      errorFields,
      errorColumnIndexes: errorFieldsToColumnIndexes(errorFields, columnCanonicalByIndex),
      selectable: extra.selectable && errors.length === 0,
    }
  })
}

export function summarizePreviewRows(rows: ProjectImportPreviewRow[]): ProjectImportPreviewResult['summary'] {
  return {
    total: rows.length,
    ok: rows.filter((r) => r.errors.length === 0).length,
    error: rows.filter((r) => r.errors.length > 0).length,
    warn: rows.filter((r) => r.warnings.length > 0).length,
    create: rows.filter((r) => r.action === 'create' && r.selectable).length,
    update: rows.filter((r) => r.action === 'update' && r.selectable).length,
    skip: rows.filter((r) => r.action === 'skip' || !r.selectable).length,
  }
}

export function buildProjectImportPreviewResult(
  fileName: string,
  rows: ProjectImportPreviewRow[],
  originalHeaders: string[],
  missingRequiredHeaders: string[],
  parsedSnapshot: ProjectImportPreviewResult['parsedSnapshot'],
): ProjectImportPreviewResult {
  return {
    previewToken: newPreviewToken(),
    fileName,
    rows,
    originalHeaders,
    parsedSnapshot,
    summary: summarizePreviewRows(rows),
    missingRequiredHeaders,
  }
}
