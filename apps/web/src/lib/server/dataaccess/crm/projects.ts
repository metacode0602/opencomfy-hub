import { db } from '@/lib/db'
import type { Project } from '@/lib/data/types'
import type { ProjectStage } from '@/lib/types/crm'
import { mapProjectRow } from '@/lib/server/mappers/crm'
import {
  billingTenant,
  businessLine,
  consumptionUsageDaily,
  crmProject,
  customer,
  projectStaffAssignment,
  projectTag,
  projectTagAssignment,
  projectTenant,
  userStaff,
} from '@workspace/db/schema'
function newId() {
  return crypto.randomUUID()
}
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql, sum } from 'drizzle-orm'
import type { ProjectTag } from '@/lib/data/types'

export type ProjectListFilters = {
  search?: string
  stage?: string
  status?: string
  tagIds?: string[]
  staffId?: string
}

export type ProjectStaffFilterOption = {
  id: string
  displayName: string
}

const PROJECT_STAFF_FILTER_ROLES = [
  'pre_sales',
  'account_manager',
  'delivery_manager',
  'project_manager',
] as const

export type ProjectStaffInput = {
  preSalesStaffId: string
  accountManagerStaffId: string
  deliveryManagerStaffId: string
  projectManagerStaffId: string
}

export type ProjectUpsertInput = {
  customerId: string
  primaryTenantId?: string
  name: string
  description: string
  stage: ProjectStage
  status?: 'active' | 'paused' | 'completed'
  businessLineId: string
  monthlyBudget?: number
  startDate: string
  endDate?: string
  staff: ProjectStaffInput
}

const STAFF_ROLES = [
  { key: 'preSalesStaffId' as const, role: 'pre_sales' },
  { key: 'accountManagerStaffId' as const, role: 'account_manager' },
  { key: 'deliveryManagerStaffId' as const, role: 'delivery_manager' },
  { key: 'projectManagerStaffId' as const, role: 'project_manager' },
]

async function getBillingTenantIdsForProject(projectId: string): Promise<string[]> {
  const project = await db.query.crmProject.findFirst({ where: eq(crmProject.id, projectId) })
  if (!project) return []

  const ids = new Set<string>()
  if (project.primaryTenantId) ids.add(project.primaryTenantId)

  const links = await db
    .select({ tenantId: projectTenant.tenantId })
    .from(projectTenant)
    .where(eq(projectTenant.projectId, projectId))
  for (const l of links) ids.add(l.tenantId)

  if (ids.size === 0) {
    const defaults = await db
      .select({ id: billingTenant.id })
      .from(billingTenant)
      .where(and(eq(billingTenant.customerId, project.customerId), eq(billingTenant.isDefault, true)))
    for (const d of defaults) ids.add(d.id)
  }
  return [...ids]
}

async function loadProjectIdsWithStaff(staffId: string): Promise<Set<string>> {
  const rows = await db
    .select({ projectId: projectStaffAssignment.projectId })
    .from(projectStaffAssignment)
    .where(
      and(
        eq(projectStaffAssignment.userStaffId, staffId),
        inArray(projectStaffAssignment.roleType, [...PROJECT_STAFF_FILTER_ROLES]),
        isNull(projectStaffAssignment.effectiveTo),
      ),
    )

  return new Set(rows.map((r) => r.projectId))
}

async function loadProjectIdsWithAnyTag(tagIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(tagIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Set()

  const rows = await db
    .select({ projectId: projectTagAssignment.projectId })
    .from(projectTagAssignment)
    .where(inArray(projectTagAssignment.tagId, uniqueIds))

  return new Set(rows.map((r) => r.projectId))
}

async function loadTagsByProjectIds(projectIds: string[]): Promise<Map<string, ProjectTag[]>> {
  const result = new Map<string, ProjectTag[]>()
  if (projectIds.length === 0) return result

  const rows = await db
    .select({
      projectId: projectTagAssignment.projectId,
      id: projectTag.id,
      name: projectTag.name,
      sortOrder: projectTag.sortOrder,
    })
    .from(projectTagAssignment)
    .innerJoin(projectTag, eq(projectTagAssignment.tagId, projectTag.id))
    .where(inArray(projectTagAssignment.projectId, projectIds))
    .orderBy(asc(projectTag.sortOrder), asc(projectTag.name))

  for (const projectId of projectIds) {
    result.set(projectId, [])
  }

  for (const row of rows) {
    const list = result.get(row.projectId) ?? []
    if (!list.some((tag) => tag.id === row.id)) {
      list.push({ id: row.id, name: row.name })
    }
    result.set(row.projectId, list)
  }

  return result
}

async function loadProjectEnrichment(projectIds: string[]) {
  if (projectIds.length === 0) {
    return {
      staffMap: new Map<string, Record<string, string>>(),
      consumptionMap: new Map<string, number>(),
      customerMap: new Map<string, { name: string; type: string }>(),
      lineMap: new Map<string, string>(),
      tagsMap: new Map<string, ProjectTag[]>(),
      platformTenantIdMap: new Map<string, string | undefined>(),
    }
  }

  const projects = await db.select().from(crmProject).where(inArray(crmProject.id, projectIds))
  const customerIds = [...new Set(projects.map((p) => p.customerId))]
  const lineIds = [...new Set(projects.map((p) => p.businessLineId))]

  const customers = await db.select().from(customer).where(inArray(customer.id, customerIds))
  const lines = await db.select().from(businessLine).where(inArray(businessLine.id, lineIds))

  const assignments = await db
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

  const staffMap = new Map<string, Record<string, string>>()
  for (const a of assignments) {
    const cur = staffMap.get(a.projectId) ?? {}
    cur[a.roleType] = a.displayName
    staffMap.set(a.projectId, cur)
  }

  const tenantIdsByProject = new Map<string, string[]>()
  for (const pid of projectIds) {
    tenantIdsByProject.set(pid, await getBillingTenantIdsForProject(pid))
  }
  const allTenantIds = [...new Set([...tenantIdsByProject.values()].flat())]

  const consumptionSums =
    allTenantIds.length > 0
      ? await db
          .select({
            tenantId: consumptionUsageDaily.tenantId,
            value: sum(consumptionUsageDaily.amount),
          })
          .from(consumptionUsageDaily)
          .where(inArray(consumptionUsageDaily.tenantId, allTenantIds))
          .groupBy(consumptionUsageDaily.tenantId)
      : []

  const consumptionByTenant = new Map(
    consumptionSums.map((r) => [r.tenantId, Number(r.value ?? 0)]),
  )
  const consumptionMap = new Map<string, number>()
  for (const [projectId, tenantIds] of tenantIdsByProject) {
    consumptionMap.set(
      projectId,
      tenantIds.reduce((acc, tenantId) => acc + (consumptionByTenant.get(tenantId) ?? 0), 0),
    )
  }

  const tagsMap = await loadTagsByProjectIds(projectIds)

  const tenantIdsNeeded = new Set<string>()
  const projectTenantId = new Map<string, string>()
  for (const p of projects) {
    if (p.primaryTenantId) {
      tenantIdsNeeded.add(p.primaryTenantId)
      projectTenantId.set(p.id, p.primaryTenantId)
    }
  }

  const projectsWithoutPrimary = projects.filter((p) => !p.primaryTenantId)
  if (projectsWithoutPrimary.length > 0) {
    const defaultCustomerIds = [...new Set(projectsWithoutPrimary.map((p) => p.customerId))]
    const defaults = await db
      .select({ customerId: billingTenant.customerId, id: billingTenant.id })
      .from(billingTenant)
      .where(and(inArray(billingTenant.customerId, defaultCustomerIds), eq(billingTenant.isDefault, true)))
    const defaultByCustomer = new Map(defaults.map((d) => [d.customerId, d.id]))
    for (const p of projectsWithoutPrimary) {
      const tenantId = defaultByCustomer.get(p.customerId)
      if (tenantId) {
        tenantIdsNeeded.add(tenantId)
        projectTenantId.set(p.id, tenantId)
      }
    }
  }

  const tenantRows =
    tenantIdsNeeded.size > 0
      ? await db
          .select({ id: billingTenant.id, platformTenantId: billingTenant.platformTenantId })
          .from(billingTenant)
          .where(inArray(billingTenant.id, [...tenantIdsNeeded]))
      : []
  const platformIdByTenantId = new Map(
    tenantRows.map((r) => [r.id, r.platformTenantId ?? undefined]),
  )
  const platformTenantIdMap = new Map<string, string | undefined>()
  for (const [projectId, tenantId] of projectTenantId) {
    platformTenantIdMap.set(projectId, platformIdByTenantId.get(tenantId))
  }

  return {
    staffMap,
    consumptionMap,
    customerMap: new Map(customers.map((c) => [c.id, { name: c.name, type: c.type }])),
    lineMap: new Map(lines.map((l) => [l.id, l.name])),
    tagsMap,
    platformTenantIdMap,
  }
}

function mapToProject(
  row: typeof crmProject.$inferSelect,
  enrich: Awaited<ReturnType<typeof loadProjectEnrichment>>,
): Project {
  const staff = enrich.staffMap.get(row.id) ?? {}
  const cust = enrich.customerMap.get(row.customerId)
  return mapProjectRow({
    ...row,
    customerName: cust?.name ?? '',
    customerType: cust?.type ?? 'B',
    businessLineName: enrich.lineMap.get(row.businessLineId) ?? '',
    preSalesManager: staff.pre_sales ?? '',
    accountManager: staff.account_manager ?? '',
    deliveryManager: staff.delivery_manager ?? '',
    projectManager: staff.project_manager ?? '',
    totalConsumption: enrich.consumptionMap.get(row.id) ?? 0,
    platformTenantId: enrich.platformTenantIdMap.get(row.id),
    tags: enrich.tagsMap.get(row.id) ?? [],
  })
}

async function upsertStaffAssignments(
  projectId: string,
  staff: ProjectStaffInput,
  effectiveFrom: Date,
) {
  for (const { key, role } of STAFF_ROLES) {
    const userStaffId = staff[key]
    await db
      .update(projectStaffAssignment)
      .set({ effectiveTo: new Date() })
      .where(
        and(
          eq(projectStaffAssignment.projectId, projectId),
          eq(projectStaffAssignment.roleType, role),
          isNull(projectStaffAssignment.effectiveTo),
        ),
      )
    if (!userStaffId) continue
    await db.insert(projectStaffAssignment).values({
      id: newId(),
      projectId,
      userStaffId,
      roleType: role,
      effectiveFrom,
      effectiveTo: null,
    })
  }
}

export { refreshProjectMonthlyMetrics } from './project-monthly-metrics'

export const projectsDataAccess = {
  getBillingTenantIdsForProject,

  async listBillingTenantsForProject(projectId: string): Promise<
    Array<{
      id: string
      name: string
      platformTenantId?: string
      billingSyncCursorEndDate?: string | null
      billingSyncLastFinishedAt?: string | null
      billingSyncLastStatus?: string | null
      billingSyncLastError?: string | null
    }>
  > {
    const tenantIds = await getBillingTenantIdsForProject(projectId)
    if (tenantIds.length === 0) return []

    const rows = await db
      .select({
        id: billingTenant.id,
        name: billingTenant.name,
        platformTenantId: billingTenant.platformTenantId,
        billingSyncCursorEndDate: billingTenant.billingSyncCursorEndDate,
        billingSyncLastFinishedAt: billingTenant.billingSyncLastFinishedAt,
        billingSyncLastStatus: billingTenant.billingSyncLastStatus,
        billingSyncLastError: billingTenant.billingSyncLastError,
      })
      .from(billingTenant)
      .where(inArray(billingTenant.id, tenantIds))

    const rowById = new Map(rows.map((row) => [row.id, row]))
    return tenantIds
      .map((id) => rowById.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map((row) => ({
        id: row.id,
        name: row.name,
        platformTenantId: row.platformTenantId ?? undefined,
        billingSyncCursorEndDate: row.billingSyncCursorEndDate ?? null,
        billingSyncLastFinishedAt: row.billingSyncLastFinishedAt?.toISOString() ?? null,
        billingSyncLastStatus: row.billingSyncLastStatus ?? null,
        billingSyncLastError: row.billingSyncLastError ?? null,
      }))
  },

  async listRecent(limit = 5): Promise<Project[]> {
    const rows = await db
      .select()
      .from(crmProject)
      .orderBy(desc(crmProject.updatedAt), desc(crmProject.createdAt))
      .limit(limit)
    const enrich = await loadProjectEnrichment(rows.map((r) => r.id))
    return rows.map((row) => mapToProject(row, enrich))
  },

  async list(filters: ProjectListFilters = {}): Promise<Project[]> {

    const conditions = []
    if (filters.stage && filters.stage !== 'all') {
      conditions.push(eq(crmProject.stage, filters.stage))
    }
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(crmProject.status, filters.status))
    } else {
      conditions.push(ne(crmProject.status, 'paused'))
    }
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`
      const matchingTenants = await db
        .select({
          id: billingTenant.id,
          customerId: billingTenant.customerId,
          isDefault: billingTenant.isDefault,
        })
        .from(billingTenant)
        .where(ilike(billingTenant.platformTenantId, q))

      const matchingTenantIds = matchingTenants.map((t) => t.id)
      const matchingDefaultCustomerIds = matchingTenants
        .filter((t) => t.isDefault)
        .map((t) => t.customerId)

      const searchConditions = [ilike(crmProject.name, q), ilike(customer.name, q)]
      if (matchingTenantIds.length > 0) {
        searchConditions.push(inArray(crmProject.primaryTenantId, matchingTenantIds))
      }
      if (matchingDefaultCustomerIds.length > 0) {
        searchConditions.push(
          and(
            isNull(crmProject.primaryTenantId),
            inArray(crmProject.customerId, matchingDefaultCustomerIds),
          )!,
        )
      }
      conditions.push(or(...searchConditions)!)
    }
    if (filters.tagIds && filters.tagIds.length > 0) {
      const projectIdsWithTag = await loadProjectIdsWithAnyTag(filters.tagIds)
      if (projectIdsWithTag.size === 0) return []
      conditions.push(inArray(crmProject.id, [...projectIdsWithTag]))
    }
    if (filters.staffId) {
      const projectIdsWithStaff = await loadProjectIdsWithStaff(filters.staffId)
      if (projectIdsWithStaff.size === 0) return []
      conditions.push(inArray(crmProject.id, [...projectIdsWithStaff]))
    }

    const rows = await db
      .select({ project: crmProject })
      .from(crmProject)
      .leftJoin(customer, eq(crmProject.customerId, customer.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${crmProject.createdAt} desc`)

    const projectRows = rows.map((r) => r.project)
    const enrich = await loadProjectEnrichment(projectRows.map((p) => p.id))
    return projectRows.map((row) => mapToProject(row, enrich))
  },

  async listByCustomerId(customerId: string): Promise<Project[]> {
    const rows = await db.select().from(crmProject).where(eq(crmProject.customerId, customerId))
    const enrich = await loadProjectEnrichment(rows.map((r) => r.id))
    return rows.map((row) => mapToProject(row, enrich))
  },

  async getById(id: string): Promise<Project | null> {
    const row = await db.query.crmProject.findFirst({ where: eq(crmProject.id, id) })
    if (!row) return null
    const enrich = await loadProjectEnrichment([id])
    return mapToProject(row, enrich)
  },

  async create(input: ProjectUpsertInput): Promise<Project> {
    const id = newId()
    const now = new Date()

    let primaryTenantId = input.primaryTenantId
    if (!primaryTenantId) {
      const def = await db.query.billingTenant.findFirst({
        where: and(
          eq(billingTenant.customerId, input.customerId),
          eq(billingTenant.isDefault, true),
        ),
      })
      primaryTenantId = def?.id
    }

    await db.transaction(async (tx) => {
      await tx.insert(crmProject).values({
        id,
        customerId: input.customerId,
        primaryTenantId: primaryTenantId ?? null,
        businessLineId: input.businessLineId,
        name: input.name.trim(),
        description: input.description.trim(),
        stage: input.stage,
        status: input.status ?? 'active',
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        monthlyBudget: input.monthlyBudget != null ? String(input.monthlyBudget) : null,
        balance: '0',
        createdAt: now,
      })

      for (const { key, role } of STAFF_ROLES) {
        const userStaffId = input.staff[key]
        if (!userStaffId) continue
        await tx.insert(projectStaffAssignment).values({
          id: newId(),
          projectId: id,
          userStaffId,
          roleType: role,
          effectiveFrom: now,
          effectiveTo: null,
        })
      }
    })

    const created = await this.getById(id)
    if (!created) throw new Error('创建项目失败')
    return created
  },

  async update(id: string, input: ProjectUpsertInput): Promise<Project> {
    let primaryTenantId = input.primaryTenantId
    if (!primaryTenantId) {
      const def = await db.query.billingTenant.findFirst({
        where: and(
          eq(billingTenant.customerId, input.customerId),
          eq(billingTenant.isDefault, true),
        ),
      })
      primaryTenantId = def?.id
    }

    await db.transaction(async (tx) => {
      await tx
        .update(crmProject)
        .set({
          customerId: input.customerId,
          primaryTenantId: primaryTenantId ?? null,
          businessLineId: input.businessLineId,
          name: input.name.trim(),
          description: input.description.trim(),
          stage: input.stage,
          status: input.status ?? 'active',
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          monthlyBudget: input.monthlyBudget != null ? String(input.monthlyBudget) : null,
        })
        .where(eq(crmProject.id, id))

      await upsertStaffAssignments(id, input.staff, new Date())
    })

    const updated = await this.getById(id)
    if (!updated) throw new Error('项目不存在')
    return updated
  },

  async updateStage(id: string, stage: Project['stage']): Promise<Project> {
    await db.update(crmProject).set({ stage }).where(eq(crmProject.id, id))
    const updated = await this.getById(id)
    if (!updated) throw new Error('项目不存在')
    return updated
  },

  async updateStatus(id: string, status: Project['status']): Promise<Project> {
    await db.update(crmProject).set({ status }).where(eq(crmProject.id, id))
    const updated = await this.getById(id)
    if (!updated) throw new Error('项目不存在')
    return updated
  },

  async listStaffFilterOptions(): Promise<ProjectStaffFilterOption[]> {
    const rows = await db
      .selectDistinct({
        id: userStaff.id,
        displayName: userStaff.displayName,
      })
      .from(projectStaffAssignment)
      .innerJoin(userStaff, eq(projectStaffAssignment.userStaffId, userStaff.id))
      .where(
        and(
          inArray(projectStaffAssignment.roleType, [...PROJECT_STAFF_FILTER_ROLES]),
          isNull(projectStaffAssignment.effectiveTo),
        ),
      )
      .orderBy(asc(userStaff.displayName))

    return rows
  },

  async countByStage(): Promise<{ lead: number; testing: number; converted: number }> {
    const rows = await db
      .select({ stage: crmProject.stage, value: count() })
      .from(crmProject)
      .where(ne(crmProject.status, 'paused'))
      .groupBy(crmProject.stage)
    const map = new Map(rows.map((r) => [r.stage, Number(r.value)]))
    return {
      lead: map.get('lead') ?? 0,
      testing: map.get('testing') ?? 0,
      converted: map.get('converted') ?? 0,
    }
  },
}
