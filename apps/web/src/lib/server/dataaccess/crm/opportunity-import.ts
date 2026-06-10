import { db } from '@/lib/db'
import {
  buildOpportunityImportPreviewResult,
  detectMissingOpportunityRequiredHeaders,
  mapOpportunityImportSource,
  parseOpportunityImportBuffer,
  pickOpportunityCell,
  resolveOpportunityEffectiveFrom,
} from '@/lib/crm/opportunity-import-utils'
import {
  assertProjectInScope,
  resolveCrmDataScope,
  type CrmDataScope,
} from '@/lib/server/auth/crm-data-scope'
import { crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import { projectAccountManagerDataAccess } from '@/lib/server/dataaccess/crm/project-account-manager'
import { projectOpportunitySourceDataAccess } from '@/lib/server/dataaccess/crm/project-opportunity-source'
import { projectStaffAssignmentDataAccess } from '@/lib/server/dataaccess/crm/project-staff-assignment'
import type {
  OpportunityImportCommitOptions,
  OpportunityImportCommitResult,
  OpportunityImportPreviewResult,
  OpportunityImportPreviewRow,
  OpportunityImportRowOverride,
  OpportunityImportStaffRole,
} from '@/lib/types/opportunity-import'
import {
  billingTenant,
  businessLine,
  crmProject,
  projectOpportunitySourceAssignment,
  projectStaffAssignment,
  projectTenant,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, ilike, inArray, isNull } from 'drizzle-orm'

const PREVIEW_TTL_MS = 15 * 60 * 1000

const STAFF_COLUMNS: { column: '销售' | '交付' | '项目经理' | '售前'; role: OpportunityImportStaffRole }[] = [
  { column: '销售', role: 'account_manager' },
  { column: '交付', role: 'delivery_manager' },
  { column: '项目经理', role: 'project_manager' },
  { column: '售前', role: 'pre_sales' },
]

type PreviewCacheEntry = {
  expiresAt: number
  preview: OpportunityImportPreviewResult
}

const previewCache = new Map<string, PreviewCacheEntry>()

function newId() {
  return crypto.randomUUID()
}

function placeholderMobile(seed: string): string {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const suffix = String(hash % 1_000_000).padStart(6, '0')
  return `199${suffix}`.slice(0, 11)
}

function purgeExpiredPreviewCache() {
  const now = Date.now()
  for (const [id, entry] of previewCache) {
    if (entry.expiresAt <= now) previewCache.delete(id)
  }
}

async function loadTenantsByPlatformIds(platformIds: string[]) {
  if (platformIds.length === 0) {
    return new Map<
      string,
      { tenantId: string; platformTenantId: string; tenantName: string }
    >()
  }

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      tenantName: billingTenant.name,
    })
    .from(billingTenant)
    .where(inArray(billingTenant.platformTenantId, platformIds))

  const map = new Map<string, { tenantId: string; platformTenantId: string; tenantName: string }>()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      platformTenantId: row.platformTenantId,
      tenantName: row.tenantName,
    })
  }
  return map
}

type ProjectCandidate = {
  projectId: string
  projectName: string
  businessLineId: string
  businessLineName: string
}

async function loadProjectsByTenantId(tenantId: string): Promise<ProjectCandidate[]> {
  const byPrimary = await db
    .select({
      projectId: crmProject.id,
      projectName: crmProject.name,
      businessLineId: crmProject.businessLineId,
    })
    .from(crmProject)
    .where(eq(crmProject.primaryTenantId, tenantId))

  const byLink = await db
    .select({
      projectId: crmProject.id,
      projectName: crmProject.name,
      businessLineId: crmProject.businessLineId,
    })
    .from(projectTenant)
    .innerJoin(crmProject, eq(crmProject.id, projectTenant.projectId))
    .where(eq(projectTenant.tenantId, tenantId))

  const merged = new Map<string, Omit<ProjectCandidate, 'businessLineName'>>()
  for (const row of [...byPrimary, ...byLink]) {
    merged.set(row.projectId, row)
  }

  const businessLineIds = [...new Set([...merged.values()].map((r) => r.businessLineId))]
  const lineMap = new Map<string, string>()
  if (businessLineIds.length > 0) {
    const lines = await db
      .select({ id: businessLine.id, name: businessLine.name })
      .from(businessLine)
      .where(inArray(businessLine.id, businessLineIds))
    for (const line of lines) {
      lineMap.set(line.id, line.name)
    }
  }

  return [...merged.values()].map((row) => ({
    ...row,
    businessLineName: lineMap.get(row.businessLineId) ?? '',
  }))
}

async function resolveBusinessLineIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const row = await db.query.businessLine.findFirst({
    where: and(eq(businessLine.status, 'active'), ilike(businessLine.name, trimmed)),
  })
  return row?.id ?? null
}

async function resolveProjectCandidate(
  candidates: ProjectCandidate[],
  projectName: string,
  businessLineName: string | null,
): Promise<{ project?: ProjectCandidate; warnings: string[]; errors: string[] }> {
  if (candidates.length === 0) {
    return { warnings: [], errors: ['租户下未找到关联项目'] }
  }
  if (candidates.length === 1) {
    return { project: candidates[0], warnings: [], errors: [] }
  }

  const nameMatches = candidates.filter((c) => c.projectName === projectName.trim())
  if (nameMatches.length === 1) {
    return { project: nameMatches[0], warnings: [], errors: [] }
  }

  const warnings: string[] = []
  if (nameMatches.length > 1) {
    if (businessLineName) {
      const lineId = await resolveBusinessLineIdByName(businessLineName)
      if (!lineId) {
        warnings.push('业务线名称无法匹配，仍无法唯一确定项目')
      } else {
        const lineMatches = nameMatches.filter((c) => c.businessLineId === lineId)
        if (lineMatches.length === 1) {
          return { project: lineMatches[0], warnings, errors: [] }
        }
      }
    }
    return { warnings, errors: ['多个项目匹配且无法消解歧义'] }
  }

  return { warnings: [], errors: ['项目名称与租户下项目不匹配'] }
}

async function loadStaffByNames(names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (unique.length === 0) return new Map<string, { id: string; displayName: string }[]>()

  const rows = await db
    .select({ id: userStaff.id, displayName: userStaff.displayName })
    .from(userStaff)
    .where(inArray(userStaff.displayName, unique))

  const map = new Map<string, { id: string; displayName: string }[]>()
  for (const row of rows) {
    const list = map.get(row.displayName) ?? []
    list.push(row)
    map.set(row.displayName, list)
  }
  return map
}

function buildStaffPreview(
  staffMap: Map<string, { id: string; displayName: string }[]>,
  name: string | null,
  allowCreateStaff: boolean,
): {
  preview?: OpportunityImportPreviewRow['staff'][OpportunityImportStaffRole]
  warnings: string[]
  errors: string[]
} {
  if (!name) return { warnings: [], errors: [] }

  const matches = staffMap.get(name) ?? []
  if (matches.length > 1) {
    const first = matches[0]
    if (!first) {
      return { warnings: [], errors: [`员工「${name}」匹配异常`] }
    }
    return {
      preview: { name, staffId: first.id, willCreate: false },
      warnings: [`「${name}」存在多名同姓名员工，将使用第一条`],
      errors: [],
    }
  }
  if (matches.length === 1) {
    const first = matches[0]
    if (!first) {
      return { warnings: [], errors: [`员工「${name}」匹配异常`] }
    }
    return { preview: { name, staffId: first.id, willCreate: false }, warnings: [], errors: [] }
  }
  if (allowCreateStaff) {
    return { preview: { name, willCreate: true }, warnings: [], errors: [] }
  }
  return {
    warnings: [],
    errors: [`员工「${name}」不存在且未允许自动创建`],
  }
}

async function loadCurrentValuesForProjects(projectIds: string[]) {
  const result = new Map<
    string,
    NonNullable<OpportunityImportPreviewRow['current']>
  >()

  if (projectIds.length === 0) return result

  const oppRows = await db
    .select({
      projectId: projectOpportunitySourceAssignment.projectId,
      opportunitySource: projectOpportunitySourceAssignment.opportunitySource,
    })
    .from(projectOpportunitySourceAssignment)
    .where(
      and(
        inArray(projectOpportunitySourceAssignment.projectId, projectIds),
        isNull(projectOpportunitySourceAssignment.effectiveTo),
      ),
    )

  const staffRows = await db
    .select({
      projectId: projectStaffAssignment.projectId,
      roleType: projectStaffAssignment.roleType,
      displayName: userStaff.displayName,
    })
    .from(projectStaffAssignment)
    .innerJoin(userStaff, eq(projectStaffAssignment.userStaffId, userStaff.id))
    .where(
      and(
        inArray(projectStaffAssignment.projectId, projectIds),
        isNull(projectStaffAssignment.effectiveTo),
      ),
    )

  for (const id of projectIds) {
    result.set(id, {})
  }

  for (const row of oppRows) {
    const cur = result.get(row.projectId)
    if (cur) {
      cur.opportunitySource = row.opportunitySource as NonNullable<
        OpportunityImportPreviewRow['current']
      >['opportunitySource']
    }
  }

  for (const row of staffRows) {
    const cur = result.get(row.projectId)
    if (!cur) continue
    if (row.roleType === 'account_manager') cur.accountManager = row.displayName
    if (row.roleType === 'delivery_manager') cur.deliveryManager = row.displayName
    if (row.roleType === 'project_manager') cur.projectManager = row.displayName
    if (row.roleType === 'pre_sales') cur.preSales = row.displayName
  }

  return result
}

function rowHasUpdates(row: OpportunityImportPreviewRow): boolean {
  return Boolean(
    row.opportunitySource ||
      row.accountManagerStaffId ||
      row.staff.account_manager ||
      row.deliveryManagerStaffId ||
      row.staff.delivery_manager ||
      row.projectManagerStaffId ||
      row.staff.project_manager ||
      row.preSalesStaffId ||
      row.staff.pre_sales,
  )
}

function applyRowOverride(
  row: OpportunityImportPreviewRow,
  override: OpportunityImportRowOverride | undefined,
): OpportunityImportPreviewRow {
  if (!override) return row
  return {
    ...row,
    opportunitySource: override.opportunitySource !== undefined ? override.opportunitySource : row.opportunitySource,
    accountManagerStaffId:
      override.accountManagerStaffId !== undefined
        ? override.accountManagerStaffId
        : row.accountManagerStaffId,
    deliveryManagerStaffId:
      override.deliveryManagerStaffId !== undefined
        ? override.deliveryManagerStaffId
        : row.deliveryManagerStaffId,
    projectManagerStaffId:
      override.projectManagerStaffId !== undefined
        ? override.projectManagerStaffId
        : row.projectManagerStaffId,
    preSalesStaffId:
      override.preSalesStaffId !== undefined ? override.preSalesStaffId : row.preSalesStaffId,
    effectiveFrom: override.effectiveFrom ?? row.effectiveFrom,
    selected: override.selected !== undefined ? override.selected : row.selected,
  }
}

async function ensureStaffId(
  name: string,
  allowCreate: boolean,
  cache: Map<string, string>,
  stats: { createdStaff: number },
): Promise<string> {
  const trimmed = name.trim()
  const cached = cache.get(trimmed)
  if (cached) return cached

  const rows = await db
    .select({ id: userStaff.id })
    .from(userStaff)
    .where(eq(userStaff.displayName, trimmed))
    .limit(1)
  if (rows[0]) {
    cache.set(trimmed, rows[0].id)
    return rows[0].id
  }

  if (!allowCreate) {
    throw new Error(`员工「${trimmed}」不存在`)
  }

  let mobile = placeholderMobile(trimmed)
  for (let i = 0; i < 5; i++) {
    const exists = await db.query.userStaff.findFirst({ where: eq(userStaff.mobile, mobile) })
    if (!exists) break
    mobile = placeholderMobile(`${trimmed}-${i}-${Date.now()}`)
  }

  const id = newId()
  await db.insert(userStaff).values({
    id,
    displayName: trimmed,
    mobile,
    email: null,
    employeeNo: null,
    status: 'active',
    department: null,
  })
  cache.set(trimmed, id)
  stats.createdStaff++
  return id
}

async function resolveStaffIdForRole(
  row: OpportunityImportPreviewRow,
  role: OpportunityImportStaffRole,
  allowCreate: boolean,
  cache: Map<string, string>,
  stats: { createdStaff: number },
): Promise<string | null> {
  const staffIdKey =
    role === 'account_manager'
      ? 'accountManagerStaffId'
      : role === 'delivery_manager'
        ? 'deliveryManagerStaffId'
        : role === 'project_manager'
          ? 'projectManagerStaffId'
          : 'preSalesStaffId'

  const directId = row[staffIdKey]
  if (directId) return directId

  const preview = row.staff[role]
  if (!preview) return null
  if (preview.staffId) return preview.staffId
  return await ensureStaffId(preview.name, allowCreate, cache, stats)
}

export const opportunityImportDataAccess = {
  async preview(buffer: Buffer, fileName: string, crmScope: CrmDataScope): Promise<OpportunityImportPreviewResult> {
    purgeExpiredPreviewCache()

    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer
    const missingRequired = detectMissingOpportunityRequiredHeaders(arrayBuffer)
    if (missingRequired.length > 0) {
      throw new Error(`缺少必填表头：${missingRequired.join('、')}`)
    }

    const parsedResult = parseOpportunityImportBuffer(buffer, fileName)

    const platformIds = [
      ...new Set(
        parsedResult.rows
          .map((r) => pickOpportunityCell(r.raw, '租户ID'))
          .filter((v): v is string => Boolean(v)),
      ),
    ]

    const staffNames = new Set<string>()
    for (const row of parsedResult.rows) {
      for (const { column } of STAFF_COLUMNS) {
        const name = pickOpportunityCell(row.raw, column)
        if (name) staffNames.add(name)
      }
    }

    const tenantMap = await loadTenantsByPlatformIds(platformIds)
    const staffMap = await loadStaffByNames([...staffNames])

    const rowKeyCounts = new Map<string, number>()
    for (const item of parsedResult.rows) {
      const projectName = pickOpportunityCell(item.raw, '项目名称') ?? ''
      const tenantId = pickOpportunityCell(item.raw, '租户ID') ?? ''
      if (!projectName.trim() || !tenantId.trim()) continue
      const key = `${tenantId.trim()}::${projectName.trim()}`
      rowKeyCounts.set(key, (rowKeyCounts.get(key) ?? 0) + 1)
    }
    const duplicateRowKeys = [...rowKeyCounts.values()].some((n) => n > 1)

    const previewRows: OpportunityImportPreviewRow[] = []

    for (const item of parsedResult.rows) {
      const warnings: string[] = [...parsedResult.duplicateColumnWarnings]
      const errors: string[] = []

      const projectName = pickOpportunityCell(item.raw, '项目名称') ?? ''
      const excelTenantId = pickOpportunityCell(item.raw, '租户ID') ?? ''
      const businessLineName = pickOpportunityCell(item.raw, '业务线')

      if (!projectName.trim()) {
        errors.push('项目名称为空')
      }
      if (!excelTenantId.trim()) {
        errors.push('租户 ID 为空')
      }

      const rowKey = `${excelTenantId.trim()}::${projectName.trim()}`
      if (projectName.trim() && excelTenantId.trim() && (rowKeyCounts.get(rowKey) ?? 0) > 1) {
        errors.push('同一文件中租户 ID + 项目名称重复')
      }

      const oppRaw = pickOpportunityCell(item.raw, '商机来源')
      const opp = mapOpportunityImportSource(oppRaw)
      if (oppRaw && !opp.source) {
        errors.push(`商机来源「${oppRaw}」无法识别`)
      }

      const staff: OpportunityImportPreviewRow['staff'] = {}
      for (const { column, role } of STAFF_COLUMNS) {
        const name = pickOpportunityCell(item.raw, column)
        const staffResult = buildStaffPreview(staffMap, name, true)
        warnings.push(...staffResult.warnings)
        errors.push(...staffResult.errors)
        if (staffResult.preview) staff[role] = staffResult.preview
      }

      let resolvedPlatformTenantId: string | undefined
      let resolvedTenantName: string | undefined
      let projectId: string | undefined
      let resolvedProjectName: string | undefined
      let current: OpportunityImportPreviewRow['current'] | undefined

      if (excelTenantId.trim()) {
        const tenant = tenantMap.get(excelTenantId.trim())
        if (!tenant) {
          errors.push('本地未找到该租户 ID')
        } else {
          resolvedPlatformTenantId = tenant.platformTenantId
          resolvedTenantName = tenant.tenantName
          const candidates = await loadProjectsByTenantId(tenant.tenantId)
          const resolved = await resolveProjectCandidate(
            candidates,
            projectName,
            businessLineName,
          )
          warnings.push(...resolved.warnings)
          errors.push(...resolved.errors)
          if (resolved.project) {
            projectId = resolved.project.projectId
            resolvedProjectName = resolved.project.projectName
          }
        }
      }

      if (projectId) {
        try {
          await assertProjectInScope(crmScope, projectId)
        } catch {
          errors.push('无权限操作该项目')
        }
      }

      const accountManagerStaffId = staff.account_manager?.staffId ?? null
      const deliveryManagerStaffId = staff.delivery_manager?.staffId ?? null
      const projectManagerStaffId = staff.project_manager?.staffId ?? null
      const preSalesStaffId = staff.pre_sales?.staffId ?? null

      const effectiveFromResult = resolveOpportunityEffectiveFrom(item.raw)
      if (effectiveFromResult.warning) {
        warnings.push(effectiveFromResult.warning)
      }

      const draftRow: OpportunityImportPreviewRow = {
        rowIndex: item.rowIndex,
        projectName,
        excelTenantId,
        resolvedPlatformTenantId,
        resolvedTenantName,
        projectId,
        resolvedProjectName,
        businessLineName: businessLineName ?? undefined,
        opportunitySource: opp.source,
        opportunitySourceLabel: opp.label,
        staff,
        accountManagerStaffId,
        deliveryManagerStaffId,
        projectManagerStaffId,
        preSalesStaffId,
        effectiveFrom: effectiveFromResult.effectiveFrom,
        warnings,
        errors,
        selectable: false,
        action: 'error',
        selected: false,
      }

      if (!rowHasUpdates(draftRow)) {
        warnings.push('商机来源与四人组均为空，无需更新')
      }

      const selectable = errors.length === 0 && projectId != null && rowHasUpdates(draftRow)
      const action: OpportunityImportPreviewRow['action'] =
        errors.length > 0 ? 'error' : rowHasUpdates(draftRow) ? 'update' : 'skip'

      previewRows.push({
        ...draftRow,
        selectable,
        action,
        selected: selectable,
      })
    }

    const projectIds = previewRows.map((r) => r.projectId).filter((id): id is string => Boolean(id))
    const currentMap = await loadCurrentValuesForProjects(projectIds)
    for (const row of previewRows) {
      if (row.projectId) {
        row.current = currentMap.get(row.projectId)
      }
    }

    const built = buildOpportunityImportPreviewResult(
      fileName,
      previewRows,
      parsedResult.matchedColumns,
      parsedResult.ignoredColumnNames,
      duplicateRowKeys,
    )

    previewCache.set(built.previewToken, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      preview: built,
    })

    crmLog('opportunity-import', 'preview done', {
      fileName,
      total: built.summary.total,
      errors: built.summary.error,
      ignoredColumns: built.ignoredColumnCount,
    })

    return built
  },

  getCachedPreview(previewToken: string) {
    purgeExpiredPreviewCache()
    return previewCache.get(previewToken)?.preview ?? null
  },

  async commit(
    previewToken: string,
    options: OpportunityImportCommitOptions,
    user: { id: string; role?: string | null; email?: string | null; phoneNumber?: string | null },
  ): Promise<OpportunityImportCommitResult> {
    const cached = this.getCachedPreview(previewToken)
    if (!cached) {
      throw new Error('预览已过期，请重新上传文件')
    }

    if (cached.duplicateRowKeys) {
      throw new Error('存在重复的租户 ID + 项目名称，请去重后重新上传')
    }

    const crmScope = await resolveCrmDataScope(user)
    const overrideByRow = new Map(
      (options.rowOverrides ?? []).map((override) => [override.rowIndex, override]),
    )

    const result: OpportunityImportCommitResult = {
      updatedOpportunitySource: 0,
      updatedAccountManager: 0,
      updatedDeliveryManager: 0,
      updatedProjectManager: 0,
      updatedPreSales: 0,
      skipped: 0,
      failed: [],
    }

    const staffCache = new Map<string, string>()
    const stats = { createdStaff: 0 }

    const selectedRows = cached.rows.filter((baseRow) => {
      const override = overrideByRow.get(baseRow.rowIndex)
      const row = applyRowOverride(baseRow, override)
      if (!row.selectable) {
        result.skipped++
        return false
      }
      if (override?.selected === false || row.selected === false) {
        result.skipped++
        return false
      }
      if (options.rowIndexes && !options.rowIndexes.includes(row.rowIndex)) {
        result.skipped++
        return false
      }
      return true
    })

    for (const baseRow of selectedRows) {
      const override = overrideByRow.get(baseRow.rowIndex)
      const row = applyRowOverride(baseRow, override)

      try {
        if (!row.projectId) throw new Error('项目未匹配')

        await assertProjectInScope(crmScope, row.projectId)

        if (row.opportunitySource) {
          await projectOpportunitySourceDataAccess.change({
            projectId: row.projectId,
            opportunitySource: row.opportunitySource,
            effectiveFrom: row.effectiveFrom,
            createdBy: options.createdByStaffId ?? null,
          })
          result.updatedOpportunitySource++
        }

        const accountManagerId = await resolveStaffIdForRole(
          row,
          'account_manager',
          options.allowCreateStaff,
          staffCache,
          stats,
        )
        if (accountManagerId) {
          await projectAccountManagerDataAccess.change({
            projectId: row.projectId,
            staffId: accountManagerId,
            effectiveFrom: row.effectiveFrom,
            createdBy: options.createdByStaffId ?? null,
          })
          result.updatedAccountManager++
        }

        const deliveryId = await resolveStaffIdForRole(
          row,
          'delivery_manager',
          options.allowCreateStaff,
          staffCache,
          stats,
        )
        if (deliveryId) {
          await projectStaffAssignmentDataAccess.change({
            projectId: row.projectId,
            roleType: 'delivery_manager',
            staffId: deliveryId,
            effectiveFrom: row.effectiveFrom,
            createdBy: options.createdByStaffId ?? null,
          })
          result.updatedDeliveryManager++
        }

        const pmId = await resolveStaffIdForRole(
          row,
          'project_manager',
          options.allowCreateStaff,
          staffCache,
          stats,
        )
        if (pmId) {
          await projectStaffAssignmentDataAccess.change({
            projectId: row.projectId,
            roleType: 'project_manager',
            staffId: pmId,
            effectiveFrom: row.effectiveFrom,
            createdBy: options.createdByStaffId ?? null,
          })
          result.updatedProjectManager++
        }

        const preSalesId = await resolveStaffIdForRole(
          row,
          'pre_sales',
          options.allowCreateStaff,
          staffCache,
          stats,
        )
        if (preSalesId) {
          await projectStaffAssignmentDataAccess.change({
            projectId: row.projectId,
            roleType: 'pre_sales',
            staffId: preSalesId,
            effectiveFrom: row.effectiveFrom,
            createdBy: options.createdByStaffId ?? null,
          })
          result.updatedPreSales++
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : '导入失败'
        result.failed.push({ rowIndex: row.rowIndex, message })
        crmWarn('opportunity-import', 'row failed', { rowIndex: row.rowIndex, message })
      }
    }

    crmLog('opportunity-import', 'commit done', result)
    return result
  },
}
