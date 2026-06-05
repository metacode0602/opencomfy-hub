import { db } from '@/lib/db'
import { lookupPolicyRates, COMMISSION_POLICY_CODE } from '@/lib/crm/commission-policy-rates'
import type { CommissionMonthPhase, OpportunitySource } from '@/lib/crm/commission-constants'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import { projectCommissionPhaseDataAccess } from '@/lib/server/dataaccess/crm/project-commission-phase'
import {
  billingPeriod,
  crmProject,
  platformCostCommissionDeriveIssue,
  platformCostCommissionDeriveLine,
  platformCostCommissionDeriveProject,
  platformCostCommissionDeriveRun,
} from '@workspace/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { collectCostTenantPlatformIds } from '../compute-cost'
import { persistCostPricingSnapshots } from '../compute-cost-pricing-snapshot'
import { persistCostSourceLines } from '../compute-cost-source-line'
import { periodUsesPeriodEndCostPricing } from '../billing-period-pricing-mode'
import { FinanceError } from '../errors'
import { appendOperationLog, newId } from '../operation-log'
import {
  DERIVE_DEPT_MARKETING,
  DERIVE_DEPT_MIDDLE,
  DERIVE_ISSUE_CODES,
  DERIVE_RECIPIENT_ROLES,
} from './constants'
import {
  computeAllProjectMetrics,
  listProjectIdsWithCostLines,
} from './derive-project-metrics'
import { materializeAmPhaseRollup, materializeDeptPhaseRollup } from './derive-rollup'
import { loadElasticBusinessLineIds } from './elastic-business-lines'
import {
  assertDerivePreconditions,
  assertExistingCostSourceLines,
  isInPolicyWindow,
} from './preconditions'
import {
  loadStaffPosition,
  resolveEffectiveAccountManager,
  resolveOpportunitySourceAtMonth,
  resolveRevenueDepartmentAtMonth,
} from './resolve-crm'

async function recordIssue(input: {
  runId: string
  projectId?: string | null
  code: string
  message: string
}): Promise<void> {
  await db.insert(platformCostCommissionDeriveIssue).values({
    id: newId(),
    runId: input.runId,
    projectId: input.projectId ?? null,
    code: input.code,
    message: input.message,
  })
}

async function deleteDeriveRunsForPeriod(billingPeriodId: string): Promise<void> {
  await db
    .delete(platformCostCommissionDeriveRun)
    .where(
      and(
        eq(platformCostCommissionDeriveRun.billingPeriodId, billingPeriodId),
        eq(platformCostCommissionDeriveRun.policyCode, COMMISSION_POLICY_CODE),
      ),
    )
}

async function maybeWriteDealClosedMonth(
  projectId: string,
  settlementMonth: string,
  flexConsumption: number,
): Promise<void> {
  if (flexConsumption <= 0) return
  const project = await db.query.crmProject.findFirst({
    where: eq(crmProject.id, projectId),
    columns: { dealClosedMonth: true },
  })
  if (!project || project.dealClosedMonth) return
  await db
    .update(crmProject)
    .set({ dealClosedMonth: settlementMonth })
    .where(eq(crmProject.id, projectId))
}

export type DeriveCommissionResult = {
  runId: string
  status: string
  projectCount: number
  issueCount: number
}

export async function derivePlatformCostCommissionPhase(input: {
  billingPeriodId: string
  actorId?: string | null
}): Promise<DeriveCommissionResult> {
  const periodId = input.billingPeriodId
  await assertDerivePreconditions(periodId)

  const period = (await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
  }))!
  const settlementMonth = period.periodCode

  if (!isInPolicyWindow(settlementMonth)) {
    throw new FinanceError(
      'PRECONDITION_FAILED',
      `结算月 ${settlementMonth} 不在政策执行期（2026-05～2026-12）`,
    )
  }

  const prevRuns = await db
    .select({ runVersion: platformCostCommissionDeriveRun.runVersion })
    .from(platformCostCommissionDeriveRun)
    .where(
      and(
        eq(platformCostCommissionDeriveRun.billingPeriodId, periodId),
        eq(platformCostCommissionDeriveRun.policyCode, COMMISSION_POLICY_CODE),
      ),
    )
    .orderBy(desc(platformCostCommissionDeriveRun.runVersion))
    .limit(1)
  const nextVersion = (prevRuns[0]?.runVersion ?? 0) + 1

  await deleteDeriveRunsForPeriod(periodId)

  const runId = newId()
  await db.insert(platformCostCommissionDeriveRun).values({
    id: runId,
    billingPeriodId: periodId,
    policyCode: COMMISSION_POLICY_CODE,
    runVersion: nextVersion,
    status: 'running',
  })

  let issueCount = 0
  let projectCount = 0

  try {
    const isPublished =
      period.status === 'published' || period.status === 'adjusted'
    const usePeriodEndPricing = periodUsesPeriodEndCostPricing(period)

    if (isPublished) {
      await assertExistingCostSourceLines(periodId)
    } else {
      const tenantPlatformIds = await collectCostTenantPlatformIds(periodId)
      const issues: string[] = []
      await persistCostSourceLines({
        billingPeriodId: periodId,
        tenantPlatformIds,
        periodEnd: period.periodEnd,
        issues,
        mode: 'create',
        usePeriodEndPricing,
      })
    }

    const snapshots = await persistCostPricingSnapshots({
      billingPeriodId: periodId,
      periodEnd: period.periodEnd,
      mode: 'create',
      usePeriodEndPricing,
    })

    const metricsByProject = await computeAllProjectMetrics({
      billingPeriodId: periodId,
      period,
      snapshots,
    })

    const costProjectIds = await listProjectIdsWithCostLines(periodId)
    const elasticLineIds = await loadElasticBusinessLineIds()

    let projectIds = costProjectIds
    if (elasticLineIds && costProjectIds.length > 0) {
      const metaRows = await db
        .select({ id: crmProject.id, businessLineId: crmProject.businessLineId })
        .from(crmProject)
        .where(inArray(crmProject.id, costProjectIds))
      projectIds = metaRows
        .filter((r) => elasticLineIds.has(r.businessLineId))
        .map((r) => r.id)
    }

    for (const projectId of projectIds) {
      const metrics = metricsByProject.get(projectId) ?? {
        grossProfitBase: 0,
        flexConsumption: 0,
      }
      const B = metrics.grossProfitBase
      const flex = metrics.flexConsumption

      await maybeWriteDealClosedMonth(projectId, settlementMonth, flex)

      const phaseSnap = await projectCommissionPhaseDataAccess.resolve(
        projectId,
        settlementMonth,
      )
      const opp = await resolveOpportunitySourceAtMonth(projectId, settlementMonth)
      const amId = await resolveEffectiveAccountManager(projectId, settlementMonth)
      const revenueDept = await resolveRevenueDepartmentAtMonth(projectId, settlementMonth)
      const position = amId ? await loadStaffPosition(amId) : null

      const rateDisplay =
        flex > 0 ? toMoneyString(B / flex) : null

      let skippedCommission = false

      await db.insert(platformCostCommissionDeriveProject).values({
        id: newId(),
        runId,
        projectId,
        settlementMonth,
        flexConsumption: toMoneyString(flex),
        grossProfitBase: toMoneyString(B),
        grossProfitRateDisplay: rateDisplay,
        opportunitySource: opp,
        dealClosedMonth: phaseSnap.dealClosedMonth,
        monthPhase: phaseSnap.monthPhase,
        monthsSinceDeal: phaseSnap.monthsSinceDeal,
        accountManagerStaffId: amId,
        revenueDepartment: revenueDept,
        skippedCommission: false,
      })
      projectCount += 1

      if (!phaseSnap.monthPhase) {
        await recordIssue({
          runId,
          projectId,
          code: DERIVE_ISSUE_CODES.missingMonthPhase,
          message: '无法确定提成月序分段',
        })
        issueCount += 1
        continue
      }

      if (!amId) {
        await recordIssue({
          runId,
          projectId,
          code: DERIVE_ISSUE_CODES.missingAccountManager,
          message: '缺少结算月有效客户经理',
        })
        issueCount += 1
      }

      if (!opp) {
        skippedCommission = true
        await db
          .update(platformCostCommissionDeriveProject)
          .set({ skippedCommission: true })
          .where(
            and(
              eq(platformCostCommissionDeriveProject.runId, runId),
              eq(platformCostCommissionDeriveProject.projectId, projectId),
            ),
          )
        await recordIssue({
          runId,
          projectId,
          code: DERIVE_ISSUE_CODES.missingOpportunitySource,
          message: '缺少商机来源，已跳过提成行',
        })
        issueCount += 1
        continue
      }

      const monthPhase = phaseSnap.monthPhase as CommissionMonthPhase
      const rates = lookupPolicyRates(opp as OpportunitySource, monthPhase)

      if (amId) {
        await db.insert(platformCostCommissionDeriveLine).values({
          id: newId(),
          runId,
          projectId,
          recipientRole: DERIVE_RECIPIENT_ROLES.accountManagerGross,
          recipientStaffId: amId,
          recipientDept: null,
          monthPhase,
          rate: '0',
          platformRatio: '1',
          grossProfitBase: toMoneyString(B),
          commissionAmount: '0',
        })

        if (position === '经理') {
          await recordIssue({
            runId,
            projectId,
            code: DERIVE_ISSUE_CODES.managerExcludedSales,
            message: '一级部门经理不参与销售个人提成',
          })
          issueCount += 1
        } else {
          await db.insert(platformCostCommissionDeriveLine).values({
            id: newId(),
            runId,
            projectId,
            recipientRole: DERIVE_RECIPIENT_ROLES.salesIndividual,
            recipientStaffId: amId,
            recipientDept: null,
            monthPhase,
            rate: toMoneyString(rates.sales),
            platformRatio: '1',
            grossProfitBase: toMoneyString(B),
            commissionAmount: toMoneyString(B * rates.sales),
          })
        }
      }

      if (rates.marketing > 0) {
        await db.insert(platformCostCommissionDeriveLine).values({
          id: newId(),
          runId,
          projectId,
          recipientRole: DERIVE_RECIPIENT_ROLES.marketingDeptPool,
          recipientStaffId: null,
          recipientDept: DERIVE_DEPT_MARKETING,
          monthPhase,
          rate: toMoneyString(rates.marketing),
          platformRatio: '1',
          grossProfitBase: toMoneyString(B),
          commissionAmount: toMoneyString(B * rates.marketing),
        })
      }

      if (rates.middle > 0) {
        await db.insert(platformCostCommissionDeriveLine).values({
          id: newId(),
          runId,
          projectId,
          recipientRole: DERIVE_RECIPIENT_ROLES.middleOfficeDeptPool,
          recipientStaffId: null,
          recipientDept: DERIVE_DEPT_MIDDLE,
          monthPhase,
          rate: toMoneyString(rates.middle),
          platformRatio: '1',
          grossProfitBase: toMoneyString(B),
          commissionAmount: toMoneyString(B * rates.middle),
        })
      }

      void skippedCommission
    }

    await materializeAmPhaseRollup(runId)
    await materializeDeptPhaseRollup(runId)

    await db
      .update(platformCostCommissionDeriveRun)
      .set({ status: 'calculated', finishedAt: new Date() })
      .where(eq(platformCostCommissionDeriveRun.id, runId))

    await appendOperationLog({
      billingPeriodId: periodId,
      operation: 'commission_derive',
      actorId: input.actorId,
      metadata: { runId, projectCount, issueCount },
    })

    return { runId, status: 'calculated', projectCount, issueCount }
  } catch (e) {
    const message = e instanceof Error ? e.message : '派生失败'
    await db
      .update(platformCostCommissionDeriveRun)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        errorSummary: message,
      })
      .where(eq(platformCostCommissionDeriveRun.id, runId))
    if (e instanceof FinanceError) throw e
    throw new FinanceError('BAD_REQUEST', message)
  }
}
