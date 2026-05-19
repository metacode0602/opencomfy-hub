import type { PlatformIncomeMonthly } from "@/lib/types/finance"

export function parseMoney(value: string | null | undefined): number {
  if (value == null || value === "") return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

export function toMoneyString(n: number): string {
  return n.toFixed(4)
}

export function computeTotalConsumption(row: {
  supplementary_consumption: string | null
  balance_consumption: string | null
  bare_metal_consumption: string | null
}): string {
  const total =
    parseMoney(row.supplementary_consumption) +
    parseMoney(row.balance_consumption) +
    parseMoney(row.bare_metal_consumption)
  return toMoneyString(total)
}

export type IncomeRowOverride = {
  supplementary_consumption?: string | null
  balance_consumption?: string | null
  bare_metal_consumption?: string | null
  total_consumption?: string
  updated_at: string
}

export function applyIncomeOverride(
  row: PlatformIncomeMonthly,
  override: IncomeRowOverride | undefined,
): PlatformIncomeMonthly {
  if (!override) return row
  const merged = {
    ...row,
    ...override,
    updated_at: override.updated_at,
  }
  return {
    ...merged,
    total_consumption: computeTotalConsumption(merged),
  }
}

export function mergeIncomeRowsWithOverrides(
  rows: PlatformIncomeMonthly[],
  overrides: Record<string, IncomeRowOverride>,
): PlatformIncomeMonthly[] {
  return rows.map((row) => applyIncomeOverride(row, overrides[row.id]))
}

export function validateMoneyInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === "") return "请输入金额"
  const n = Number(trimmed)
  if (Number.isNaN(n)) return "请输入有效数字"
  if (n < 0) return "金额不能为负数"
  return null
}
