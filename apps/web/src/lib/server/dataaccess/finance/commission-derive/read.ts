import { db } from '@/lib/db'
import { COMMISSION_POLICY_CODE } from '@/lib/crm/commission-policy-rates'
import {
  crmProject,
  platformCostCommissionDeriveAmPhase,
  platformCostCommissionDeriveDeptPhase,
  platformCostCommissionDeriveIssue,
  platformCostCommissionDeriveLine,
  platformCostCommissionDeriveProject,
  platformCostCommissionDeriveRun,
  userStaff,
} from '@workspace/db/schema'
import { and, desc, eq } from 'drizzle-orm'

async function findLatestRun(billingPeriodId: string) {
  return db.query.platformCostCommissionDeriveRun.findFirst({
    where: and(
      eq(platformCostCommissionDeriveRun.billingPeriodId, billingPeriodId),
      eq(platformCostCommissionDeriveRun.policyCode, COMMISSION_POLICY_CODE),
      eq(platformCostCommissionDeriveRun.status, 'calculated'),
    ),
    orderBy: [desc(platformCostCommissionDeriveRun.runVersion)],
  })
}

function mapRun(row: typeof platformCostCommissionDeriveRun.$inferSelect) {
  return {
    id: row.id,
    billing_period_id: row.billingPeriodId,
    policy_code: row.policyCode,
    run_version: row.runVersion,
    status: row.status,
    started_at: row.startedAt.toISOString(),
    finished_at: row.finishedAt?.toISOString() ?? null,
    error_summary: row.errorSummary,
  }
}

export const commissionDeriveDataAccess = {
  async getByPeriod(billingPeriodId: string) {
    const run = await findLatestRun(billingPeriodId)
    if (!run) {
      return { run: null, projects: [], amPhases: [], deptPhases: [], issues: [], lines: [] }
    }

    const [projects, amPhases, deptPhases, issues, lines] = await Promise.all([
      db
        .select({
          id: platformCostCommissionDeriveProject.id,
          project_id: platformCostCommissionDeriveProject.projectId,
          project_name: crmProject.name,
          settlement_month: platformCostCommissionDeriveProject.settlementMonth,
          flex_consumption: platformCostCommissionDeriveProject.flexConsumption,
          gross_profit_base: platformCostCommissionDeriveProject.grossProfitBase,
          gross_profit_rate_display: platformCostCommissionDeriveProject.grossProfitRateDisplay,
          opportunity_source: platformCostCommissionDeriveProject.opportunitySource,
          deal_closed_month: platformCostCommissionDeriveProject.dealClosedMonth,
          month_phase: platformCostCommissionDeriveProject.monthPhase,
          months_since_deal: platformCostCommissionDeriveProject.monthsSinceDeal,
          account_manager_staff_id: platformCostCommissionDeriveProject.accountManagerStaffId,
          account_manager_name: userStaff.displayName,
          revenue_department: platformCostCommissionDeriveProject.revenueDepartment,
          skipped_commission: platformCostCommissionDeriveProject.skippedCommission,
        })
        .from(platformCostCommissionDeriveProject)
        .innerJoin(crmProject, eq(crmProject.id, platformCostCommissionDeriveProject.projectId))
        .leftJoin(
          userStaff,
          eq(userStaff.id, platformCostCommissionDeriveProject.accountManagerStaffId),
        )
        .where(eq(platformCostCommissionDeriveProject.runId, run.id)),
      db
        .select({
          account_manager_staff_id: platformCostCommissionDeriveAmPhase.accountManagerStaffId,
          account_manager_name: userStaff.displayName,
          month_phase: platformCostCommissionDeriveAmPhase.monthPhase,
          project_count: platformCostCommissionDeriveAmPhase.projectCount,
          gross_profit_base_sum: platformCostCommissionDeriveAmPhase.grossProfitBaseSum,
          sales_commission_sum: platformCostCommissionDeriveAmPhase.salesCommissionSum,
          flex_consumption_sum: platformCostCommissionDeriveAmPhase.flexConsumptionSum,
        })
        .from(platformCostCommissionDeriveAmPhase)
        .innerJoin(
          userStaff,
          eq(userStaff.id, platformCostCommissionDeriveAmPhase.accountManagerStaffId),
        )
        .where(eq(platformCostCommissionDeriveAmPhase.runId, run.id)),
      db
        .select()
        .from(platformCostCommissionDeriveDeptPhase)
        .where(eq(platformCostCommissionDeriveDeptPhase.runId, run.id)),
      db
        .select({
          project_id: platformCostCommissionDeriveIssue.projectId,
          project_name: crmProject.name,
          code: platformCostCommissionDeriveIssue.code,
          message: platformCostCommissionDeriveIssue.message,
        })
        .from(platformCostCommissionDeriveIssue)
        .leftJoin(crmProject, eq(crmProject.id, platformCostCommissionDeriveIssue.projectId))
        .where(eq(platformCostCommissionDeriveIssue.runId, run.id)),
      db
        .select()
        .from(platformCostCommissionDeriveLine)
        .where(eq(platformCostCommissionDeriveLine.runId, run.id)),
    ])

    return {
      run: mapRun(run),
      projects,
      amPhases: amPhases.map((r) => ({
        account_manager_staff_id: r.account_manager_staff_id,
        account_manager_name: r.account_manager_name,
        month_phase: r.month_phase,
        project_count: r.project_count,
        gross_profit_base_sum: r.gross_profit_base_sum,
        sales_commission_sum: r.sales_commission_sum,
        flex_consumption_sum: r.flex_consumption_sum,
      })),
      deptPhases: deptPhases.map((r) => ({
        recipient_dept: r.recipientDept,
        month_phase: r.monthPhase,
        gross_profit_base_sum: r.grossProfitBaseSum,
        commission_pool_sum: r.commissionPoolSum,
        project_count: r.projectCount,
      })),
      issues,
      lines: lines.map((r) => ({
        project_id: r.projectId,
        recipient_role: r.recipientRole,
        recipient_staff_id: r.recipientStaffId,
        recipient_dept: r.recipientDept,
        month_phase: r.monthPhase,
        rate: r.rate,
        gross_profit_base: r.grossProfitBase,
        commission_amount: r.commissionAmount,
      })),
    }
  },

  async getAmPhaseSummary(billingPeriodId: string, staffId?: string) {
    const bundle = await this.getByPeriod(billingPeriodId)
    if (!bundle.run) return []
    let rows = bundle.amPhases
    if (staffId) {
      rows = rows.filter((r) => r.account_manager_staff_id === staffId)
    }
    return rows
  },

  async getDeptPhaseSummary(billingPeriodId: string, dept: '市场' | '中台') {
    const bundle = await this.getByPeriod(billingPeriodId)
    if (!bundle.run) return []
    return bundle.deptPhases.filter((r) => r.recipient_dept === dept)
  },

  async listProjectLines(billingPeriodId: string, projectId?: string) {
    const bundle = await this.getByPeriod(billingPeriodId)
    if (!bundle.run) return { projects: [], lines: [] }
    const projects = projectId
      ? bundle.projects.filter((p) => p.project_id === projectId)
      : bundle.projects
    const lines = projectId
      ? bundle.lines.filter((l) => l.project_id === projectId)
      : bundle.lines
    return { projects, lines }
  },
}
