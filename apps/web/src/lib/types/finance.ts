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
  tenant_platform_id: string
  customer_id: string | null
  customer_full_name: string | null
  project_id: string | null
  supplementary_consumption: string | null
  balance_consumption: string | null
  bare_metal_consumption: string | null
  total_consumption: string
  created_at: string
  updated_at: string | null
}

/** 补充消费调整类型 */
export type SupplementaryConsumptionType =
  | "offline_order"
  | "manual_correction"
  | "promotion"
  | "compensation"
  | "other"

export const SUPPLEMENTARY_CONSUMPTION_TYPE_LABELS: Record<
  SupplementaryConsumptionType,
  string
> = {
  offline_order: "线下订单",
  manual_correction: "人工修正",
  promotion: "促销优惠",
  compensation: "补偿",
  other: "其他",
}

/** 补充消费修改历史 */
export type SupplementaryConsumptionHistoryEntry = {
  id: string
  income_id: string
  previous_value: string | null
  new_value: string
  type: SupplementaryConsumptionType
  remark: string
  created_at: string
}

/** 调账历史（余额消费、裸金属消费分别记录原值与调整后值） */
export type IncomeAdjustmentHistoryEntry = {
  id: string
  income_id: string
  balance_consumption_before: string | null
  balance_consumption_after: string | null
  bare_metal_consumption_before: string | null
  bare_metal_consumption_after: string | null
  reason: string
  created_at: string
}

/** 余额卡时调账历史 */
export type VoucherCardHoursAdjustmentHistoryEntry = {
  id: string
  cost_id: string
  balance_card_hours_before: string | null
  balance_card_hours_after: string | null
  adjustment_hours: string
  sold_duration_cost_excl_tax_before: string | null
  sold_duration_cost_excl_tax_after: string | null
  gross_profit_before: string | null
  gross_profit_after: string | null
  unit_price_per_hour: string
  reason: string
  created_at: string
}

/** 平台月度成本 platform_cost_monthly — type: record 分项 / sum 汇总 */
export type PlatformCostMonthlyType = "record" | "sum"

export type PlatformCostMonthly = {
  id: string
  billing_period_id: string
  supplier_unit_cost_id: string | null
  account_manager: string | null
  staff_name?: string | null
  staff_id: string | null
  data_center_id?: string | null
  gpu_card_type_id?: string | null
  idc_name: string | null
  idc_code: string | null
  card_type: string | null
  type: PlatformCostMonthlyType
  total_consumption?: string | null
  voucher_consumption?: string | null
  balance_consumption: string | null
  total_card_hours?: string | null
  balance_card_hours: string | null
  voucher_card_hours: string | null
  confirmed_revenue_excl_tax: string | null
  sold_duration_cost_excl_tax: string | null
  gifted_duration_cost_excl_tax: string | null
  gross_profit: string | null
  deal_unit_price_per_hour: string | null
  list_price_per_hour: string | null
  pricing_snapshot_id?: string | null
  source_line_ids?: string[] | null
  created_at: string
  updated_at: string | null
}
