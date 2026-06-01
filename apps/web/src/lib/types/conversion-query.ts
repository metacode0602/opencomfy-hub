import type { ProjectStage } from '@/lib/types/crm'

export type ConversionQueryRow = {
  platformTenantId: string
  tenantName: string
  companyName?: string
  contactPhone?: string
  localTenantId?: string
  customerId?: string
  customerName?: string
  projectId?: string
  projectName?: string
  projectStage?: ProjectStage
  isConverted: boolean
  balance: number
  balanceSource: 'local' | 'platform' | 'none'
  rechargeCount: number
  rechargeTotal: number
  customerConversionDate?: string
  errors: string[]
}

export type ConversionQueryResult = {
  rows: ConversionQueryRow[]
  summary: {
    total: number
    withProject: number
    converted: number
    convertible: number
  }
}

export type ConversionCommitResult = {
  converted: number
  errors: { projectId: string; message: string }[]
}
