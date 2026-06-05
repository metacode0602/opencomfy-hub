export const OPPORTUNITY_SOURCE_VALUES = [
  'marketing_sales',
  'sales_self',
  'exec_sales',
] as const

export type OpportunitySource = (typeof OPPORTUNITY_SOURCE_VALUES)[number]

export const OPPORTUNITY_SOURCE_LABELS: Record<OpportunitySource, string> = {
  marketing_sales: '市场 + 销售',
  sales_self: '销售自拓',
  exec_sales: '高管 + 销售',
}

export const CONVERSION_REASON_VALUES = [
  'offline_signing',
  'online_signing',
  'online_registration_only',
] as const

export type ConversionReason = (typeof CONVERSION_REASON_VALUES)[number]

export const CONVERSION_REASON_LABELS: Record<ConversionReason, string> = {
  offline_signing: '线下签约',
  online_signing: '线上签约',
  online_registration_only: '仅线上注册',
}

export const COMMISSION_MONTH_PHASE_VALUES = [
  'months_1_6',
  'months_7_to_2026_12',
] as const

export type CommissionMonthPhase = (typeof COMMISSION_MONTH_PHASE_VALUES)[number]

export const COMMISSION_MONTH_PHASE_LABELS: Record<CommissionMonthPhase, string> = {
  months_1_6: '成交后第 1～6 月',
  months_7_to_2026_12: '第 7 月～2026.12',
}

/** 弹性算力提成政策执行期 */
export const COMMISSION_POLICY_START_MONTH = '2026-05'
export const COMMISSION_POLICY_END_MONTH = '2026-12'
