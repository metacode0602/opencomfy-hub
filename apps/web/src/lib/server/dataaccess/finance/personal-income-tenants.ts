import { db } from '@/lib/db'
import {
  billingTenant,
  crmProject,
  projectTenant,
} from '@workspace/db/schema'
import { and, eq, inArray, or, sql } from 'drizzle-orm'

/** 在给定平台租户 ID 中，返回已关联非归档/暂停经营项目的 ID 集合 */
export async function listProjectLinkedPlatformTenantIds(
  platformTenantIds: string[],
): Promise<Set<string>> {
  if (platformTenantIds.length === 0) return new Set()

  const rows = await db
    .selectDistinct({ platformTenantId: billingTenant.platformTenantId })
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
        inArray(billingTenant.platformTenantId, platformTenantIds),
        sql`${crmProject.status} NOT IN ('archived', 'paused')`,
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  return new Set(
    rows.map((r) => r.platformTenantId).filter((id): id is string => Boolean(id)),
  )
}

export type ExcludedProjectTenant = {
  platformTenantId: string
  projectNames: string[]
}

/** 被项目关联排除的租户及项目名（用于对账报告） */
export async function listExcludedProjectTenants(
  platformTenantIds: string[],
): Promise<ExcludedProjectTenant[]> {
  if (platformTenantIds.length === 0) return []

  const rows = await db
    .select({
      platformTenantId: billingTenant.platformTenantId,
      projectName: crmProject.name,
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
        inArray(billingTenant.platformTenantId, platformTenantIds),
        sql`${crmProject.status} NOT IN ('archived', 'paused')`,
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  const byTenant = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    const names = byTenant.get(row.platformTenantId) ?? new Set()
    names.add(row.projectName)
    byTenant.set(row.platformTenantId, names)
  }

  return [...byTenant.entries()].map(([platformTenantId, names]) => ({
    platformTenantId,
    projectNames: [...names],
  }))
}
