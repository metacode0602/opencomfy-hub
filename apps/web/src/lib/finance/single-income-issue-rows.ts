import { getProjectsFromSharedWarning } from '@/lib/finance/single-income-validation'
import type { SingleIncomeIssueRow, SingleIncomeProjectDetail } from '@/lib/finance/single-income-types'

export const SINGLE_INCOME_ISSUE_TYPE = {
  MISSING_BILL: '缺CRM月度账单',
  SHARED_PLATFORM_TENANT: '多项目共用平台租户',
  BILL_AMOUNT_MISMATCH: '账单明细与账单头不一致',
  CANNOT_PREVIEW: '不可试算',
  CANNOT_COMPUTE: '不可写入',
} as const

function projectToIssueBase(p: SingleIncomeProjectDetail): Omit<SingleIncomeIssueRow, 'issueType' | 'errorMessage'> {
  return {
    projectId: p.projectId,
    projectName: p.projectName,
    tenantId: p.tenantId,
    tenantName: p.tenantName,
    platformTenantId: p.platformTenantId,
    customerId: p.customerId ?? '',
    customerName: p.customerName ?? '',
    billId: '',
  }
}

export function buildValidationIssueRows(input: {
  projectDetailsById?: Map<string, SingleIncomeProjectDetail>
  projectsMissingBill: SingleIncomeProjectDetail[]
  sharedPlatformTenantWarnings: Array<{
    platformTenantId: string
    tenantId?: string | null
    tenantName?: string | null
    projects?: Array<{ projectId: string; projectName: string }>
    projectNames?: string[]
  }>
  canPreviewSingleIncome: boolean
  canComputeSingleIncome: boolean
}): SingleIncomeIssueRow[] {
  const rows: SingleIncomeIssueRow[] = []

  for (const p of input.projectsMissingBill) {
    rows.push({
      ...projectToIssueBase(p),
      issueType: SINGLE_INCOME_ISSUE_TYPE.MISSING_BILL,
      errorMessage: `项目「${p.projectName}」在账期内无 CRM 月度账单（tenant_bill），试算/写入时将跳过`,
    })
  }

  for (const w of input.sharedPlatformTenantWarnings) {
    const projects = getProjectsFromSharedWarning(w)
    const tenantId = w.tenantId ?? ''
    const tenantName = w.tenantName ?? ''
    for (const p of projects) {
      const detail = input.projectDetailsById?.get(p.projectId)
      rows.push({
        issueType: SINGLE_INCOME_ISSUE_TYPE.SHARED_PLATFORM_TENANT,
        errorMessage: `平台租户 ${w.platformTenantId} 被多个项目共用，本项目将按同一账单全额计入收入`,
        projectId: p.projectId,
        projectName: p.projectName,
        tenantId: detail?.tenantId ?? tenantId,
        tenantName: detail?.tenantName ?? tenantName,
        platformTenantId: w.platformTenantId,
        customerId: detail?.customerId ?? '',
        customerName: detail?.customerName ?? '',
        billId: '',
      })
    }
  }

  if (!input.canPreviewSingleIncome) {
    rows.push({
      issueType: SINGLE_INCOME_ISSUE_TYPE.CANNOT_PREVIEW,
      errorMessage: '当前不可试算：须至少 1 个已同步账单的项目，且账期未作废',
      projectId: '',
      projectName: '',
      tenantId: '',
      tenantName: '',
      platformTenantId: '',
      customerId: '',
      customerName: '',
      billId: '',
    })
  } else if (!input.canComputeSingleIncome) {
    rows.push({
      issueType: SINGLE_INCOME_ISSUE_TYPE.CANNOT_COMPUTE,
      errorMessage: '账期已发布：仅可试算预览，不可写入（须先撤回发布）',
      projectId: '',
      projectName: '',
      tenantId: '',
      tenantName: '',
      platformTenantId: '',
      customerId: '',
      customerName: '',
      billId: '',
    })
  }

  return rows
}
