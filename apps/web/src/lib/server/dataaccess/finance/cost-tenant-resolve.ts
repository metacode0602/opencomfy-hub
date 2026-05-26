import { db } from '@/lib/db'
import {
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
import type { PendingCostAllocationIssue } from './cost-allocation-errors'

export type CostTenantProjectBinding = {
  tenantPlatformId: string
  tenantId: string
  customerId: string | null
  customerFullName: string | null
  projects: {
    projectId: string
    projectName: string
    staffId: string | null
    staffName: string | null
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
    staffName: string | null
  }[]
> {
  const tenant = await db.query.billingTenant.findFirst({
    where: eq(billingTenant.platformTenantId, platformTenantId),
  })
  if (!tenant) return []

  return db
    .selectDistinct({
      tenantId: billingTenant.id,
      customerId: billingTenant.customerId,
      customerFullName: customer.name,
      projectId: crmProject.id,
      projectName: crmProject.name,
      staffId: projectStaffAssignment.userStaffId,
      staffName: userStaff.displayName,
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
        sql`${crmProject.status} NOT IN ('archived', 'paused')`,
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )
}

export async function resolveCostTenantBindings(input: {
  billingPeriodId: string
  tenantPlatformIds: string[]
  periodEnd: string
}): Promise<CostTenantProjectBinding[]> {
  const { billingPeriodId, tenantPlatformIds, periodEnd } = input
  const bindings: CostTenantProjectBinding[] = []

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

    const allocByProject = new Map<string, string>()
    for (const a of periodAllocations) {
      allocByProject.set(a.projectId, a.allocationPercent)
    }
    for (const p of presets) {
      if (!allocByProject.has(p.projectId)) {
        allocByProject.set(p.projectId, p.allocationPercent)
      }
    }

    if (projects.length === 1) {
      allocByProject.set(projects[0]!.projectId, '100')
    }

    bindings.push({
      tenantPlatformId: platformId,
      tenantId,
      customerId,
      customerFullName,
      projects: projects.map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        staffId: p.staffId,
        staffName: p.staffName,
        allocationPercent: allocByProject.get(p.projectId) ?? null,
      })),
    })
  }

  return bindings
}

export async function getPendingCostAllocationIssues(input: {
  billingPeriodId: string
  tenantPlatformIds: string[]
  periodEnd: string
}): Promise<PendingCostAllocationIssue[]> {
  if (input.tenantPlatformIds.length === 0) return []

  const bindings = await resolveCostTenantBindings(input)
  const platformIds = bindings.map((b) => b.tenantPlatformId)
  const tenantMeta = await loadBillingTenantMetaByPlatformIds(platformIds)
  const issues: PendingCostAllocationIssue[] = []

  for (const binding of bindings) {
    if (binding.projects.length < 2) continue

    const meta = tenantMeta.get(binding.tenantPlatformId)
    const missingProjects = binding.projects.filter((p) => p.allocationPercent == null)
    const configured = binding.projects.filter((p) => p.allocationPercent != null)
    const allocationSumPercent = configured.reduce(
      (sum, p) => sum + Number(p.allocationPercent),
      0,
    )

    if (missingProjects.length > 0) {
      issues.push({
        tenantPlatformId: binding.tenantPlatformId,
        tenantId: binding.tenantId,
        tenantName: meta?.tenantName ?? null,
        customerFullName: binding.customerFullName ?? meta?.customerFullName ?? null,
        reason: 'missing_project',
        projects: binding.projects.map((p) => ({
          projectId: p.projectId,
          projectName: p.projectName,
          staffName: p.staffName,
          allocationPercent: p.allocationPercent,
        })),
        missingProjects: missingProjects.map((p) => ({
          projectId: p.projectId,
          projectName: p.projectName,
          staffName: p.staffName,
          allocationPercent: p.allocationPercent,
        })),
        allocationSumPercent: configured.length > 0 ? allocationSumPercent : null,
      })
      continue
    }

    if (Math.abs(allocationSumPercent - 100) > 0.0001) {
      issues.push({
        tenantPlatformId: binding.tenantPlatformId,
        tenantId: binding.tenantId,
        tenantName: meta?.tenantName ?? null,
        customerFullName: binding.customerFullName ?? meta?.customerFullName ?? null,
        reason: 'sum_not_100',
        projects: binding.projects.map((p) => ({
          projectId: p.projectId,
          projectName: p.projectName,
          staffName: p.staffName,
          allocationPercent: p.allocationPercent,
        })),
        missingProjects: [],
        allocationSumPercent,
      })
    }
  }

  return issues.sort((a, b) => a.tenantPlatformId.localeCompare(b.tenantPlatformId))
}

async function loadBillingTenantMetaByPlatformIds(platformIds: string[]): Promise<
  Map<
    string,
    {
      tenantId: string
      tenantName: string
      customerFullName: string | null
    }
  >
> {
  const map = new Map<
    string,
    { tenantId: string; tenantName: string; customerFullName: string | null }
  >()
  if (platformIds.length === 0) return map

  const rows = await db
    .select({
      platformTenantId: billingTenant.platformTenantId,
      tenantId: billingTenant.id,
      tenantName: billingTenant.name,
      customerFullName: customer.name,
    })
    .from(billingTenant)
    .leftJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.platformTenantId, platformIds))

  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      customerFullName: row.customerFullName,
    })
  }
  return map
}

export async function getPendingCostAllocationTenants(input: {
  billingPeriodId: string
  tenantPlatformIds: string[]
  periodEnd: string
}): Promise<string[]> {
  const issues = await getPendingCostAllocationIssues(input)
  return issues.map((issue) => issue.tenantPlatformId)
}

function parseAllocPercent(value: string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return n / 100
}

export type CostStaffSplit = {
  tenantId: string
  projectId: string
  staffId: string
  staffName: string
  ratio: number
}

export function splitTenantBindingToStaff(
  binding: CostTenantProjectBinding,
  issues: string[],
): CostStaffSplit[] {
  if (binding.projects.length === 0) {
    issues.push(`租户 ${binding.tenantPlatformId} 无 CRM 项目绑定，跳过`)
    return []
  }

  const splits: CostStaffSplit[] = []
  for (const proj of binding.projects) {
    let ratio = parseAllocPercent(proj.allocationPercent)
    if (ratio == null) {
      if (binding.projects.length === 1) ratio = 1
      else continue
    }
    if (!proj.staffId) {
      issues.push(`项目 ${proj.projectName} 无客户经理，跳过成本分项`)
      continue
    }
    splits.push({
      tenantId: binding.tenantId,
      projectId: proj.projectId,
      staffId: proj.staffId,
      staffName: proj.staffName ?? proj.staffId,
      ratio,
    })
  }
  return splits
}
