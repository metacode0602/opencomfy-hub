import type { PlatformIncomeMonthly } from "@/lib/types/finance"

export const DEMO_PERIOD_ID = "demo-2025-04"

export const DEMO_PERIOD = {
  id: DEMO_PERIOD_ID,
  period_code: "2025-04",
  period_start: "2025-04-01",
  period_end: "2025-04-30",
  status: "imported" as const,
}

export const DEMO_PRICE_WINDOWS = [
  { id: "win-1", windowStart: "2025-04-01", windowEnd: "2025-04-15", sortOrder: 0 },
  { id: "win-2", windowStart: "2025-04-16", windowEnd: "2025-04-30", sortOrder: 1 },
]

export const MOCK_INCOME_ROWS: PlatformIncomeMonthly[] = [
  {
    id: "inc-1",
    billing_period_id: DEMO_PERIOD_ID,
    project_name: "智算平台-A项目",
    tenant_name: "tenant-alpha",
    tenant_id: "t-1",
    tenant_platform_id: "10001",
    customer_id: "c-1",
    customer_full_name: "某某科技有限公司",
    project_id: "p-1",
    supplementary_consumption: "0",
    balance_consumption: "128500.00",
    bare_metal_consumption: "42000.00",
    total_consumption: "170500.00",
    created_at: "2025-05-01T08:00:00.000Z",
    updated_at: null,
  },
  {
    id: "inc-2",
    billing_period_id: DEMO_PERIOD_ID,
    project_name: "智算平台-B项目",
    tenant_name: "tenant-beta",
    tenant_id: "t-2",
    tenant_platform_id: "10002",
    customer_id: "c-2",
    customer_full_name: "另一网络股份有限公司",
    project_id: "p-2",
    supplementary_consumption: "0",
    balance_consumption: "86500.00",
    bare_metal_consumption: "0",
    total_consumption: "86500.00",
    created_at: "2025-05-01T08:00:00.000Z",
    updated_at: null,
  },
]

/** v2.1 精简 cost 汇总行（含 staff_name） */
export type DemoCostSummaryRow = {
  id: string
  staff_id: string
  staff_name: string
  idc_name: string
  idc_code: string
  card_type: string
  balance_consumption: string
  balance_card_hours: string
  voucher_card_hours: string
  confirmed_revenue_excl_tax: string
  sold_duration_cost_excl_tax: string
  gifted_duration_cost_excl_tax: string
  gross_profit: string
}

export const MOCK_COST_ROWS: DemoCostSummaryRow[] = [
  {
    id: "cost-1",
    staff_id: "staff-zhang",
    staff_name: "张三",
    idc_name: "华北二区",
    idc_code: "cn-north-2",
    card_type: "A800",
    balance_consumption: "98500.00",
    balance_card_hours: "1240.5000",
    voucher_card_hours: "120.0000",
    confirmed_revenue_excl_tax: "92924.53",
    sold_duration_cost_excl_tax: "61200.00",
    gifted_duration_cost_excl_tax: "4800.00",
    gross_profit: "26924.53",
  },
  {
    id: "cost-2",
    staff_id: "staff-zhang",
    staff_name: "张三",
    idc_name: "华北二区",
    idc_code: "cn-north-2",
    card_type: "H800",
    balance_consumption: "30000.00",
    balance_card_hours: "380.0000",
    voucher_card_hours: "0",
    confirmed_revenue_excl_tax: "28301.89",
    sold_duration_cost_excl_tax: "19500.00",
    gifted_duration_cost_excl_tax: "0",
    gross_profit: "8801.89",
  },
  {
    id: "cost-3",
    staff_id: "staff-li",
    staff_name: "李四",
    idc_name: "华东一区",
    idc_code: "cn-east-1",
    card_type: "A800",
    balance_consumption: "86500.00",
    balance_card_hours: "980.2500",
    voucher_card_hours: "45.5000",
    confirmed_revenue_excl_tax: "81603.77",
    sold_duration_cost_excl_tax: "52800.00",
    gifted_duration_cost_excl_tax: "2100.00",
    gross_profit: "26703.77",
  },
]

export function sumIncome(rows: PlatformIncomeMonthly[]) {
  let total = 0
  let supplementary = 0
  for (const r of rows) {
    total += Number(r.total_consumption) || 0
    supplementary += Number(r.supplementary_consumption) || 0
  }
  return { totalIncome: total, supplementary }
}

export function sumCost(rows: DemoCostSummaryRow[]) {
  let totalCost = 0
  let gross = 0
  for (const r of rows) {
    totalCost +=
      (Number(r.sold_duration_cost_excl_tax) || 0) +
      (Number(r.gifted_duration_cost_excl_tax) || 0)
    gross += Number(r.gross_profit) || 0
  }
  return { totalCost, totalGrossProfit: gross }
}
