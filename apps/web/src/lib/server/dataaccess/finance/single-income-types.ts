export type { SingleIncomeIssueRow, SingleIncomeProjectDetail } from '@/lib/finance/single-income-types'

export type SharedPlatformTenantWarningDetail = {
  platformTenantId: string
  tenantId: string
  tenantName: string
  projects: Array<{ projectId: string; projectName: string }>
}

export type SingleIncomePreviewRow = {
  projectId: string
  projectName: string
  tenantId: string
  tenantName: string
  platformTenantId: string
  customerId: string
  customerFullName: string
  customerType: string
  billId: string | null
  supplementaryConsumption: string
  balanceConsumption: string
  bareMetalConsumption: string
  totalConsumption: string
}

import type { SingleIncomeIssueRow } from '@/lib/finance/single-income-types'

export type SingleIncomeComputePayload = {
  periodCode: string
  incomeCount: number
  reconciliationIssues: string[]
  issueRows: SingleIncomeIssueRow[]
  rows: SingleIncomePreviewRow[]
  summary: {
    totalIncome: string
    balanceIncome: string
    baremetalIncome: string
    supplementary: string
  }
}
