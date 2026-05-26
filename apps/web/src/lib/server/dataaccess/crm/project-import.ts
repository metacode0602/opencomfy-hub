import { db } from '@/lib/db'
import {
  buildProjectImportPreviewResult,
  detectMissingRequiredHeaders,
  errorFieldsToColumnIndexes,
  mapStageLabel,
  mapStatusLabel,
  parseImportDate,
  parseProjectImportBuffer,
  pickImportCell,
  resolveImportStartDate,
  sanitizeDescription,
  splitTags,
} from '@/lib/crm/project-import-utils'
import { crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import type {
  ProjectImportCommitOptions,
  ProjectImportCommitResult,
  ProjectImportParsedRow,
  ProjectImportPreviewResult,
  ProjectImportPreviewRow,
  ProjectImportStaffRole,
} from '@/lib/types/project-import'
import {
  billingTenant,
  businessLine,
  crmProject,
  customer,
  projectActivity,
  projectStaffAssignment,
  projectTag,
  projectTagAssignment,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, ilike, inArray, isNull } from 'drizzle-orm'

const PREVIEW_TTL_MS = 15 * 60 * 1000
const DEFAULT_BUSINESS_LINE_CODE = 'delivery_project'

const STAFF_COLUMNS: { column: string; role: ProjectImportStaffRole }[] = [
  { column: '售前', role: 'pre_sales' },
  { column: '客户经理', role: 'account_manager' },
  { column: '交付', role: 'delivery_manager' },
  { column: '客成/项目经理', role: 'project_manager' },
]

type PreviewCacheEntry = {
  expiresAt: number
  parsed: ProjectImportParsedRow[]
  preview: ProjectImportPreviewResult
  columnCanonicalByIndex: (string | null)[]
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

async function loadTenantsByPlatformIds(platformIds: string[]) {
  if (platformIds.length === 0) {
    return new Map<
      string,
      { tenantId: string; customerId: string; customerName: string; tenantName: string }
    >()
  }

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      customerId: billingTenant.customerId,
      customerName: customer.name,
      tenantName: billingTenant.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.platformTenantId, platformIds))

  const map = new Map<
    string,
    { tenantId: string; customerId: string; customerName: string; tenantName: string }
  >()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      customerId: row.customerId,
      customerName: row.customerName,
      tenantName: row.tenantName,
    })
  }
  return map
}

async function resolveBusinessLineId(name: string | null): Promise<{ id: string; name: string }> {
  // await ensureCrmSeeded()
  if (name?.trim()) {
    const byName = await db.query.businessLine.findFirst({
      where: and(eq(businessLine.status, 'active'), ilike(businessLine.name, name.trim())),
    })
    if (byName) return { id: byName.id, name: byName.name }
  }

  const fallback = await db.query.businessLine.findFirst({
    where: eq(businessLine.code, DEFAULT_BUSINESS_LINE_CODE),
  })
  if (!fallback) {
    throw new Error('未找到默认业务线，请先初始化业务线数据')
  }
  return { id: fallback.id, name: fallback.name }
}

async function findCustomerByShortName(shortName: string) {
  const trimmed = shortName.trim()
  if (!trimmed) return null
  return db.query.customer.findFirst({
    where: ilike(customer.shortName, trimmed),
  })
}

async function findProjectByCustomerAndName(customerId: string, projectName: string) {
  return db.query.crmProject.findFirst({
    where: and(eq(crmProject.customerId, customerId), eq(crmProject.name, projectName.trim())),
  })
}

function buildStaffPreview(
  item: ProjectImportParsedRow,
  staffMap: Map<string, { id: string; displayName: string }[]>,
  allowCreateStaff: boolean,
) {
  const staffPreview: ProjectImportPreviewRow['staffPreview'] = {}
  const warnings: string[] = []
  const errors: string[] = []
  const errorFields: string[] = []

  for (const { column, role } of STAFF_COLUMNS) {
    const name = pickImportCell(item.raw, column)
    if (!name) continue

    const matches = staffMap.get(name) ?? []
    if (matches.length > 1) {
      warnings.push(`${column}「${name}」存在多名同姓名员工，将使用第一条`)
    }

    const hit = matches[0]
    if (hit) {
      staffPreview[role] = { name, staffId: hit.id, willCreate: false }
    } else if (allowCreateStaff) {
      staffPreview[role] = { name, willCreate: true }
    } else {
      errors.push(`${column}「${name}」不存在且未允许自动创建`)
      errorFields.push(column)
    }
  }

  return { staffPreview, warnings, errors, errorFields }
}

async function buildPreviewContext(parsed: ProjectImportParsedRow[]) {
  const platformIds = [
    ...new Set(
      parsed
        .map((row) => pickImportCell(row.raw, '租户ID'))
        .filter((v): v is string => Boolean(v)),
    ),
  ]

  const staffNames = new Set<string>()
  for (const row of parsed) {
    for (const { column } of STAFF_COLUMNS) {
      const name = pickImportCell(row.raw, column)
      if (name) staffNames.add(name)
    }
  }

  const [tenantMap, staffMap, defaultBusinessLine] = await Promise.all([
    loadTenantsByPlatformIds(platformIds),
    loadStaffByNames([...staffNames]),
    resolveBusinessLineId(null),
  ])

  return { tenantMap, staffMap, defaultBusinessLine }
}

async function enrichPreviewRowAsync(
  row: ProjectImportParsedRow,
  draft: Omit<
    ProjectImportPreviewRow,
    'warnings' | 'errors' | 'errorFields' | 'errorColumnIndexes' | 'selectable'
  >,
  ctx: Awaited<ReturnType<typeof buildPreviewContext>>,
) {
  const warnings: string[] = []
  const errors: string[] = []
  const errorFields: string[] = []
  let selectable = true
  let action: ProjectImportPreviewRow['action'] = 'create'
  let customerStrategy = draft.customerStrategy
  let customerPreview = { ...draft.customerPreview }
  let tenantPreview = draft.tenantPreview
  let existingProjectId: string | undefined
  let mapped: Partial<ProjectImportPreviewRow['mapped']> = {}

  const staffResult = buildStaffPreview(row, ctx.staffMap, true)
  warnings.push(...staffResult.warnings)
  errors.push(...staffResult.errors)
  errorFields.push(...staffResult.errorFields)

  const businessLineName = pickImportCell(row.raw, '业务线')
  if (businessLineName) {
    const line = await resolveBusinessLineId(businessLineName)
    mapped = { businessLineId: line.id, businessLineName: line.name }
  } else {
    warnings.push('业务线为空，将使用默认「交付型项目」')
    mapped = {
      businessLineId: ctx.defaultBusinessLine.id,
      businessLineName: ctx.defaultBusinessLine.name,
    }
  }

  const platformTenantId = pickImportCell(row.raw, '租户ID')
  let customerIdForProject: string | undefined

  if (platformTenantId) {
    const local = ctx.tenantMap.get(platformTenantId)
    if (!local) {
      errors.push(`租户 ID ${platformTenantId} 在本地不存在`)
      errorFields.push('租户ID')
      selectable = false
      action = 'skip'
    } else {
      customerStrategy = 'link_tenant'
      customerIdForProject = local.customerId
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
    }
  } else {
    customerStrategy = 'create_customer'
    const shortName = draft.projectName.trim()
    const existingCustomer = shortName ? await findCustomerByShortName(shortName) : null
    if (existingCustomer) {
      customerStrategy = 'existing_customer'
      customerIdForProject = existingCustomer.id
      customerPreview = {
        id: existingCustomer.id,
        name: existingCustomer.name,
        shortName: existingCustomer.shortName ?? existingCustomer.name,
      }
    }
  }

  if (customerIdForProject && draft.projectName.trim()) {
    const existingProject = await findProjectByCustomerAndName(
      customerIdForProject,
      draft.projectName,
    )
    if (existingProject) {
      action = 'update'
      existingProjectId = existingProject.id
    }
  } else if (customerStrategy === 'create_customer' && draft.projectName.trim()) {
    const existingCustomer = await findCustomerByShortName(draft.projectName)
    if (existingCustomer) {
      const existingProject = await findProjectByCustomerAndName(
        existingCustomer.id,
        draft.projectName,
      )
      if (existingProject) {
        action = 'update'
        existingProjectId = existingProject.id
        customerStrategy = 'existing_customer'
        customerPreview = {
          id: existingCustomer.id,
          name: existingCustomer.name,
          shortName: existingCustomer.shortName ?? existingCustomer.name,
        }
      }
    }
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
    staffPreview: staffResult.staffPreview,
    existingProjectId,
    mapped,
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

async function upsertPartialStaffAssignments(
  projectId: string,
  staffByRole: Partial<Record<ProjectImportStaffRole, string>>,
  effectiveFrom: Date,
) {
  for (const [roleType, userStaffId] of Object.entries(staffByRole)) {
    if (!userStaffId) continue
    await db
      .update(projectStaffAssignment)
      .set({ effectiveTo: new Date() })
      .where(
        and(
          eq(projectStaffAssignment.projectId, projectId),
          eq(projectStaffAssignment.roleType, roleType),
          isNull(projectStaffAssignment.effectiveTo),
        ),
      )
    await db.insert(projectStaffAssignment).values({
      id: newId(),
      projectId,
      userStaffId,
      roleType,
      effectiveFrom,
      effectiveTo: null,
    })
  }
}

async function appendTagsForProject(projectId: string, tagNames: string[]) {
  if (tagNames.length === 0) return

  const existing = await db
    .select({ name: projectTag.name })
    .from(projectTagAssignment)
    .innerJoin(projectTag, eq(projectTag.id, projectTagAssignment.tagId))
    .where(eq(projectTagAssignment.projectId, projectId))

  const existingNames = new Set(existing.map((t) => t.name))
  for (const name of tagNames) {
    if (existingNames.has(name)) continue

    let tag = await db.query.projectTag.findFirst({ where: eq(projectTag.name, name) })
    if (!tag) {
      const tagId = newId()
      await db.insert(projectTag).values({ id: tagId, name, sortOrder: 0 })
      tag = { id: tagId, name, sortOrder: 0, createdAt: new Date() }
    }

    await db.insert(projectTagAssignment).values({ projectId, tagId: tag.id })
    existingNames.add(name)
  }
}

async function insertActivities(
  projectId: string,
  row: ProjectImportPreviewRow,
  authorStaffId?: string,
) {
  const items: { type: string; title: string; description: string }[] = []
  if (row.mapped.progressUpdate) {
    items.push({ type: 'progress_update', title: '进展更新', description: row.mapped.progressUpdate })
  }
  if (row.mapped.nextPlan) {
    items.push({ type: 'next_plan', title: '下一步计划', description: row.mapped.nextPlan })
  }
  if (row.mapped.issuesRequirements) {
    items.push({
      type: 'issues_requirements',
      title: '项目问题与需求',
      description: row.mapped.issuesRequirements,
    })
  }

  for (const item of items) {
    await db.insert(projectActivity).values({
      id: newId(),
      projectId,
      type: item.type,
      title: item.title,
      description: item.description,
      authorName: row.mapped.creatorName ?? null,
      authorStaffId: authorStaffId ?? null,
      authorRole: null,
      metadata: null,
    })
  }
}

function purgeExpiredPreviewCache() {
  const now = Date.now()
  for (const [token, entry] of previewCache.entries()) {
    if (entry.expiresAt <= now) previewCache.delete(token)
  }
}

export const projectImportDataAccess = {
  async preview(buffer: Buffer, fileName: string): Promise<ProjectImportPreviewResult> {
    purgeExpiredPreviewCache()

    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer
    const missingRequiredHeaders = detectMissingRequiredHeaders(arrayBuffer)
    if (missingRequiredHeaders.length > 0) {
      throw new Error(`缺少必填表头：${missingRequiredHeaders.join('、')}`)
    }

    const parsedResult = parseProjectImportBuffer(buffer, fileName)
    const ctx = await buildPreviewContext(parsedResult.rows)

    const rows: ProjectImportPreviewRow[] = []
    for (const item of parsedResult.rows) {
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

      const extra = await enrichPreviewRowAsync(item, draft, ctx)
      const warnings = [...extra.warnings]
      const errors = [...extra.errors]
      const errorFields = [...extra.errorFields]

      if (!projectName.trim()) {
        errors.push('项目名称为空')
        if (!errorFields.includes('项目名称')) errorFields.push('项目名称')
      }
      if (pickImportCell(item.raw, '父记录')) warnings.push('父记录暂不支持层级导入')
      if (pickImportCell(item.raw, '关注人')) warnings.push('关注人暂不入库，仅预览展示')

      rows.push({
        ...draft,
        ...extra,
        mapped: { ...draft.mapped, ...extra.mapped },
        warnings,
        errors,
        errorFields,
        errorColumnIndexes: errorFieldsToColumnIndexes(
          errorFields,
          parsedResult.columnCanonicalByIndex,
        ),
        selectable: extra.selectable && errors.length === 0,
      })
    }

    const preview = buildProjectImportPreviewResult(
      fileName,
      rows,
      parsedResult.originalHeaders,
      missingRequiredHeaders,
      parsedResult.rows.map((r) => ({
        rowIndex: r.rowIndex,
        originalCells: r.originalCells,
      })),
    )

    previewCache.set(preview.previewToken, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      parsed: parsedResult.rows,
      preview,
      columnCanonicalByIndex: parsedResult.columnCanonicalByIndex,
    })

    crmLog('project-import', 'preview done', {
      fileName,
      total: preview.summary.total,
      errors: preview.summary.error,
    })

    return preview
  },

  getCachedPreview(previewToken: string) {
    purgeExpiredPreviewCache()
    return previewCache.get(previewToken) ?? null
  },

  async commit(
    previewToken: string,
    options: ProjectImportCommitOptions,
  ): Promise<ProjectImportCommitResult> {
    const cached = this.getCachedPreview(previewToken)
    if (!cached) {
      throw new Error('预览已过期，请重新上传文件')
    }

    const stats = {
      createdProjects: 0,
      updatedProjects: 0,
      createdCustomers: 0,
      createdTenants: 0,
      createdStaff: 0,
      skipped: 0,
    }
    const errors: ProjectImportCommitResult['errors'] = []
    const staffCache = new Map<string, string>()

    const selectedRows = cached.preview.rows.filter((row) => {
      if (!row.selectable) {
        stats.skipped++
        return false
      }
      if (options.rowIndexes && !options.rowIndexes.includes(row.rowIndex)) {
        stats.skipped++
        return false
      }
      return true
    })

    for (const row of selectedRows) {
      try {
        await db.transaction(async () => {
          const parsed = cached.parsed.find((p) => p.rowIndex === row.rowIndex)
          if (!parsed) throw new Error('找不到原始行数据')

          let customerId = row.customerPreview.id
          let primaryTenantId = row.tenantPreview?.id
          let rowCreatedCustomers = 0
          let rowCreatedTenants = 0

          if (row.customerStrategy === 'link_tenant') {
            if (!customerId || !primaryTenantId) {
              throw new Error('租户关联信息不完整')
            }
          } else {
            const shortName = row.projectName.trim()
            const legalName = row.customerPreview.name.trim() || shortName

            const existingCustomer = await findCustomerByShortName(shortName)

            if (!existingCustomer) {
              customerId = newId()
              await db.insert(customer).values({
                id: customerId,
                name: legalName,
                shortName: shortName,
                type: 'C',
                status: 'active',
                contactPerson: '',
                contactPhone: '',
                contactEmail: '',
                industry: '',
                address: '',
                testStartedOn: parseImportDate(pickImportCell(parsed.raw, '开始测试日期')),
                testCompletedOn: parseImportDate(pickImportCell(parsed.raw, '试用完成日期')),
                conversionDate: parseImportDate(pickImportCell(parsed.raw, '转正式日期')),
              })
              rowCreatedCustomers++
            } else {
              customerId = existingCustomer.id
            }

            const defaultTenant = await db.query.billingTenant.findFirst({
              where: and(eq(billingTenant.customerId, customerId!), eq(billingTenant.isDefault, true)),
            })

            if (defaultTenant) {
              primaryTenantId = defaultTenant.id
            } else {
              const hasAnyTenant = await db.query.billingTenant.findFirst({
                where: eq(billingTenant.customerId, customerId!),
                columns: { id: true },
              })
              primaryTenantId = newId()
              await db.insert(billingTenant).values({
                id: primaryTenantId,
                customerId: customerId!,
                name: shortName,
                platformTenantId: null,
                isDefault: !hasAnyTenant,
                status: 'active',
                balance: '0',
              })
              rowCreatedTenants++
            }
          }

          if (!customerId) throw new Error('无法确定客户')

          const businessLineId =
            row.mapped.businessLineId ??
            (await resolveBusinessLineId(pickImportCell(parsed.raw, '业务线'))).id

          const staffByRole: Partial<Record<ProjectImportStaffRole, string>> = {}
          for (const { role } of STAFF_COLUMNS) {
            const previewStaff = row.staffPreview[role]
            if (!previewStaff) continue
            staffByRole[role] = await ensureStaffId(
              previewStaff.name,
              options.allowCreateStaff,
              staffCache,
              stats,
            )
          }

          const endDate =
            row.mapped.stage === 'testing'
              ? parseImportDate(pickImportCell(parsed.raw, '试用完成日期'))
              : null

          const projectPayload = {
            customerId,
            primaryTenantId: primaryTenantId ?? null,
            businessLineId,
            name: row.projectName.trim(),
            description: row.mapped.description ?? '',
            stage: row.mapped.stage,
            status: row.mapped.status,
            startDate: row.mapped.startDate ?? new Date().toISOString().slice(0, 10),
            endDate,
            balance: '0',
          }

          let projectId = row.existingProjectId
          const now = new Date()

          if (projectId && row.action === 'update') {
            await db
              .update(crmProject)
              .set({
                customerId: projectPayload.customerId,
                primaryTenantId: projectPayload.primaryTenantId,
                businessLineId: projectPayload.businessLineId,
                name: projectPayload.name,
                description: projectPayload.description,
                stage: projectPayload.stage,
                status: projectPayload.status,
                startDate: projectPayload.startDate,
                endDate: projectPayload.endDate,
              })
              .where(eq(crmProject.id, projectId))
            stats.updatedProjects++
          } else {
            projectId = newId()
            await db.insert(crmProject).values({
              id: projectId,
              ...projectPayload,
              monthlyBudget: null,
              lastMonthRecharge: '0',
              thisMonthRecharge: '0',
              lastMonthConsumption: '0',
              thisMonthConsumption: '0',
              createdAt: now,
            })
            stats.createdProjects++
          }

          await upsertPartialStaffAssignments(projectId, staffByRole, now)
          await appendTagsForProject(projectId, row.tags)

          const creatorStaffId = row.mapped.creatorName
            ? staffCache.get(row.mapped.creatorName) ??
              (
                await db.query.userStaff.findFirst({
                  where: eq(userStaff.displayName, row.mapped.creatorName),
                  columns: { id: true },
                })
              )?.id
            : undefined

          await insertActivities(projectId, row, creatorStaffId)

          stats.createdCustomers += rowCreatedCustomers
          stats.createdTenants += rowCreatedTenants
        })
      } catch (e) {
        crmWarn('project-import', 'commit row failed', {
          rowIndex: row.rowIndex,
          err: e instanceof Error ? e.message : String(e),
        })
        errors.push({
          rowIndex: row.rowIndex,
          message: e instanceof Error ? e.message : '导入失败',
        })
      }
    }

    previewCache.delete(previewToken)

    crmLog('project-import', 'commit done', { ...stats, errors: errors.length })

    return {
      createdProjects: stats.createdProjects,
      updatedProjects: stats.updatedProjects,
      createdCustomers: stats.createdCustomers,
      createdTenants: stats.createdTenants,
      createdStaff: stats.createdStaff,
      skipped: stats.skipped,
      errors,
    }
  },
}
