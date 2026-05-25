import type { PlatformCostMonthly } from "@/lib/types/finance"
import { parseMoney, toMoneyString } from "@/lib/finance/income-row-utils"

export const COST_TAX_DIVISOR = 1.06

function parsePositiveMoney(value: string | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  if (Number.isNaN(n) || n <= 0) return null
  return n
}

function parseHours(value: string | null | undefined): number {
  if (value == null || value === "") return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

export function toHoursString(n: number): string {
  return n.toFixed(4)
}

export function computeGiftedDurationCostExclTax(
  unitPricePerHour: number,
  voucherCardHours: number,
): number {
  if (unitPricePerHour <= 0 || voucherCardHours <= 0) return 0
  return (unitPricePerHour * voucherCardHours) / COST_TAX_DIVISOR
}

export function computeGrossProfit(
  confirmedRevenueExclTax: number,
  soldDurationCostExclTax: number,
  giftedDurationCostExclTax: number,
): number {
  return (
    confirmedRevenueExclTax -
    soldDurationCostExclTax -
    giftedDurationCostExclTax
  )
}

export function resolveUnitPricePerHour(row: PlatformCostMonthly): number | null {
  return (
    parsePositiveMoney(row.deal_unit_price_per_hour) ??
    parsePositiveMoney(row.list_price_per_hour)
  )
}

export type CostRowOverride = {
  voucher_card_hours?: string | null
  gifted_duration_cost_excl_tax?: string | null
  gross_profit?: string | null
  updated_at: string
}

export function applyCostOverride(
  row: PlatformCostMonthly,
  override: CostRowOverride | undefined,
): PlatformCostMonthly {
  if (!override) return row
  return {
    ...row,
    ...override,
    updated_at: override.updated_at,
  }
}

function sumNumericField(
  records: PlatformCostMonthly[],
  field: keyof Pick<
    PlatformCostMonthly,
    | "balance_consumption"
    | "balance_card_hours"
    | "voucher_card_hours"
    | "confirmed_revenue_excl_tax"
    | "sold_duration_cost_excl_tax"
    | "gifted_duration_cost_excl_tax"
    | "gross_profit"
  >,
): string {
  const total = records.reduce((a, r) => a + parseMoney(r[field]), 0)
  return toMoneyString(total)
}

function sumHoursField(
  records: PlatformCostMonthly[],
  field: "balance_card_hours" | "voucher_card_hours",
): string {
  const total = records.reduce((a, r) => a + parseHours(r[field]), 0)
  return toHoursString(total)
}

/** 按客户经理汇总行重算（仅 record 参与汇总） */
export function recomputeStaffSumRows(
  rows: PlatformCostMonthly[],
): PlatformCostMonthly[] {
  const recordsByStaff = new Map<string, PlatformCostMonthly[]>()
  for (const r of rows) {
    if (r.type !== "record") continue
    const list = recordsByStaff.get(r.staff_id) ?? []
    list.push(r)
    recordsByStaff.set(r.staff_id, list)
  }

  return rows.map((row) => {
    if (row.type !== "sum") return row
    const records = recordsByStaff.get(row.staff_id)
    if (!records?.length) return row
    const latestUpdated = records.reduce<string | null>((latest, r) => {
      const t = r.updated_at ?? r.created_at
      if (!latest || t > latest) return t
      return latest
    }, null)
    return {
      ...row,
      balance_consumption: sumNumericField(records, "balance_consumption"),
      balance_card_hours: sumHoursField(records, "balance_card_hours"),
      voucher_card_hours: sumHoursField(records, "voucher_card_hours"),
      confirmed_revenue_excl_tax: sumNumericField(
        records,
        "confirmed_revenue_excl_tax",
      ),
      sold_duration_cost_excl_tax: sumNumericField(
        records,
        "sold_duration_cost_excl_tax",
      ),
      gifted_duration_cost_excl_tax: sumNumericField(
        records,
        "gifted_duration_cost_excl_tax",
      ),
      gross_profit: sumNumericField(records, "gross_profit"),
      updated_at: latestUpdated ?? row.updated_at,
    }
  })
}

export function mergeCostRowsWithOverrides(
  rows: PlatformCostMonthly[],
  overrides: Record<string, CostRowOverride>,
): PlatformCostMonthly[] {
  const withOverrides = rows.map((row) =>
    applyCostOverride(row, overrides[row.id]),
  )
  return recomputeStaffSumRows(withOverrides)
}

export function validateHoursInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === "") return "请输入调账卡时"
  const n = Number(trimmed)
  if (Number.isNaN(n)) return "请输入有效数字"
  if (n < 0) return "调账卡时不能为负数"
  return null
}

export function deriveCostFieldsAfterVoucherAdjustment(input: {
  row: PlatformCostMonthly
  adjustmentHours: number
  unitPricePerHour: number
}): {
  voucherCardHoursAfter: string
  giftedDurationCostExclTax: string
  grossProfit: string
} {
  const originalHours = parseHours(input.row.voucher_card_hours)
  const finalHours = Math.max(0, originalHours - input.adjustmentHours)
  const gifted = computeGiftedDurationCostExclTax(
    input.unitPricePerHour,
    finalHours,
  )
  const gross = computeGrossProfit(
    parseMoney(input.row.confirmed_revenue_excl_tax),
    parseMoney(input.row.sold_duration_cost_excl_tax),
    gifted,
  )
  return {
    voucherCardHoursAfter: toHoursString(finalHours),
    giftedDurationCostExclTax: toMoneyString(gifted),
    grossProfit: toMoneyString(gross),
  }
}
