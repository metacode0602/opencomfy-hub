import { computeCommissionMonthPhase } from '@/lib/crm/commission-phase'
import {
  OPPORTUNITY_SOURCE_LABELS,
  type CommissionMonthPhase,
  type OpportunitySource,
} from '@/lib/crm/commission-constants'
import { db } from '@/lib/db'
import {
  billingTenant,
  crmProject,
  customer,
  projectTenant,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, inArray, or } from 'drizzle-orm'
import {
  resolveEffectiveAccountManager,
  resolveOpportunitySourceAtMonth,
} from './commission-derive/resolve-crm'

export type ProjectCostMetadataRow = {
  tenant_platform_id: string
  customer_full_name: string | null
  account_manager: string | null
  opportunity_source: string | null
  month_phase: string | null
}

type ProjectLink = {
  tenantPlatformId: string
  projectId: string
  dealClosedMonth: string | null
  commissionMonthPhase: CommissionMonthPhase | null
}

async function loadProjectLinksByPlatformIds(
  platformTenantIds: string[],
): Promise<ProjectLink[]> {
  if (platformTenantIds.length === 0) return []

  const rows = await db
    .selectDistinct({
      tenantPlatformId: billingTenant.platformTenantId,
      projectId: crmProject.id,
      dealClosedMonth: crmProject.dealClosedMonth,
      commissionMonthPhase: crmProject.commissionMonthPhase,
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
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  return rows
    .filter((row): row is typeof row & { tenantPlatformId: string } =>
      Boolean(row.tenantPlatformId),
    )
    .map((row) => ({
      tenantPlatformId: row.tenantPlatformId,
      projectId: row.projectId,
      dealClosedMonth: row.dealClosedMonth,
      commissionMonthPhase: (row.commissionMonthPhase as CommissionMonthPhase | null) ?? null,
    }))
}

async function loadCustomerFullNamesByPlatformIds(
  platformTenantIds: string[],
): Promise<Map<string, string>> {
  if (platformTenantIds.length === 0) return new Map()

  const rows = await db
    .select({
      platformTenantId: billingTenant.platformTenantId,
      customerName: customer.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(billingTenant.customerId, customer.id))
    .where(inArray(billingTenant.platformTenantId, platformTenantIds))

  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.platformTenantId && !map.has(row.platformTenantId)) {
      map.set(row.platformTenantId, row.customerName)
    }
  }
  return map
}

export async function listProjectCostMetadata(input: {
  tenantPlatformIds: string[]
  settlementMonth: string
}): Promise<ProjectCostMetadataRow[]> {
  const platformTenantIds = [...new Set(input.tenantPlatformIds.filter(Boolean))]
  if (platformTenantIds.length === 0) return []

  const projectLinks = await loadProjectLinksByPlatformIds(platformTenantIds)
  const customerFullNameByPlatform = await loadCustomerFullNamesByPlatformIds(
    platformTenantIds,
  )
  const linkByPlatform = new Map<string, ProjectLink>()
  for (const link of projectLinks) {
    if (!linkByPlatform.has(link.tenantPlatformId)) {
      linkByPlatform.set(link.tenantPlatformId, link)
    }
  }

  const staffNameById = new Map<string, string>()
  const rows: ProjectCostMetadataRow[] = []

  for (const tenantPlatformId of platformTenantIds) {
    const link = linkByPlatform.get(tenantPlatformId)
    if (!link) {
      rows.push({
        tenant_platform_id: tenantPlatformId,
        customer_full_name: customerFullNameByPlatform.get(tenantPlatformId) ?? null,
        account_manager: null,
        opportunity_source: null,
        month_phase: null,
      })
      continue
    }

    const [staffId, opportunitySource] = await Promise.all([
      resolveEffectiveAccountManager(link.projectId, input.settlementMonth),
      resolveOpportunitySourceAtMonth(link.projectId, input.settlementMonth),
    ])

    let accountManager: string | null = null
    if (staffId) {
      if (staffNameById.has(staffId)) {
        accountManager = staffNameById.get(staffId) ?? null
      } else {
        const staff = await db.query.userStaff.findFirst({
          where: eq(userStaff.id, staffId),
          columns: { displayName: true },
        })
        accountManager = staff?.displayName ?? null
        staffNameById.set(staffId, accountManager ?? '')
      }
    }

    const { monthPhaseLabel } = computeCommissionMonthPhase(
      link.dealClosedMonth,
      input.settlementMonth,
      link.commissionMonthPhase,
    )

    rows.push({
      tenant_platform_id: tenantPlatformId,
      customer_full_name: customerFullNameByPlatform.get(tenantPlatformId) ?? null,
      account_manager: accountManager,
      opportunity_source: opportunitySource
        ? OPPORTUNITY_SOURCE_LABELS[opportunitySource as OpportunitySource]
        : null,
      month_phase: monthPhaseLabel,
    })
  }

  return rows
}
