export type SingleIncomeProjectDetail = {
  projectId: string
  projectName: string
  tenantId: string
  tenantName: string
  platformTenantId: string
  customerId: string
  customerName: string
}

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

export type SingleIncomeComputePayload = {
  periodCode: string
  incomeCount: number
  reconciliationIssues: string[]
  rows: SingleIncomePreviewRow[]
  summary: {
    totalIncome: string
    balanceIncome: string
    baremetalIncome: string
    supplementary: string
  }
}
