import { projectsDataAccess } from '@/lib/server/dataaccess/crm/projects'
import { db } from '@/lib/db'
import { projectMonthlyCostSnapshot } from '@workspace/db/schema'
import { desc, eq, inArray, or } from 'drizzle-orm'

export type ProjectMonthlyCostSnapshotDto = {
  id: string
  billing_period_id: string
  settlement_month: string
  tenant_id: string
  tenant_platform_id: string
  tenant_name: string
  project_id: string | null
  project_name: string | null
  customer_id: string | null
  customer_full_name: string | null
  account_manager: string | null
  opportunity_source: string | null
  month_phase_label: string | null
  balance_consumption: string
  balance_card_hours: string
  voucher_card_hours: string
  confirmed_revenue_excl_tax: string
  sold_duration_cost_excl_tax: string
  gifted_duration_cost_excl_tax: string
  gross_profit: string
  metadata: {
    detail_rows?: Array<{
      data_center_name: string
      region: string
      card_type: string
      balance_consumption: string
      balance_card_hours: string
      voucher_card_hours: string
      confirmed_revenue_excl_tax: string
      sold_duration_cost_excl_tax: string
      gifted_duration_cost_excl_tax: string
      gross_profit: string
    }>
    source?: string
    skipped_line_count?: number
    unmatched_tenant_platform_ids?: string[]
    source_line_count?: number
  }
  saved_at: string
}

function mapRow(
  row: typeof projectMonthlyCostSnapshot.$inferSelect,
): ProjectMonthlyCostSnapshotDto {
  return {
    id: row.id,
    billing_period_id: row.billingPeriodId,
    settlement_month: row.settlementMonth,
    tenant_id: row.tenantId,
    tenant_platform_id: row.tenantPlatformId,
    tenant_name: row.tenantName,
    project_id: row.projectId,
    project_name: row.projectName,
    customer_id: row.customerId,
    customer_full_name: row.customerFullName,
    account_manager: row.accountManager,
    opportunity_source: row.opportunitySource,
    month_phase_label: row.monthPhaseLabel,
    balance_consumption: row.balanceConsumption,
    balance_card_hours: row.balanceCardHours,
    voucher_card_hours: row.voucherCardHours,
    confirmed_revenue_excl_tax: row.confirmedRevenueExclTax,
    sold_duration_cost_excl_tax: row.soldDurationCostExclTax,
    gifted_duration_cost_excl_tax: row.giftedDurationCostExclTax,
    gross_profit: row.grossProfit,
    metadata: (row.metadata ?? {}) as ProjectMonthlyCostSnapshotDto['metadata'],
    saved_at: row.savedAt.toISOString(),
  }
}

export async function listProjectMonthlyCostSnapshots(
  projectId: string,
): Promise<ProjectMonthlyCostSnapshotDto[]> {
  const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)

  const rows = await db
    .select()
    .from(projectMonthlyCostSnapshot)
    .where(
      tenantIds.length > 0
        ? or(
            eq(projectMonthlyCostSnapshot.projectId, projectId),
            inArray(projectMonthlyCostSnapshot.tenantId, tenantIds),
          )
        : eq(projectMonthlyCostSnapshot.projectId, projectId),
    )
    .orderBy(
      desc(projectMonthlyCostSnapshot.settlementMonth),
      desc(projectMonthlyCostSnapshot.tenantName),
    )

  return rows.map(mapRow)
}
