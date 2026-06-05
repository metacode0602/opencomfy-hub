import { COMMISSION_POLICY_CODE } from '@/lib/crm/commission-policy-rates'

export { COMMISSION_POLICY_CODE }

export const DERIVE_RECIPIENT_ROLES = {
  salesIndividual: 'sales_individual',
  accountManagerGross: 'account_manager_gross',
  marketingDeptPool: 'marketing_dept_pool',
  middleOfficeDeptPool: 'middle_office_dept_pool',
} as const

export const DERIVE_ISSUE_CODES = {
  missingExcelImports: 'missing_excel_imports',
  missingSourceLines: 'missing_source_lines',
  pendingPricing: 'pending_pricing',
  pendingAllocation: 'pending_allocation',
  missingAccountManager: 'missing_account_manager',
  missingOpportunitySource: 'missing_opportunity_source',
  missingMonthPhase: 'missing_month_phase',
  managerExcludedSales: 'manager_excluded_sales',
  outsidePolicyWindow: 'outside_policy_window',
} as const

export const DERIVE_DEPT_MARKETING = '市场'
export const DERIVE_DEPT_MIDDLE = '中台'
