import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodPersonalIncomeSummary,
  billingPeriodReconciliationReport,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import type { PersonalIncomeSummaryKind } from './constants'
import { computePersonalPeriodIncome } from './compute-personal-income'
import type { BillingPeriodDto } from './billing-periods'
import { purgePersonalIncomeArtifacts } from './purge-personal'
import {
  mapPersonalBatchDto,
  validatePersonalIncome,
} from './validate-personal-income'

function mapPeriod(row: typeof billingPeriod.$inferSelect): BillingPeriodDto {
  return {
    id: row.id,
    period_code: row.periodCode,
    period_start: row.periodStart,
    period_end: row.periodEnd,
    status: row.status,
    total_income: row.totalIncome,
    total_cost: row.totalCost,
    supplementary: row.supplementary,
    balance_income: row.balanceIncome,
    baremetal_income: row.baremetalIncome,
    last_computed_at: row.lastComputedAt?.toISOString() ?? null,
    published_at: row.publishedAt?.toISOString() ?? null,
  }
}

function mapSummary(row: typeof billingPeriodPersonalIncomeSummary.$inferSelect) {
  return {
    id: row.id,
    summary_kind: row.summaryKind as PersonalIncomeSummaryKind,
    balance_consumption: row.balanceConsumption,
    bare_metal_consumption: row.bareMetalConsumption,
    total_consumption: row.totalConsumption,
    matched_tenant_count: row.matchedTenantCount,
    last_computed_at: row.lastComputedAt?.toISOString() ?? null,
  }
}

export const financePersonalIncomeDataAccess = {
  validatePersonalIncome,

  async getPersonalBundle(billingPeriodId: string) {
    const period = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, billingPeriodId),
    })
    if (!period) return null

    const { getPersonalImportBatches } = await import('./purge-personal')
    const batches = await getPersonalImportBatches(billingPeriodId)
    const summaries = await db
      .select()
      .from(billingPeriodPersonalIncomeSummary)
      .where(eq(billingPeriodPersonalIncomeSummary.billingPeriodId, billingPeriodId))

    const report = await db.query.billingPeriodReconciliationReport.findFirst({
      where: eq(billingPeriodReconciliationReport.billingPeriodId, billingPeriodId),
    })

    const validation = await validatePersonalIncome(billingPeriodId)

    return {
      period: mapPeriod(period),
      validation,
      batches: {
        tenant_bill: mapPersonalBatchDto(batches.tenantBill),
        baremetal: mapPersonalBatchDto(batches.baremetal),
      },
      summaries: summaries.map(mapSummary),
      reconciliation: report?.reportJson ?? null,
    }
  },

  computePersonalIncome: computePersonalPeriodIncome,

  async purgePersonalIncome(billingPeriodId: string, actorId?: string | null) {
    await purgePersonalIncomeArtifacts({ billingPeriodId, actorId })
    return { ok: true }
  },
}
