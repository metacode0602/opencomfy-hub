import { enrichProjectCostGroups } from '@/lib/finance/project-cost-enrichment'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import type { ProjectCostMetricRow } from '@/lib/finance/project-cost-from-source-lines'
import { computeProjectCostFromSourceLines } from '@/lib/finance/project-cost-from-source-lines'
import { db } from '@/lib/db'
import {
  billingPeriod,
  billingTenant,
  crmProject,
  projectMonthlyCostSnapshot,
  projectTenant,
} from '@workspace/db/schema'
import { and, eq, inArray, or } from 'drizzle-orm'
import { FinanceError } from './errors'
import { listCostSourceLines } from './list-cost-source-lines'
import { listProjectCostMetadata } from './list-project-cost-metadata'
import { newId } from './operation-log'

type ProjectMonthlyCostSnapshotMetadata = {
  detail_rows: Array<{
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
  source: 'project_cost_dialog'
  skipped_line_count?: number
  unmatched_tenant_platform_ids?: string[]
  source_line_count?: number
}

function metricRowToMetadataDetail(row: ProjectCostMetricRow) {
  return {
    data_center_name: row.dataCenterName,
    region: row.region,
    card_type: row.cardType,
    balance_consumption: toMoneyString(row.balanceConsumption),
    balance_card_hours: toMoneyString(row.balanceCardHours),
    voucher_card_hours: toMoneyString(row.voucherCardHours),
    confirmed_revenue_excl_tax: toMoneyString(row.confirmedRevenueExclTax),
    sold_duration_cost_excl_tax: toMoneyString(row.soldDurationCostExclTax),
    gifted_duration_cost_excl_tax: toMoneyString(row.giftedDurationCostExclTax),
    gross_profit: toMoneyString(row.grossProfit),
  }
}

async function loadProjectInfoByPlatformIds(
  platformTenantIds: string[],
): Promise<Map<string, { projectId: string; projectName: string }>> {
  if (platformTenantIds.length === 0) return new Map()

  const rows = await db
    .selectDistinct({
      tenantPlatformId: billingTenant.platformTenantId,
      projectId: crmProject.id,
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
        or(
          eq(crmProject.primaryTenantId, billingTenant.id),
          eq(projectTenant.tenantId, billingTenant.id),
        ),
      ),
    )

  const map = new Map<string, { projectId: string; projectName: string }>()
  for (const row of rows) {
    if (row.tenantPlatformId && !map.has(row.tenantPlatformId)) {
      map.set(row.tenantPlatformId, {
        projectId: row.projectId,
        projectName: row.projectName,
      })
    }
  }
  return map
}

async function loadTenantsByPlatformIds(
  platformTenantIds: string[],
): Promise<
  Map<
    string,
    {
      tenantId: string
      customerId: string | null
    }
  >
> {
  if (platformTenantIds.length === 0) return new Map()

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      customerId: billingTenant.customerId,
    })
    .from(billingTenant)
    .where(inArray(billingTenant.platformTenantId, platformTenantIds))

  const map = new Map<string, { tenantId: string; customerId: string | null }>()
  for (const row of rows) {
    if (row.platformTenantId) {
      map.set(row.platformTenantId, {
        tenantId: row.tenantId,
        customerId: row.customerId,
      })
    }
  }
  return map
}

export async function saveProjectCostSnapshots(input: {
  billingPeriodId: string
  tenantPlatformIds?: string[]
  allProjects?: boolean
  savedByStaffId?: string | null
}): Promise<{ savedCount: number; unmappedCount: number; settlementMonth: string }> {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, input.billingPeriodId),
  })
  if (!period) {
    throw new FinanceError('NOT_FOUND', '账期不存在')
  }

  const lines = await listCostSourceLines(input.billingPeriodId)
  const result = computeProjectCostFromSourceLines({
    lines,
    tenantPlatformIds: input.tenantPlatformIds,
    allProjects: input.allProjects,
  })

  if (result.groups.length === 0) {
    throw new FinanceError('BAD_REQUEST', '未找到可保存的项目成本数据')
  }

  const metadataRows = await listProjectCostMetadata({
    tenantPlatformIds: result.groups.map((group) => group.tenantPlatformId),
    settlementMonth: period.periodCode,
  })
  const groups = enrichProjectCostGroups(result.groups, metadataRows)

  const platformIds = groups.map((group) => group.tenantPlatformId)
  const [tenantByPlatform, projectByPlatform] = await Promise.all([
    loadTenantsByPlatformIds(platformIds),
    loadProjectInfoByPlatformIds(platformIds),
  ])

  const savedAt = new Date()
  let savedCount = 0
  let unmappedCount = 0

  for (const group of groups) {
    const tenant = tenantByPlatform.get(group.tenantPlatformId)
    if (!tenant) {
      throw new FinanceError(
        'BAD_REQUEST',
        `平台租户 ID ${group.tenantPlatformId} 未在 CRM 中找到对应计费租户`,
      )
    }

    const project = projectByPlatform.get(group.tenantPlatformId)
    if (!project) {
      unmappedCount += 1
    }

    const snapshotMetadata: ProjectMonthlyCostSnapshotMetadata = {
      detail_rows: group.detailRows.map(metricRowToMetadataDetail),
      source: 'project_cost_dialog',
      skipped_line_count: result.skippedLineCount,
      unmatched_tenant_platform_ids:
        result.unmatchedTenantPlatformIds.length > 0
          ? result.unmatchedTenantPlatformIds
          : undefined,
      source_line_count: lines.length,
    }

    const rowValues = {
      billingPeriodId: input.billingPeriodId,
      settlementMonth: period.periodCode,
      tenantId: tenant.tenantId,
      tenantPlatformId: group.tenantPlatformId,
      tenantName: group.tenantName,
      projectId: project?.projectId ?? null,
      projectName: project?.projectName ?? null,
      customerId: tenant.customerId,
      customerFullName: group.customerFullName || null,
      accountManager: group.accountManager || null,
      opportunitySource: group.opportunitySource || null,
      monthPhaseLabel: group.monthPhaseLabel || null,
      balanceConsumption: toMoneyString(group.sumRow.balanceConsumption),
      balanceCardHours: toMoneyString(group.sumRow.balanceCardHours),
      voucherCardHours: toMoneyString(group.sumRow.voucherCardHours),
      confirmedRevenueExclTax: toMoneyString(group.sumRow.confirmedRevenueExclTax),
      soldDurationCostExclTax: toMoneyString(group.sumRow.soldDurationCostExclTax),
      giftedDurationCostExclTax: toMoneyString(group.sumRow.giftedDurationCostExclTax),
      grossProfit: toMoneyString(group.sumRow.grossProfit),
      metadata: snapshotMetadata,
      savedBy: input.savedByStaffId ?? null,
      savedAt,
    }

    await db
      .insert(projectMonthlyCostSnapshot)
      .values({
        id: newId(),
        ...rowValues,
      })
      .onConflictDoUpdate({
        target: [
          projectMonthlyCostSnapshot.billingPeriodId,
          projectMonthlyCostSnapshot.tenantPlatformId,
        ],
        set: {
          ...rowValues,
          updatedAt: new Date(),
        },
      })

    savedCount += 1
  }

  return {
    savedCount,
    unmappedCount,
    settlementMonth: period.periodCode,
  }
}
