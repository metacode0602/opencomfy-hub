/** 账期 billing_period */
export type BillingPeriod = {
  id: string
  period_code: string
  total_income: string
  total_cost: string
  supplementary: string
  balance_income: string
  baremetal_income: string
  period_start: string
  period_end: string
}

/** 平台月度收入明细 platform_income_monthly */
export type PlatformIncomeMonthly = {
  id: string
  billing_period_id: string
  project_name: string | null
  tenant_name: string
  tenant_id: string
  supplementary_consumption: string | null
  balance_consumption: string | null
  bare_metal_consumption: string | null
  total_consumption: string
  created_at: string
  updated_at: string | null
}

/** 平台月度成本 platform_cost_monthly — type: record 分项 / sum 汇总 */
export type PlatformCostMonthlyType = "record" | "sum"

export type PlatformCostMonthly = {
  id: string
  billing_period_id: string
  supplier_unit_cost_id: string | null
  account_manager: string
  staff_id: string
  idc_name: string | null
  idc_code: string | null
  card_type: string | null
  type: PlatformCostMonthlyType
  balance_consumption: string | null
  balance_card_hours: string | null
  voucher_card_hours: string | null
  confirmed_revenue_excl_tax: string | null
  sold_duration_cost_excl_tax: string | null
  gifted_duration_cost_excl_tax: string | null
  gross_profit: string | null
  created_at: string
  updated_at: string | null
}
