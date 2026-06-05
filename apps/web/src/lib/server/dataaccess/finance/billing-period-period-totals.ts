import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodPersonalIncomeSummary,
  platformIncomeMonthly,
} from '@workspace/db/schema'
import { PERSONAL_INCOME_SUMMARY_KINDS } from './constants'
import { and, eq } from 'drizzle-orm'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import { financeLog } from './logger'

function parseMoneySum(values: (string | null | undefined)[]): number {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0)
}

export type BillingPeriodTotalsPatch = {
  enterpriseIncome?: number | null
  personalIncome?: number | null
  incomeTotal?: number | null
  projectCost?: number | null
  internalUserCost?: number | null
  totalCost?: number | null
  totalGrossProfit?: number | null
  totalIncome?: number | null
  balanceIncome?: number | null
  baremetalIncome?: number | null
  supplementary?: number | null
  lastComputedAt?: Date | null
  status?: string
}

/** 从派生表重算账期分类汇总字段，并同步 legacy total_income / total_cost */
export async function refreshBillingPeriodPeriodTotals(
  periodId: string,
  patch: BillingPeriodTotalsPatch = {},
): Promise<void> {
  const incomeRows = await db
    .select()
    .from(platformIncomeMonthly)
    .where(eq(platformIncomeMonthly.billingPeriodId, periodId))

  let enterpriseIncome = parseMoneySum(incomeRows.map((r) => r.totalConsumption))
  let balanceIncome = parseMoneySum(incomeRows.map((r) => r.balanceConsumption))
  let baremetalIncome = parseMoneySum(incomeRows.map((r) => r.bareMetalConsumption))
  let supplementary = parseMoneySum(incomeRows.map((r) => r.supplementaryConsumption))

  const personalRow = await db.query.billingPeriodPersonalIncomeSummary.findFirst({
    where: and(
      eq(billingPeriodPersonalIncomeSummary.billingPeriodId, periodId),
      eq(
        billingPeriodPersonalIncomeSummary.summaryKind,
        PERSONAL_INCOME_SUMMARY_KINDS.nonProject,
      ),
    ),
  })
  const personalIncome = Number(personalRow?.totalConsumption ?? 0)

  const incomeTotal = enterpriseIncome + personalIncome

  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
  })
  if (!period) return

  const projectCost =
    patch.projectCost ?? (period.projectCost != null ? Number(period.projectCost) : null)
  const internalUserCost =
    patch.internalUserCost ??
    (period.internalUserCost != null ? Number(period.internalUserCost) : null)
  const totalCost =
    patch.totalCost ??
    (projectCost != null && internalUserCost != null
      ? projectCost + internalUserCost
      : period.totalCost != null
        ? Number(period.totalCost)
        : null)

  const set: Partial<typeof billingPeriod.$inferInsert> = {
    enterpriseIncome: toMoneyString(patch.enterpriseIncome ?? enterpriseIncome),
    personalIncome: toMoneyString(patch.personalIncome ?? personalIncome),
    incomeTotal: toMoneyString(patch.incomeTotal ?? incomeTotal),
    totalIncome: toMoneyString(patch.totalIncome ?? incomeTotal),
    balanceIncome: toMoneyString(patch.balanceIncome ?? balanceIncome),
    baremetalIncome: toMoneyString(patch.baremetalIncome ?? baremetalIncome),
    supplementary: toMoneyString(patch.supplementary ?? supplementary),
  }

  if (projectCost != null) {
    set.projectCost = toMoneyString(projectCost)
  }
  if (internalUserCost != null) {
    set.internalUserCost = toMoneyString(internalUserCost)
  }
  if (totalCost != null) {
    set.totalCost = toMoneyString(totalCost)
  }
  if (patch.totalGrossProfit != null) {
    set.totalGrossProfit = toMoneyString(patch.totalGrossProfit)
  }
  if (patch.lastComputedAt !== undefined) {
    set.lastComputedAt = patch.lastComputedAt
  }
  if (patch.status) {
    set.status = patch.status
  }

  await db.update(billingPeriod).set(set).where(eq(billingPeriod.id, periodId))

  financeLog('period-totals', 'refreshed', {
    periodId,
    enterpriseIncome,
    personalIncome,
    incomeTotal,
    projectCost,
    internalUserCost,
    totalCost,
  })
}
