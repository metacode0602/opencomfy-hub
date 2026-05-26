import { db } from '@/lib/db'
import {
  billingPeriodTenantProjectEnrichment,
  billingTenant,
  billingTenantCostAllocation,
  crmProject,
  customer,
  projectStaffAssignment,
  projectTenant,
  tenantProjectCost,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { financeLog } from './logger'
import { newId } from './operation-log'

export type TenantProjectBinding = {
  tenantPlatformId: string
  tenantId: string
  projects: {
    projectId: string
    projectName: string
    staffId: string | null
    accountManagerName: string | null
    allocationPercent: string | null
    presetId: string | null
  }[]
}

async function listProjectsForPlatformTenant(
  platformTenantId: string,
): Promise<
  {
    tenantId: string
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
      projectId: crmProject.id,
      projectName: crmProject.name,
      staffId: projectStaffAssignment.userStaffId,
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
        eq(billingTenant.platformTenantId, platformTenantId),
        sql`${crmProject.status} NOT IN ('archived', 'paused')`,
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  return rows.map((r) => ({
    tenantId: r.tenantId,
    projectId: r.projectId,
    projectName: r.projectName,
    staffId: r.staffId,
    accountManagerName: r.accountManagerName,
  }))
}

export async function resolveAndPersistEnrichment(
  billingPeriodId: string,
  tenantPlatformIds: string[],
  periodEnd: string,
): Promise<TenantProjectBinding[]> {
  financeLog('enrichment', 'start', {
    periodId: billingPeriodId,
    tenantCount: tenantPlatformIds.length,
  })

  await db
    .delete(billingPeriodTenantProjectEnrichment)
    .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, billingPeriodId))

  const bindings: TenantProjectBinding[] = []
  const enrichmentRows: (typeof billingPeriodTenantProjectEnrichment.$inferInsert)[] = []

  for (const platformId of [...new Set(tenantPlatformIds)]) {
    const projects = await listProjectsForPlatformTenant(platformId)
    if (projects.length === 0) {
      bindings.push({ tenantPlatformId: platformId, tenantId: '', projects: [] })
      continue
    }

    const tenantId = projects[0]!.tenantId
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
        projectId: p.projectId,
        projectName: p.projectName,
        staffId: p.staffId,
        accountManagerName: p.accountManagerName,
        source,
        resolvedAt: new Date(),
      })
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        staffId: p.staffId,
        accountManagerName: p.accountManagerName,
        allocationPercent: alloc?.percent ?? null,
        presetId: alloc?.presetId ?? null,
      }
    })

    bindings.push({
      tenantPlatformId: platformId,
      tenantId,
      projects: projectBindings,
    })
  }

  if (enrichmentRows.length > 0) {
    await db.insert(billingPeriodTenantProjectEnrichment).values(enrichmentRows)
  }

  financeLog('enrichment', 'done', {
    periodId: billingPeriodId,
    enrichmentRows: enrichmentRows.length,
  })
  return bindings
}

export async function listTenantProjectBindings(
  billingPeriodId: string,
): Promise<TenantProjectBinding[]> {
  const rows = await db
    .select()
    .from(billingPeriodTenantProjectEnrichment)
    .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, billingPeriodId))

  const byTenant = new Map<string, TenantProjectBinding>()
  for (const r of rows) {
    let entry = byTenant.get(r.tenantPlatformId)
    if (!entry) {
      entry = {
        tenantPlatformId: r.tenantPlatformId,
        tenantId: r.tenantId,
        projects: [],
      }
      byTenant.set(r.tenantPlatformId, entry)
    }
    const alloc = await db.query.billingTenantCostAllocation.findFirst({
      where: and(
        eq(billingTenantCostAllocation.billingPeriodId, billingPeriodId),
        eq(billingTenantCostAllocation.tenantId, r.tenantId),
        eq(billingTenantCostAllocation.projectId, r.projectId),
      ),
    })
    entry.projects.push({
      projectId: r.projectId,
      projectName: r.projectName,
      staffId: r.staffId,
      accountManagerName: r.accountManagerName,
      allocationPercent: alloc?.allocationPercent ?? (r.source === 'auto_single' ? '100' : null),
      presetId: alloc?.presetId ?? null,
    })
  }
  return [...byTenant.values()]
}

export async function getTenantDisplayNames(tenantIds: string[]): Promise<
  Map<string, { tenantName: string; customerFullName: string | null }>
> {
  const map = new Map<string, { tenantName: string; customerFullName: string | null }>()
  if (tenantIds.length === 0) return map
  const rows = await db
    .select({
      tenantId: billingTenant.id,
      tenantName: billingTenant.name,
      customerName: customer.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.id, tenantIds))

  for (const r of rows) {
    map.set(r.tenantId, {
      tenantName: r.tenantName,
      customerFullName: r.customerName,
    })
  }
  return map
}
