import type {
  ProjectImportCommitOptions,
  ProjectImportCommitResult,
  ProjectImportParsedRow,
  ProjectImportPreviewResult,
  ProjectImportPreviewRow,
  ProjectImportStaffRole,
} from '@/lib/types/project-import'

import {
  buildPreviewRowsFromParsed,
  buildProjectImportPreviewResult,
  detectMissingRequiredHeaders,
  parseProjectImportWorkbook,
  pickImportCell,
} from '@/lib/crm/project-import-utils'

/** Mock：本地已存在 platform_tenant_id → tenant/customer */
const MOCK_TENANT_BY_PLATFORM_ID: Record<
  string,
  { tenantId: string; tenantName: string; customerId: string; customerName: string }
> = {
  '16462': {
    tenantId: 'mock-tenant-16462',
    tenantName: 'gjaL23kNjSM',
    customerId: 'mock-cust-1',
    customerName: '北京深智科技有限公司',
  },
}

/** Mock：已存在项目（customerId + projectName） */
const MOCK_EXISTING_PROJECTS: Record<string, { projectId: string; customerId: string }> = {
  'mock-cust-1|几何docker项目': { projectId: 'mock-proj-existing-1', customerId: 'mock-cust-1' },
}

/** Mock：员工姓名 → id */
const MOCK_STAFF_BY_NAME: Record<string, string> = {
  李楠: 'mock-staff-linan',
  高彭: 'mock-staff-gaopeng',
  王五: 'mock-staff-wangwu',
}

const STAFF_COLUMNS: { column: string; role: ProjectImportStaffRole }[] = [
  { column: '售前', role: 'pre_sales' },
  { column: '客户经理', role: 'account_manager' },
  { column: '交付', role: 'delivery_manager' },
  { column: '客成/项目经理', role: 'project_manager' },
]

function normalizeKey(s: string) {
  return s.trim().toLowerCase()
}

function pickCell(row: Record<string, string | number | null>, column: string): string | null {
  return pickImportCell(row, column)
}

function resolveStaffPreview(name: string | null) {
  if (!name) return undefined
  const staffId = MOCK_STAFF_BY_NAME[name]
  return {
    name,
    staffId,
    willCreate: !staffId,
  }
}

function enrichPreviewRow(
  item: ProjectImportParsedRow,
  draft: Omit<
    ProjectImportPreviewRow,
    'warnings' | 'errors' | 'errorFields' | 'errorColumnIndexes' | 'selectable'
  >,
) {
  const warnings: string[] = []
  const errors: string[] = []
  const errorFields: string[] = []
  let selectable = true
  let action: 'create' | 'update' | 'skip' = 'create'
  let customerStrategy = draft.customerStrategy
  let customerPreview = { ...draft.customerPreview }
  let tenantPreview = draft.tenantPreview

  const staffPreview: typeof draft.staffPreview = {}
  for (const { column, role } of STAFF_COLUMNS) {
    const preview = resolveStaffPreview(pickCell(item.raw, column))
    if (preview) staffPreview[role] = preview
  }

  const platformTenantId = pickCell(item.raw, '租户ID')
  if (platformTenantId) {
    const local = MOCK_TENANT_BY_PLATFORM_ID[platformTenantId]
    if (!local) {
      errors.push(`租户 ID ${platformTenantId} 在本地不存在`)
      errorFields.push('租户ID')
      selectable = false
      action = 'skip'
    } else {
      customerStrategy = 'link_tenant'
      customerPreview = {
        id: local.customerId,
        name: local.customerName,
        shortName: local.customerName,
      }
      tenantPreview = {
        id: local.tenantId,
        platformTenantId,
        name: local.tenantName,
      }

      const existKey = `${local.customerId}|${normalizeKey(draft.projectName)}`
      const existing = MOCK_EXISTING_PROJECTS[existKey]
      if (existing) {
        action = 'update'
      }
    }
  } else {
    customerStrategy = 'create_customer'
    const shortKey = normalizeKey(draft.projectName)
    const existingByName = Object.entries(MOCK_EXISTING_PROJECTS).find(([key]) =>
      key.endsWith(`|${shortKey}`),
    )
    if (existingByName) {
      action = 'update'
      warnings.push('将按项目名称匹配更新已有项目（Mock）')
    }
  }

  if (!pickCell(item.raw, '业务线')) {
    warnings.push('业务线为空，将使用默认「交付型项目」')
  }

  return {
    warnings,
    errors,
    errorFields,
    selectable,
    action,
    customerStrategy,
    customerPreview,
    tenantPreview,
    staffPreview,
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function mockPreviewProjectImport(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<ProjectImportPreviewResult> {
  await delay(500)

  const missingRequiredHeaders = detectMissingRequiredHeaders(buffer)
  if (missingRequiredHeaders.length > 0) {
    throw new Error(`缺少必填表头：${missingRequiredHeaders.join('、')}`)
  }

  const parsedResult = parseProjectImportWorkbook(buffer, fileName)
  const rows = buildPreviewRowsFromParsed(
    parsedResult.rows,
    parsedResult.columnCanonicalByIndex,
    enrichPreviewRow,
  )

  return buildProjectImportPreviewResult(
    fileName,
    rows,
    parsedResult.originalHeaders,
    missingRequiredHeaders,
    parsedResult.rows.map((r) => ({
      rowIndex: r.rowIndex,
      originalCells: r.originalCells,
    })),
  )
}

export async function mockCommitProjectImport(
  preview: ProjectImportPreviewResult,
  options: ProjectImportCommitOptions,
): Promise<ProjectImportCommitResult> {
  await delay(700)

  const selected = preview.rows.filter((row) => {
    if (!row.selectable) return false
    if (options.rowIndexes && !options.rowIndexes.includes(row.rowIndex)) return false
    return true
  })

  let createdProjects = 0
  let updatedProjects = 0
  let createdCustomers = 0
  let createdTenants = 0
  let createdStaff = 0
  let skipped = preview.rows.length - selected.length
  const errors: ProjectImportCommitResult['errors'] = []

  const createdStaffNames = new Set<string>()

  for (const row of selected) {
    if (row.errors.length > 0) {
      errors.push({ rowIndex: row.rowIndex, message: row.errors.join('；') })
      skipped++
      continue
    }

    if (row.action === 'update') {
      updatedProjects++
    } else {
      createdProjects++
    }

    if (row.customerStrategy === 'create_customer') {
      createdCustomers++
      createdTenants++
    }

    if (options.allowCreateStaff) {
      for (const staff of Object.values(row.staffPreview)) {
        if (!staff?.willCreate) continue
        if (createdStaffNames.has(staff.name)) continue
        createdStaffNames.add(staff.name)
        createdStaff++
      }
    }
  }

  return {
    createdProjects,
    updatedProjects,
    createdCustomers,
    createdTenants,
    createdStaff,
    skipped,
    errors,
  }
}

/** 供开发调试的样例行（与设计文档一致） */
export const MOCK_PROJECT_IMPORT_SAMPLE_ROW = {
  项目名称: '几何Docker项目',
  标签: '公海池-无人跟踪',
  租户ID: null,
  业务线: null,
  描述: '山海几何_Docker需求&测试调研表\n6~7月高峰，达到50卡左右',
  客户经理: '李楠',
  交付: null,
  '客成/项目经理': '高彭',
  售前: null,
  关注人: null,
  '所属渠道/生态': null,
  算力规模: '10卡',
  阶段: '生产运营',
  健康状态: 'pending',
  进展更新: '0409：客户硬件更新，预计4月底~5月初重新上线，4月9暂停算力使用',
  下一步计划: null,
  客群分布: null,
  开始测试日期: null,
  试用完成日期: null,
  转正式日期: null,
  '余额+裸金属消费': '¥0.00',
  总消费: '¥0.00',
  余额消费: '0',
  券消费: '0',
  补充消费: null,
  创建时间: '2025/03/14',
  最后更新时间: '2026/05/05',
  父记录: null,
  创建人: '高彭',
  客户全称: null,
  项目问题与需求: null,
  线上裸金属消费: '0',
}
