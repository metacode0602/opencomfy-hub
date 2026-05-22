import { db } from '@/lib/db'
import {
  assertPlatformTenantIdCount,
  parsePlatformTenantIds,
} from '@/lib/crm/platform-tenant-import-utils'
import {
  fetchPlatformTenantsByIds,
  resolveTenantName,
  SuanliOpenApiError,
} from '@/lib/server/integrations/suanli-tenant-api'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import { projectsDataAccess } from '@/lib/server/dataaccess/crm/projects'
import {
  DEFAULT_PROJECT_TAG_NAMES,
  projectTagsDataAccess,
} from '@/lib/server/dataaccess/crm/project-tags'
import type { PlatformTenantApiRecord } from '@/lib/types/platform-tenant-import'
import type {
  TenantProjectImportCommitResult,
  TenantProjectImportFormValues,
  TenantProjectImportPreviewResult,
  TenantProjectImportPreviewRow,
} from '@/lib/types/tenant-project-import'
import {
  billingTenant,
  businessLine,
  crmProject,
  customer,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

const PREVIEW_TTL_MS = 15 * 60 * 1000

type CachedPreview = {
  expiresAt: number
  traceId: string
  result: TenantProjectImportPreviewResult
}

const previewCache = new Map<string, CachedPreview>()

function purgeExpiredPreviews() {
  const now = Date.now()
  for (const [id, entry] of previewCache) {
    if (entry.expiresAt <= now) previewCache.delete(id)
  }
}

function buildProjectName(record: PlatformTenantApiRecord): string {
  const company = record.company_name?.trim()
  const tenant = record.tenant_name?.trim()
  if (company && tenant && company !== tenant) {
    return `${company} · ${tenant}`
  }
  return company || tenant || `租户-${record.id}`
}

async function loadLocalTenantsByPlatformIds(platformIds: string[]) {
  if (platformIds.length === 0) {
    return new Map<
      string,
      { tenantId: string; customerId: string; customerName: string }
    >()
  }

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      customerId: billingTenant.customerId,
      customerName: customer.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.platformTenantId, platformIds))

  const map = new Map<
    string,
    { tenantId: string; customerId: string; customerName: string }
  >()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      customerId: row.customerId,
      customerName: row.customerName,
    })
  }
  return map
}

async function loadExistingProjectsByTenantIds(tenantIds: string[]) {
  if (tenantIds.length === 0) {
    return new Map<string, { projectId: string; projectName: string }>()
  }

  const rows = await db
    .select({
      projectId: crmProject.id,
      projectName: crmProject.name,
      primaryTenantId: crmProject.primaryTenantId,
    })
    .from(crmProject)
    .where(inArray(crmProject.primaryTenantId, tenantIds))

  const map = new Map<string, { projectId: string; projectName: string }>()
  for (const row of rows) {
    if (!row.primaryTenantId || map.has(row.primaryTenantId)) continue
    map.set(row.primaryTenantId, {
      projectId: row.projectId,
      projectName: row.projectName,
    })
  }
  return map
}

async function validateFormReferences(form: TenantProjectImportFormValues): Promise<string | null> {
  const bl = await db.query.businessLine.findFirst({
    where: and(eq(businessLine.id, form.businessLineId), eq(businessLine.status, 'active')),
    columns: { id: true },
  })
  if (!bl) return '所选业务线不存在或已停用'

  const staffIds = [
    form.preSalesStaffId,
    form.accountManagerStaffId,
    form.deliveryManagerStaffId,
    form.projectManagerStaffId,
  ].filter(Boolean)
  if (staffIds.length > 0) {
    const staffRows = await db
      .select({ id: userStaff.id })
      .from(userStaff)
      .where(and(inArray(userStaff.id, staffIds), eq(userStaff.status, 'active')))

    const found = new Set(staffRows.map((r) => r.id))
    for (const id of staffIds) {
      if (!found.has(id)) return '所选员工不存在或已停用，请重新选择'
    }
  }

  if (form.tagId) {
    const tags = await projectTagsDataAccess.listAll()
    const allowedNames = new Set<string>(DEFAULT_PROJECT_TAG_NAMES)
    const tag = tags.find((t) => t.id === form.tagId)
    if (!tag || !allowedNames.has(tag.name)) return '所选项目标签无效'
  }

  return null
}

function buildPreviewRow(
  platformTenantId: string,
  platform: PlatformTenantApiRecord | undefined,
  local:
    | { tenantId: string; customerId: string; customerName: string }
    | undefined,
  existing: { projectId: string; projectName: string } | undefined,
): TenantProjectImportPreviewRow {
  if (!platform) {
    return {
      platformTenantId,
      tenantName: '—',
      projectName: '—',
      action: 'error',
      errors: ['平台不存在该租户 ID'],
      warnings: [],
    }
  }

  const tenantName = resolveTenantName(platform)
  const projectName = buildProjectName(platform)

  if (!local) {
    return {
      platformTenantId,
      tenantName,
      projectName,
      action: 'error',
      errors: ['CRM 中未找到该租户，请先从平台导入租户'],
      warnings: [],
    }
  }

  if (existing) {
    return {
      platformTenantId,
      tenantName,
      customerId: local.customerId,
      customerName: local.customerName,
      projectName,
      action: 'skip',
      existingProjectId: existing.projectId,
      existingProjectName: existing.projectName,
      errors: [],
      warnings: [`项目已存在，将跳过（${existing.projectName}）`],
    }
  }

  return {
    platformTenantId,
    tenantName,
    customerId: local.customerId,
    customerName: local.customerName,
    projectName,
    action: 'create',
    errors: [],
    warnings: [],
  }
}

function summarizeRows(rows: TenantProjectImportPreviewRow[]) {
  return {
    total: rows.length,
    toCreate: rows.filter((r) => r.action === 'create').length,
    toSkip: rows.filter((r) => r.action === 'skip').length,
    error: rows.filter((r) => r.action === 'error').length,
  }
}

export const tenantProjectImportDataAccess = {
  async preview(input: {
    rawTenantIds: string
    form: TenantProjectImportFormValues
  }): Promise<TenantProjectImportPreviewResult> {
    purgeExpiredPreviews()

    const formError = await validateFormReferences(input.form)
    if (formError) throw new Error(formError)

    const platformTenantIds = parsePlatformTenantIds(input.rawTenantIds)
    assertPlatformTenantIdCount(platformTenantIds)

    const traceId = crypto.randomUUID().slice(0, 8)
    crmLog('tenant-project-import', 'preview start', {
      traceId,
      count: platformTenantIds.length,
    })

    let platformMap: Map<string, PlatformTenantApiRecord>
    try {
      platformMap = await fetchPlatformTenantsByIds(platformTenantIds)
    } catch (e) {
      crmError('tenant-project-import', 'preview api failed', e, { traceId })
      if (e instanceof SuanliOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台租户失败')
    }

    const localMap = await loadLocalTenantsByPlatformIds(platformTenantIds)
    const tenantIds = [...localMap.values()].map((l) => l.tenantId)
    const existingMap = await loadExistingProjectsByTenantIds(tenantIds)

    const rows = platformTenantIds.map((id) => {
      const local = localMap.get(id)
      const existing = local ? existingMap.get(local.tenantId) : undefined
      return buildPreviewRow(id, platformMap.get(id), local, existing)
    })

    const previewId = crypto.randomUUID()
    const result: TenantProjectImportPreviewResult = {
      previewId,
      formSnapshot: { ...input.form, platformTenantIds },
      rows,
      summary: summarizeRows(rows),
    }

    previewCache.set(previewId, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      traceId,
      result,
    })

    crmLog('tenant-project-import', 'preview done', {
      traceId,
      previewId,
      ...result.summary,
    })

    return result
  },

  async commit(previewId: string): Promise<TenantProjectImportCommitResult> {
    purgeExpiredPreviews()

    const cached = previewCache.get(previewId)
    if (!cached || cached.expiresAt <= Date.now()) {
      previewCache.delete(previewId)
      throw new Error('预览已过期，请重新拉取')
    }

    const { traceId, result: preview } = cached
    const form = preview.formSnapshot
    const creatable = preview.rows.filter((r) => r.action === 'create')

    crmLog('tenant-project-import', 'commit start', {
      traceId,
      previewId,
      creatable: creatable.length,
      skipped: preview.summary.toSkip,
    })

    const formError = await validateFormReferences(form)
    if (formError) throw new Error(formError)

    const localMap = await loadLocalTenantsByPlatformIds(form.platformTenantIds)
    const tenantIds = [...localMap.values()].map((l) => l.tenantId)
    const existingMap = await loadExistingProjectsByTenantIds(tenantIds)

    let created = 0
    let skipped = preview.rows.filter((r) => r.action === 'skip').length
    const errors: TenantProjectImportCommitResult['errors'] = []

    for (const row of preview.rows.filter((r) => r.action === 'error')) {
      errors.push({
        platformTenantId: row.platformTenantId,
        message: row.errors[0] ?? '无法导入',
      })
    }

    for (const row of creatable) {
      try {
        const local = localMap.get(row.platformTenantId)
        if (!local) {
          errors.push({
            platformTenantId: row.platformTenantId,
            message: 'CRM 中未找到该租户，请重新预览',
          })
          continue
        }

        const existing = existingMap.get(local.tenantId)
        if (existing) {
          skipped++
          crmWarn('tenant-project-import', 'commit skip existing', {
            traceId,
            platformTenantId: row.platformTenantId,
            projectId: existing.projectId,
          })
          continue
        }

        const createdProject = await projectsDataAccess.create({
          customerId: local.customerId,
          primaryTenantId: local.tenantId,
          name: row.projectName,
          description: '',
          stage: form.stage,
          businessLineId: form.businessLineId,
          startDate: form.startDate,
          staff: {
            preSalesStaffId: form.preSalesStaffId,
            accountManagerStaffId: form.accountManagerStaffId,
            deliveryManagerStaffId: form.deliveryManagerStaffId,
            projectManagerStaffId: form.projectManagerStaffId,
          },
        })

        if (form.tagId) {
          await projectTagsDataAccess.setForProject(createdProject.id, [form.tagId])
        }

        existingMap.set(local.tenantId, {
          projectId: 'created',
          projectName: row.projectName,
        })
        created++
      } catch (e) {
        crmWarn('tenant-project-import', 'commit row failed', {
          traceId,
          platformTenantId: row.platformTenantId,
          err: e instanceof Error ? e.message : String(e),
        })
        errors.push({
          platformTenantId: row.platformTenantId,
          message: e instanceof Error ? e.message : '创建项目失败',
        })
      }
    }

    previewCache.delete(previewId)

    crmLog('tenant-project-import', 'commit done', {
      traceId,
      created,
      skipped,
      errors: errors.length,
    })

    return { created, skipped, errors }
  },
}
