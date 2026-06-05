import type { PlatformCostMonthly } from "@/lib/types/finance"
import type { VoucherCardHoursAdjustmentHistoryEntry } from "@/lib/types/finance"
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

export function computeSoldDurationCostExclTax(
  unitPricePerHour: number,
  balanceCardHours: number,
): number {
  if (unitPricePerHour <= 0 || balanceCardHours <= 0) return 0
  return (unitPricePerHour * balanceCardHours) / COST_TAX_DIVISOR
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

export function computeConfirmedRevenueExclTax(balanceConsumption: number): number {
  if (balanceConsumption <= 0) return 0
  return balanceConsumption / COST_TAX_DIVISOR
}

/** 余额卡时调账含税金额 = 调账值 × 单价（保留正负号） */
export function computeBalanceAdjustmentAmount(
  adjustmentHours: number,
  unitPricePerHour: number,
): number {
  return adjustmentHours * unitPricePerHour
}

/** 调账值为正则显示 +，为负则显示 − */
export function formatSignedAdjustmentMoney(
  amount: number,
  fractionDigits = 2,
): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  if (amount > 0) return `+${formatted}`
  if (amount < 0) return `−${formatted}`
  return formatted
}

export function computeAdjustmentAmountFromHistoryEntry(
  entry: Pick<
    VoucherCardHoursAdjustmentHistoryEntry,
    "adjustment_hours" | "unit_price_per_hour"
  >,
): number {
  return computeBalanceAdjustmentAmount(
    Number(entry.adjustment_hours),
    Number(entry.unit_price_per_hour),
  )
}

export function sumAdjustmentAmountsFromHistories(
  entries: VoucherCardHoursAdjustmentHistoryEntry[],
): number {
  return entries.reduce(
    (acc, entry) =>
      acc +
      (Number.isNaN(Number(entry.adjustment_hours)) ||
      Number.isNaN(Number(entry.unit_price_per_hour))
        ? 0
        : computeAdjustmentAmountFromHistoryEntry(entry)),
    0,
  )
}

export function resolveUnitPricePerHour(row: PlatformCostMonthly): number | null {
  return (
    parsePositiveMoney(row.deal_unit_price_per_hour) ??
    parsePositiveMoney(row.list_price_per_hour)
  )
}

export type CostRowOverride = {
  balance_card_hours?: string | null
  voucher_card_hours?: string | null
  sold_duration_cost_excl_tax?: string | null
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

function buildCostSumFields(records: PlatformCostMonthly[]) {
  const latestUpdated = records.reduce<string | null>((latest, r) => {
    const t = r.updated_at ?? r.created_at
    if (!latest || t > latest) return t
    return latest
  }, null)
  return {
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
    updated_at: latestUpdated,
  }
}

/** 按 record 重算客户经理汇总行与账期合计行 */
export function recomputeCostSumRows(
  rows: PlatformCostMonthly[],
): PlatformCostMonthly[] {
  const records = rows.filter((r) => r.type === "record")
  const recordsByStaff = new Map<string, PlatformCostMonthly[]>()
  for (const r of records) {
    if (!r.staff_id) continue
    const list = recordsByStaff.get(r.staff_id) ?? []
    list.push(r)
    recordsByStaff.set(r.staff_id, list)
  }

  return rows.map((row) => {
    if (row.type !== "sum") return row
    const sourceRecords = row.staff_id
      ? recordsByStaff.get(row.staff_id)
      : records
    if (!sourceRecords?.length) return row
    const fields = buildCostSumFields(sourceRecords)
    return {
      ...row,
      ...fields,
      updated_at: fields.updated_at ?? row.updated_at,
    }
  })
}

/** @deprecated 使用 recomputeCostSumRows */
export const recomputeStaffSumRows = recomputeCostSumRows

export function mergeCostRowsWithOverrides(
  rows: PlatformCostMonthly[],
  overrides: Record<string, CostRowOverride>,
): PlatformCostMonthly[] {
  const withOverrides = rows.map((row) =>
    applyCostOverride(row, overrides[row.id]),
  )
  return recomputeCostSumRows(withOverrides)
}

export function validateHoursInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === "") return "请输入调账卡时"
  const n = Number(trimmed)
  if (Number.isNaN(n)) return "请输入有效数字"
  if (n < 0) return "调账卡时不能为负数"
  return null
}

/** 支持正负调账值（原值 + 调账值 = 最终值） */
export function validateSignedHoursInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === "") return "请输入调账卡时"
  const n = Number(trimmed)
  if (Number.isNaN(n)) return "请输入有效数字"
  if (n === 0) return "调账卡时不能为 0"
  return null
}

export function deriveCostFieldsAfterBalanceAdjustment(input: {
  row: PlatformCostMonthly
  adjustmentHours: number
  unitPricePerHour: number
}): {
  balanceCardHoursAfter: string
  balanceConsumptionAfter: string
  confirmedRevenueExclTax: string
  soldDurationCostExclTax: string
  grossProfit: string
  adjustmentAmount: string
} {
  const adjustmentAmount = computeBalanceAdjustmentAmount(
    input.adjustmentHours,
    input.unitPricePerHour,
  )
  const originalHours = parseHours(input.row.balance_card_hours)
  const finalHours = Math.max(0, originalHours + input.adjustmentHours)
  const balanceConsumption = Math.max(
    0,
    parseMoney(input.row.balance_consumption) + adjustmentAmount,
  )
  const confirmed = computeConfirmedRevenueExclTax(balanceConsumption)
  const sold = computeSoldDurationCostExclTax(
    input.unitPricePerHour,
    finalHours,
  )
  const gross = computeGrossProfit(
    confirmed,
    sold,
    parseMoney(input.row.gifted_duration_cost_excl_tax),
  )
  return {
    balanceCardHoursAfter: toHoursString(finalHours),
    balanceConsumptionAfter: toMoneyString(balanceConsumption),
    confirmedRevenueExclTax: toMoneyString(confirmed),
    soldDurationCostExclTax: toMoneyString(sold),
    grossProfit: toMoneyString(gross),
    adjustmentAmount: toMoneyString(adjustmentAmount),
  }
}
