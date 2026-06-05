import type { CommissionMonthPhase, OpportunitySource } from '@/lib/crm/commission-constants'

export const COMMISSION_POLICY_CODE = 'elastic_gross_2026h2' as const

export type PolicyRateSlice = {
  sales: number
  marketing: number
  middle: number
}

export const COMMISSION_POLICY_RATES: Record<
  OpportunitySource,
  Record<CommissionMonthPhase, PolicyRateSlice>
> = {
  marketing_sales: {
    months_1_6: { sales: 0.1, marketing: 0.03, middle: 0.03 },
    months_7_to_2026_12: { sales: 0.07, marketing: 0.03, middle: 0.06 },
  },
  sales_self: {
    months_1_6: { sales: 0.15, marketing: 0, middle: 0.03 },
    months_7_to_2026_12: { sales: 0.15, marketing: 0, middle: 0.06 },
  },
  exec_sales: {
    months_1_6: { sales: 0.12, marketing: 0, middle: 0.03 },
    months_7_to_2026_12: { sales: 0.09, marketing: 0, middle: 0.06 },
  },
}

export function lookupPolicyRates(
  opportunitySource: OpportunitySource,
  monthPhase: CommissionMonthPhase,
): PolicyRateSlice {
  return COMMISSION_POLICY_RATES[opportunitySource][monthPhase]
}
