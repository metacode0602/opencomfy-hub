import { db } from '@/lib/db'
import type { Project } from '@/lib/data/types'
import { mapProjectRow } from '@/lib/server/mappers/crm'
import { ensureCrmSeeded } from './ensure-seeded'
import {
  billingTenant,
  businessLine,
  consumptionRecord,
  crmProject,
  customer,
  projectStaffAssignment,
  projectTenant,
  userStaff,
} from '@workspace/db/schema'
function newId() {
  return crypto.randomUUID()
}
import { and, count, eq, ilike, inArray, isNull, or, sql, sum } from 'drizzle-orm'

export type ProjectListFilters = {
  search?: string
  stage?: string
  status?: string
}

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
  stage: 'lead' | 'testing' | 'converted'
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

async function loadProjectEnrichment(projectIds: string[]) {
  if (projectIds.length === 0) {
    return {
      staffMap: new Map<string, Record<string, string>>(),
      consumptionMap: new Map<string, number>(),
      customerMap: new Map<string, { name: string; type: string }>(),
      lineMap: new Map<string, string>(),
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
          .select({ projectId: consumptionRecord.projectId, value: sum(consumptionRecord.amount) })
          .from(consumptionRecord)
          .where(inArray(consumptionRecord.projectId, projectIds))
          .groupBy(consumptionRecord.projectId)
      : []

  return {
    staffMap,
    consumptionMap: new Map(consumptionSums.map((r) => [r.projectId!, Number(r.value ?? 0)])),
    customerMap: new Map(customers.map((c) => [c.id, { name: c.name, type: c.type }])),
    lineMap: new Map(lines.map((l) => [l.id, l.name])),
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

export const projectsDataAccess = {
  getBillingTenantIdsForProject,

  async list(filters: ProjectListFilters = {}): Promise<Project[]> {
    await ensureCrmSeeded()

    const conditions = []
    if (filters.stage && filters.stage !== 'all') {
      conditions.push(eq(crmProject.stage, filters.stage))
    }
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(crmProject.status, filters.status))
    }
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`
      conditions.push(or(ilike(crmProject.name, q), ilike(customer.name, q))!)
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
    await ensureCrmSeeded()
    const rows = await db.select().from(crmProject).where(eq(crmProject.customerId, customerId))
    const enrich = await loadProjectEnrichment(rows.map((r) => r.id))
    return rows.map((row) => mapToProject(row, enrich))
  },

  async getById(id: string): Promise<Project | null> {
    await ensureCrmSeeded()
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
        await tx.insert(projectStaffAssignment).values({
          id: newId(),
          projectId: id,
          userStaffId: input.staff[key],
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

  async countByStage(): Promise<{ lead: number; testing: number; converted: number }> {
    await ensureCrmSeeded()
    const rows = await db
      .select({ stage: crmProject.stage, value: count() })
      .from(crmProject)
      .groupBy(crmProject.stage)
    const map = new Map(rows.map((r) => [r.stage, Number(r.value)]))
    return {
      lead: map.get('lead') ?? 0,
      testing: map.get('testing') ?? 0,
      converted: map.get('converted') ?? 0,
    }
  },
}
