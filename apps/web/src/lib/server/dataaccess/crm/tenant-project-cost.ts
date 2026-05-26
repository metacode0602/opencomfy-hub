import { db } from '@/lib/db'
import {
  billingTenant,
  crmProject,
  projectStaffAssignment,
  projectTenant,
  tenantProjectCost,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, isNull, or, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export type TenantProjectCostItem = {
  projectId: string
  projectName: string
  accountManagerName: string | null
  allocationPercent: string | null
  presetId: string | null
}

export type TenantProjectCostContext = {
  tenantId: string
  platformTenantId: string | null
  tenantName: string
  triggerProjectId: string
  projects: TenantProjectCostItem[]
}

async function resolveBillingTenantForProject(projectId: string): Promise<{
  tenantId: string
  platformTenantId: string | null
  tenantName: string
} | null> {
  const project = await db.query.crmProject.findFirst({
    where: eq(crmProject.id, projectId),
  })
  if (!project) return null

  let tenantId = project.primaryTenantId ?? null
  if (!tenantId) {
    const defaultTenant = await db.query.billingTenant.findFirst({
      where: and(
        eq(billingTenant.customerId, project.customerId),
        eq(billingTenant.isDefault, true),
      ),
    })
    tenantId = defaultTenant?.id ?? null
  }
  if (!tenantId) {
    const link = await db.query.projectTenant.findFirst({
      where: eq(projectTenant.projectId, projectId),
    })
    tenantId = link?.tenantId ?? null
  }
  if (!tenantId) return null

  const tenant = await db.query.billingTenant.findFirst({
    where: eq(billingTenant.id, tenantId),
  })
  if (!tenant) return null

  return {
    tenantId: tenant.id,
    platformTenantId: tenant.platformTenantId ?? null,
    tenantName: tenant.name,
  }
}

async function listLinkedProjectsForBillingTenant(tenantId: string): Promise<
  {
    projectId: string
    projectName: string
    accountManagerName: string | null
  }[]
> {
  const tenant = await db.query.billingTenant.findFirst({
    where: eq(billingTenant.id, tenantId),
  })
  if (!tenant) return []

  const rows = await db
    .selectDistinct({
      projectId: crmProject.id,
      projectName: crmProject.name,
      accountManagerName: userStaff.displayName,
    })
    .from(billingTenant)
    .innerJoin(crmProject, eq(crmProject.customerId, billingTenant.customerId))
    .leftJoin(
      projectTenant,
      and(
        eq(projectTenant.tenantId, billingTenant.id),
        eq(projectTenant.projectId, crmProject.id),
      ),
    )
    .leftJoin(
      projectStaffAssignment,
      and(
        eq(projectStaffAssignment.projectId, crmProject.id),
        eq(projectStaffAssignment.roleType, 'account_manager'),
        isNull(projectStaffAssignment.effectiveTo),
      ),
    )
    .leftJoin(userStaff, eq(userStaff.id, projectStaffAssignment.userStaffId))
    .where(
      and(
        eq(billingTenant.id, tenantId),
        sql`${crmProject.status} NOT IN ('archived', 'paused')`,
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  return rows.map((r) => ({
    projectId: r.projectId,
    projectName: r.projectName,
    accountManagerName: r.accountManagerName,
  }))
}

async function loadCurrentPresets(tenantId: string): Promise<
  Map<string, { allocationPercent: string; presetId: string }>
> {
  const rows = await db
    .select({
      id: tenantProjectCost.id,
      projectId: tenantProjectCost.projectId,
      allocationPercent: tenantProjectCost.allocationPercent,
    })
    .from(tenantProjectCost)
    .where(and(eq(tenantProjectCost.tenantId, tenantId), isNull(tenantProjectCost.effectiveTo)))

  return new Map(
    rows.map((r) => [
      r.projectId,
      { allocationPercent: r.allocationPercent, presetId: r.id },
    ]),
  )
}

function formatAllocationPercent(value: number): string {
  return value.toFixed(4)
}

export const tenantProjectCostDataAccess = {
  async getContextByProjectId(projectId: string): Promise<TenantProjectCostContext | null> {
    const tenant = await resolveBillingTenantForProject(projectId)
    if (!tenant) return null

    const linkedProjects = await listLinkedProjectsForBillingTenant(tenant.tenantId)
    const presets = await loadCurrentPresets(tenant.tenantId)

    const projects: TenantProjectCostItem[] = linkedProjects.map((p) => {
      const preset = presets.get(p.projectId)
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        accountManagerName: p.accountManagerName,
        allocationPercent: preset?.allocationPercent ?? null,
        presetId: preset?.presetId ?? null,
      }
    })

    if (projects.length === 1 && projects[0]!.allocationPercent == null) {
      projects[0] = {
        ...projects[0]!,
        allocationPercent: '100.0000',
      }
    }

    return {
      tenantId: tenant.tenantId,
      platformTenantId: tenant.platformTenantId,
      tenantName: tenant.tenantName,
      triggerProjectId: projectId,
      projects,
    }
  },

  async savePresets(input: {
    tenantId: string
    allocations: { projectId: string; allocationPercent: string }[]
    remark?: string
    createdBy?: string | null
  }): Promise<void> {
    const linkedProjects = await listLinkedProjectsForBillingTenant(input.tenantId)
    if (linkedProjects.length === 0) {
      throw new Error('该租户下没有可配置分成的项目')
    }

    const linkedProjectIds = new Set(linkedProjects.map((p) => p.projectId))
    const allocationByProject = new Map<string, number>()

    for (const item of input.allocations) {
      if (!linkedProjectIds.has(item.projectId)) {
        throw new Error('存在不属于该租户的项目分成配置')
      }
      const value = Number(item.allocationPercent)
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        throw new Error('分成比例须大于 0 且不超过 100')
      }
      allocationByProject.set(item.projectId, value)
    }

    if (linkedProjects.length === 1) {
      allocationByProject.set(linkedProjects[0]!.projectId, 100)
    } else {
      if (allocationByProject.size !== linkedProjects.length) {
        throw new Error('须为租户下每个项目配置分成比例')
      }
    }

    const total = [...allocationByProject.values()].reduce((sum, v) => sum + v, 0)
    if (Math.abs(total - 100) > 0.0001) {
      throw new Error(`分成比例合计须为 100%，当前为 ${total.toFixed(4)}%`)
    }

    const today = todayDateString()
    const rows = linkedProjects.map((p) => ({
      id: newId(),
      tenantId: input.tenantId,
      projectId: p.projectId,
      allocationPercent: formatAllocationPercent(allocationByProject.get(p.projectId)!),
      effectiveFrom: today,
      effectiveTo: null as string | null,
      remark: input.remark ?? null,
      createdBy: input.createdBy ?? null,
    }))

    await db.transaction(async (tx) => {
      await tx
        .update(tenantProjectCost)
        .set({ effectiveTo: today })
        .where(
          and(eq(tenantProjectCost.tenantId, input.tenantId), isNull(tenantProjectCost.effectiveTo)),
        )

      if (rows.length > 0) {
        await tx.insert(tenantProjectCost).values(rows)
      }
    })
  },

  async listPresetsByTenantId(tenantId: string): Promise<TenantProjectCostItem[]> {
    const linkedProjects = await listLinkedProjectsForBillingTenant(tenantId)
    const presets = await loadCurrentPresets(tenantId)

    return linkedProjects.map((p) => {
      const preset = presets.get(p.projectId)
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        accountManagerName: p.accountManagerName,
        allocationPercent: preset?.allocationPercent ?? null,
        presetId: preset?.presetId ?? null,
      }
    })
  },

  async listPresetsByTenantIds(tenantIds: string[]): Promise<Map<string, TenantProjectCostItem[]>> {
    const result = new Map<string, TenantProjectCostItem[]>()
    if (tenantIds.length === 0) return result

    const uniqueTenantIds = [...new Set(tenantIds)]
    for (const tenantId of uniqueTenantIds) {
      result.set(tenantId, await this.listPresetsByTenantId(tenantId))
    }
    return result
  },
}
