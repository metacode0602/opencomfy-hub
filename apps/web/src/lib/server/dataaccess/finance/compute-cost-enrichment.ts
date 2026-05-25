import { db } from '@/lib/db'
import {
  billingPeriodCostEnrichment,
  billingTenant,
  billingTenantCostAllocation,
  crmProject,
  customer,
  projectStaffAssignment,
  projectTenant,
  tenantProjectCost,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { financeLog } from './logger'
import { newId } from './operation-log'

export type CostEnrichmentRow = typeof billingPeriodCostEnrichment.$inferSelect

export type CostTenantProjectBinding = {
  tenantPlatformId: string
  tenantId: string
  customerId: string | null
  customerFullName: string | null
  projects: {
    projectId: string
    projectName: string
    staffId: string | null
    accountManagerName: string | null
    allocationPercent: string | null
  }[]
}

async function listProjectsForPlatformTenant(platformTenantId: string): Promise<
  {
    tenantId: string
    customerId: string | null
    customerFullName: string | null
    projectId: string
    projectName: string
    staffId: string | null
    accountManagerName: string | null
  }[]
> {
  const tenant = await db.query.billingTenant.findFirst({
    where: eq(billingTenant.platformTenantId, platformTenantId),
  })
  if (!tenant) return []

  const rows = await db
    .selectDistinct({
      tenantId: billingTenant.id,
      customerId: billingTenant.customerId,
      customerFullName: customer.name,
      projectId: crmProject.id,
      projectName: crmProject.name,
      staffId: projectStaffAssignment.userStaffId,
      accountManagerName: userStaff.displayName,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
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
        eq(billingTenant.platformTenantId, platformTenantId),
        sql`${crmProject.status} <> 'archived'`,
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  return rows
}

export async function resolveAndPersistCostEnrichment(input: {
  billingPeriodId: string
  tenantPlatformIds: string[]
  periodEnd: string
}): Promise<CostTenantProjectBinding[]> {
  const { billingPeriodId, tenantPlatformIds, periodEnd } = input
  financeLog('compute-cost-enrichment', 'start', {
    periodId: billingPeriodId,
    tenantCount: tenantPlatformIds.length,
  })

  await db
    .delete(billingPeriodCostEnrichment)
    .where(eq(billingPeriodCostEnrichment.billingPeriodId, billingPeriodId))

  const bindings: CostTenantProjectBinding[] = []
  const enrichmentRows: (typeof billingPeriodCostEnrichment.$inferInsert)[] = []

  for (const platformId of [...new Set(tenantPlatformIds)]) {
    const projects = await listProjectsForPlatformTenant(platformId)
    if (projects.length === 0) {
      bindings.push({
        tenantPlatformId: platformId,
        tenantId: '',
        customerId: null,
        customerFullName: null,
        projects: [],
      })
      continue
    }

    const tenantId = projects[0]!.tenantId
    const customerId = projects[0]!.customerId
    const customerFullName = projects[0]!.customerFullName

    const periodAllocations = await db
      .select()
      .from(billingTenantCostAllocation)
      .where(
        and(
          eq(billingTenantCostAllocation.billingPeriodId, billingPeriodId),
          eq(billingTenantCostAllocation.tenantPlatformId, platformId),
        ),
      )

    const presets = await db
      .select()
      .from(tenantProjectCost)
      .where(
        and(
          eq(tenantProjectCost.tenantId, tenantId),
          isNull(tenantProjectCost.effectiveTo),
          lte(tenantProjectCost.effectiveFrom, periodEnd),
        ),
      )

    const allocByProject = new Map<string, { percent: string; presetId: string | null }>()
    for (const a of periodAllocations) {
      allocByProject.set(a.projectId, {
        percent: a.allocationPercent,
        presetId: a.presetId,
      })
    }
    for (const p of presets) {
      if (!allocByProject.has(p.projectId)) {
        allocByProject.set(p.projectId, { percent: p.allocationPercent, presetId: p.id })
      }
    }

    let source: 'auto_single' | 'auto_preset' | 'manual_period' = 'manual_period'
    if (projects.length === 1) {
      source = 'auto_single'
      allocByProject.set(projects[0]!.projectId, { percent: '100', presetId: null })
    } else if (presets.length > 0) {
      source = 'auto_preset'
    }

    const projectBindings = projects.map((p) => {
      const alloc = allocByProject.get(p.projectId)
      enrichmentRows.push({
        id: newId(),
        billingPeriodId,
        tenantPlatformId: platformId,
        tenantId,
        customerId,
        customerFullName,
        projectId: p.projectId,
        projectName: p.projectName,
        staffId: p.staffId,
        accountManagerName: p.accountManagerName,
        allocationPercent: alloc?.percent ?? null,
        source,
        resolvedAt: new Date(),
      })
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        staffId: p.staffId,
        accountManagerName: p.accountManagerName,
        allocationPercent: alloc?.percent ?? null,
      }
    })

    bindings.push({
      tenantPlatformId: platformId,
      tenantId,
      customerId,
      customerFullName,
      projects: projectBindings,
    })
  }

  if (enrichmentRows.length > 0) {
    await db.insert(billingPeriodCostEnrichment).values(enrichmentRows)
  }

  financeLog('compute-cost-enrichment', 'done', {
    periodId: billingPeriodId,
    enrichmentRows: enrichmentRows.length,
  })
  return bindings
}

export async function getPendingCostAllocationTenants(input: {
  billingPeriodId: string
  tenantPlatformIds: string[]
  periodEnd: string
}): Promise<string[]> {
  const pending: string[] = []

  for (const platformId of [...new Set(input.tenantPlatformIds)]) {
    const projects = await listProjectsForPlatformTenant(platformId)
    if (projects.length < 2) continue

    const tenantId = projects[0]!.tenantId
    const periodAllocations = await db
      .select()
      .from(billingTenantCostAllocation)
      .where(
        and(
          eq(billingTenantCostAllocation.billingPeriodId, input.billingPeriodId),
          eq(billingTenantCostAllocation.tenantPlatformId, platformId),
        ),
      )

    const presets = await db
      .select()
      .from(tenantProjectCost)
      .where(
        and(
          eq(tenantProjectCost.tenantId, tenantId),
          isNull(tenantProjectCost.effectiveTo),
          lte(tenantProjectCost.effectiveFrom, input.periodEnd),
        ),
      )

    const allocByProject = new Map<string, string>()
    for (const a of periodAllocations) {
      allocByProject.set(a.projectId, a.allocationPercent)
    }
    for (const p of presets) {
      if (!allocByProject.has(p.projectId)) {
        allocByProject.set(p.projectId, p.allocationPercent)
      }
    }

    const missing = projects.some((p) => !allocByProject.has(p.projectId))
    if (missing) pending.push(platformId)
  }

  return pending
}

export async function listCostEnrichments(
  billingPeriodId: string,
): Promise<CostTenantProjectBinding[]> {
  const rows = await db
    .select()
    .from(billingPeriodCostEnrichment)
    .where(eq(billingPeriodCostEnrichment.billingPeriodId, billingPeriodId))

  const byTenant = new Map<string, CostTenantProjectBinding>()
  for (const r of rows) {
    let entry = byTenant.get(r.tenantPlatformId)
    if (!entry) {
      entry = {
        tenantPlatformId: r.tenantPlatformId,
        tenantId: r.tenantId,
        customerId: r.customerId,
        customerFullName: r.customerFullName,
        projects: [],
      }
      byTenant.set(r.tenantPlatformId, entry)
    }
    entry.projects.push({
      projectId: r.projectId,
      projectName: r.projectName,
      staffId: r.staffId,
      accountManagerName: r.accountManagerName,
      allocationPercent:
        r.allocationPercent ?? (r.source === 'auto_single' ? '100' : null),
    })
  }
  return [...byTenant.values()]
}
