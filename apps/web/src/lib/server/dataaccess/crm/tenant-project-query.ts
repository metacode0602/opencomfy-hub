import { db } from '@/lib/db'
import type { OpportunitySource } from '@/lib/crm/commission-constants'
import {
  assertTenantProjectQueryIdCount,
  parseTenantProjectQueryIds,
} from '@/lib/crm/tenant-project-query-utils'
import { crmLog } from '@/lib/server/dataaccess/crm/logger'
import type { TenantProjectQueryResult, TenantProjectQueryRow } from '@/lib/types/tenant-project-query'
import {
  billingTenant,
  crmProject,
  projectOpportunitySourceAssignment,
  projectStaffAssignment,
  projectTenant,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'

type LocalTenant = {
  tenantId: string
  tenantName: string
}

type ProjectLink = {
  tenantId: string
  projectId: string
  projectName: string
  dealClosedMonth?: string
  opportunitySource?: OpportunitySource
}

async function loadLocalTenantsByPlatformIds(platformIds: string[]) {
  if (platformIds.length === 0) return new Map<string, LocalTenant>()

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      tenantName: billingTenant.name,
    })
    .from(billingTenant)
    .where(inArray(billingTenant.platformTenantId, platformIds))

  const map = new Map<string, LocalTenant>()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      tenantName: row.tenantName,
    })
  }
  return map
}

async function loadProjectsByTenantIds(tenantIds: string[]) {
  if (tenantIds.length === 0) return [] as ProjectLink[]

  const rows = await db
    .selectDistinct({
      tenantId: billingTenant.id,
      projectId: crmProject.id,
      projectName: crmProject.name,
      dealClosedMonth: crmProject.dealClosedMonth,
      opportunitySource: crmProject.opportunitySource,
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
    .where(
      and(
        inArray(billingTenant.id, tenantIds),
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  return rows.map((row) => ({
    tenantId: row.tenantId,
    projectId: row.projectId,
    projectName: row.projectName,
    dealClosedMonth: row.dealClosedMonth ?? undefined,
    opportunitySource: (row.opportunitySource as OpportunitySource | null) ?? undefined,
  }))
}

async function loadStaffByProjectIds(projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, Record<string, string>>()

  const rows = await db
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

  const map = new Map<string, Record<string, string>>()
  for (const row of rows) {
    const cur = map.get(row.projectId) ?? {}
    cur[row.roleType] = row.displayName
    map.set(row.projectId, cur)
  }
  return map
}

async function loadOpportunitySourceByProjectIds(projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, OpportunitySource | undefined>()

  const assignmentRows = await db
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

  const map = new Map<string, OpportunitySource | undefined>()
  for (const row of assignmentRows) {
    map.set(row.projectId, row.opportunitySource as OpportunitySource)
  }
  return map
}

function buildProjectRow(
  platformTenantId: string,
  local: LocalTenant,
  project: ProjectLink,
  staffMap: Map<string, Record<string, string>>,
  oppMap: Map<string, OpportunitySource | undefined>,
): TenantProjectQueryRow {
  const staff = staffMap.get(project.projectId) ?? {}
  const opportunitySource = oppMap.get(project.projectId) ?? project.opportunitySource

  return {
    platformTenantId,
    tenantName: local.tenantName,
    projectId: project.projectId,
    projectName: project.projectName,
    accountManager: staff.account_manager ?? '',
    deliveryManager: staff.delivery_manager ?? '',
    preSalesManager: staff.pre_sales ?? '',
    projectManager: staff.project_manager ?? '',
    opportunitySource,
    dealClosedMonth: project.dealClosedMonth,
  }
}

export const tenantProjectQueryDataAccess = {
  async query(rawTenantIds: string): Promise<TenantProjectQueryResult> {
    const platformTenantIds = parseTenantProjectQueryIds(rawTenantIds)
    assertTenantProjectQueryIdCount(platformTenantIds)

    const traceId = crypto.randomUUID().slice(0, 8)
    crmLog('tenant-project-query', 'query start', { traceId, count: platformTenantIds.length })

    const localMap = await loadLocalTenantsByPlatformIds(platformTenantIds)
    const tenantIds = [...localMap.values()].map((l) => l.tenantId)
    const projectLinks = await loadProjectsByTenantIds(tenantIds)
    const projectIds = [...new Set(projectLinks.map((p) => p.projectId))]

    const [staffMap, oppMap] = await Promise.all([
      loadStaffByProjectIds(projectIds),
      loadOpportunitySourceByProjectIds(projectIds),
    ])

    const projectsByTenantId = new Map<string, ProjectLink[]>()
    for (const link of projectLinks) {
      const list = projectsByTenantId.get(link.tenantId) ?? []
      list.push(link)
      projectsByTenantId.set(link.tenantId, list)
    }

    const rows: TenantProjectQueryRow[] = []
    const matchedTenantIds = new Set<string>()
    const projectCountByPlatformId = new Map<string, number>()
    for (const platformTenantId of platformTenantIds) {
      const local = localMap.get(platformTenantId)
      if (!local) continue

      const projects = projectsByTenantId.get(local.tenantId) ?? []
      if (projects.length === 0) continue

      matchedTenantIds.add(platformTenantId)
      projectCountByPlatformId.set(platformTenantId, projects.length)
      for (const project of projects) {
        rows.push(buildProjectRow(platformTenantId, local, project, staffMap, oppMap))
      }
    }

    const multiProjectTenants = [...projectCountByPlatformId.entries()]
      .filter(([, count]) => count > 1)
      .map(([platformTenantId, projectCount]) => ({ platformTenantId, projectCount }))
      .sort((a, b) => a.platformTenantId.localeCompare(b.platformTenantId, undefined, { numeric: true }))

    crmLog('tenant-project-query', 'query done', {
      traceId,
      total: platformTenantIds.length,
      matchedTenants: matchedTenantIds.size,
      withProject: rows.length,
      multiProjectTenants: multiProjectTenants.length,
    })

    return {
      rows,
      summary: {
        total: platformTenantIds.length,
        matchedTenants: matchedTenantIds.size,
        withProject: rows.length,
        multiProjectTenants,
      },
    }
  },
}
