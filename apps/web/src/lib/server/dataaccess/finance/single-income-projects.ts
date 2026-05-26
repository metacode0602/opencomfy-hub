import { db } from '@/lib/db'
import {
  billingTenant,
  crmProject,
  customer,
  projectTenant,
} from '@workspace/db/schema'
import { and, asc, eq, isNotNull, ne } from 'drizzle-orm'

export type IncomeEligibleProject = {
  projectId: string
  projectName: string
  tenantId: string
  tenantName: string
  platformTenantId: string
  customerId: string
  customerName: string
  customerType: string
}

async function findTenantWithPlatformId(
  tenantId: string,
): Promise<typeof billingTenant.$inferSelect | null> {
  const row = await db.query.billingTenant.findFirst({
    where: and(eq(billingTenant.id, tenantId), isNotNull(billingTenant.platformTenantId)),
  })
  if (!row?.platformTenantId) return null
  return row
}

/** 解析项目用于计费的租户：优先 primary_tenant_id，否则 project_tenant（按 sort_order） */
export async function resolveBillingTenantForProject(
  project: typeof crmProject.$inferSelect,
): Promise<typeof billingTenant.$inferSelect | null> {
  if (project.primaryTenantId) {
    const primary = await findTenantWithPlatformId(project.primaryTenantId)
    if (primary) return primary
  }

  const links = await db
    .select({ tenantId: projectTenant.tenantId })
    .from(projectTenant)
    .where(eq(projectTenant.projectId, project.id))
    .orderBy(asc(projectTenant.sortOrder))

  for (const link of links) {
    const tenant = await findTenantWithPlatformId(link.tenantId)
    if (tenant) return tenant
  }

  return null
}

/** 非归档且计费租户具备 platform_tenant_id 的经营项目 */
export async function listIncomeEligibleProjects(): Promise<IncomeEligibleProject[]> {
  const projects = await db
    .select()
    .from(crmProject)
    .where(and(ne(crmProject.status, 'archived'), ne(crmProject.status, 'paused')))

  const result: IncomeEligibleProject[] = []
  const seen = new Set<string>()

  for (const project of projects) {
    if (seen.has(project.id)) continue

    const tenant = await resolveBillingTenantForProject(project)
    if (!tenant?.platformTenantId) continue

    const cust = await db.query.customer.findFirst({
      where: eq(customer.id, tenant.customerId),
    })
    if (!cust) continue

    seen.add(project.id)
    result.push({
      projectId: project.id,
      projectName: project.name,
      tenantId: tenant.id,
      tenantName: tenant.name,
      platformTenantId: tenant.platformTenantId,
      customerId: cust.id,
      customerName: cust.name,
      customerType: cust.type === 'C' ? 'C' : 'B',
    })
  }

  return result
}
