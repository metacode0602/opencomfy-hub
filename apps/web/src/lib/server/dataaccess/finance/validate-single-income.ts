import { db } from '@/lib/db'
import { billingTenant, tenantBill } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { financeBillingPeriodsDataAccess } from './billing-periods'
import { FinanceError } from './errors'
import { getBillingPeriodDateRange } from './internal-tenant-income-exclusion'
import { listIncomeEligibleProjects } from './single-income-projects'
import { buildValidationIssueRows } from '@/lib/finance/single-income-issue-rows'
import type { SingleIncomeIssueRow, SingleIncomeProjectDetail } from '@/lib/finance/single-income-types'
import type { SharedPlatformTenantWarningDetail } from './single-income-types'

export type { SingleIncomeProjectDetail, SharedPlatformTenantWarningDetail }

export type ValidateSingleIncomeResult = {
  periodStatus: string
  billMonth: string
  billsInDb: number
  projectsEligible: number
  projectsIncluded: number
  projectsIncludedList: SingleIncomeProjectDetail[]
  projectsMissingBill: SingleIncomeProjectDetail[]
  sharedPlatformTenantWarnings: SharedPlatformTenantWarningDetail[]
  issueRows: SingleIncomeIssueRow[]
  canComputeSingleIncome: boolean
  canPreviewSingleIncome: boolean
}

function toProjectDetail(p: {
  projectId: string
  projectName: string
  tenantId: string
  tenantName: string
  platformTenantId: string
  customerId: string
  customerName: string
}): SingleIncomeProjectDetail {
  return {
    projectId: p.projectId,
    projectName: p.projectName,
    tenantId: p.tenantId,
    tenantName: p.tenantName,
    platformTenantId: p.platformTenantId,
    customerId: p.customerId,
    customerName: p.customerName,
  }
}

function buildSharedPlatformWarnings(
  eligibleProjects: Awaited<ReturnType<typeof listIncomeEligibleProjects>>,
): SharedPlatformTenantWarningDetail[] {
  const byPlatform = new Map<
    string,
    {
      tenantId: string
      tenantName: string
      projects: Array<{ projectId: string; projectName: string }>
    }
  >()

  for (const p of eligibleProjects) {
    const entry = byPlatform.get(p.platformTenantId) ?? {
      tenantId: p.tenantId,
      tenantName: p.tenantName,
      projects: [],
    }
    entry.projects.push({ projectId: p.projectId, projectName: p.projectName })
    byPlatform.set(p.platformTenantId, entry)
  }

  return [...byPlatform.entries()]
    .filter(([, v]) => v.projects.length > 1)
    .map(([platformTenantId, v]) => ({
      platformTenantId,
      tenantId: v.tenantId,
      tenantName: v.tenantName,
      projects: v.projects,
    }))
}

export async function validateSingleIncome(
  billingPeriodId: string,
): Promise<ValidateSingleIncomeResult> {
  const period = await financeBillingPeriodsDataAccess.getById(billingPeriodId)
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')

  const billMonth = period.period_code
  const periodRange = await getBillingPeriodDateRange(billingPeriodId)
  const eligibleProjects = await listIncomeEligibleProjects(periodRange)

  const bills = await db
    .select({
      tenantId: tenantBill.tenantId,
      platformTenantId: billingTenant.platformTenantId,
    })
    .from(tenantBill)
    .innerJoin(billingTenant, eq(tenantBill.tenantId, billingTenant.id))
    .where(eq(tenantBill.billMonth, billMonth))

  const billTenantIds = new Set(
    bills.map((b) => b.tenantId).filter((id): id is string => Boolean(id)),
  )

  const projectsIncludedList: SingleIncomeProjectDetail[] = []
  const projectsMissingBill: SingleIncomeProjectDetail[] = []

  for (const p of eligibleProjects) {
    const ref = toProjectDetail(p)
    if (billTenantIds.has(p.tenantId)) {
      projectsIncludedList.push(ref)
    } else {
      projectsMissingBill.push(ref)
    }
  }

  const sharedPlatformTenantWarnings = buildSharedPlatformWarnings(eligibleProjects)

  const canPreviewSingleIncome =
    projectsIncludedList.length > 0 && period.status !== 'void'

  const canComputeSingleIncome =
    canPreviewSingleIncome && period.status !== 'published'

  const projectDetailsById = new Map(
    eligibleProjects.map((p) => [p.projectId, toProjectDetail(p)]),
  )
  const issueRows = buildValidationIssueRows({
    projectDetailsById,
    projectsMissingBill,
    sharedPlatformTenantWarnings,
    canPreviewSingleIncome,
    canComputeSingleIncome,
  })

  return {
    periodStatus: period.status,
    billMonth,
    billsInDb: bills.length,
    projectsEligible: eligibleProjects.length,
    projectsIncluded: projectsIncludedList.length,
    projectsIncludedList,
    projectsMissingBill,
    sharedPlatformTenantWarnings,
    issueRows,
    canComputeSingleIncome,
    canPreviewSingleIncome,
  }
}
