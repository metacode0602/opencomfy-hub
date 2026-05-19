import {
  applyCostOverride,
  deriveCostFieldsAfterVoucherAdjustment,
} from "@/lib/finance/cost-row-utils"
import type { CostRowOverride } from "@/lib/finance/cost-row-utils"
import type {
  PlatformCostMonthly,
  VoucherCardHoursAdjustmentHistoryEntry,
} from "@/lib/types/finance"
import { create } from "zustand"
import { persist } from "zustand/middleware"

type FinanceCostOpsState = {
  overrides: Record<string, CostRowOverride>
  voucherAdjustmentHistories: Record<
    string,
    VoucherCardHoursAdjustmentHistoryEntry[]
  >
  applyVoucherCardHoursAdjustment: (input: {
    baseRow: PlatformCostMonthly
    adjustmentHours: number
    reason: string
    unitPricePerHour: number
  }) => void
  getVoucherAdjustmentHistory: (
    costId: string,
  ) => VoucherCardHoursAdjustmentHistoryEntry[]
}

function newId(): string {
  return `cost-hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function resolveCurrentRow(
  base: PlatformCostMonthly,
  overrides: Record<string, CostRowOverride>,
): PlatformCostMonthly {
  return applyCostOverride(base, overrides[base.id])
}

export const useFinanceCostOpsStore = create<FinanceCostOpsState>()(
  persist(
    (set, get) => ({
      overrides: {},
      voucherAdjustmentHistories: {},

      getVoucherAdjustmentHistory: (costId) =>
        get().voucherAdjustmentHistories[costId] ?? [],

      applyVoucherCardHoursAdjustment: ({
        baseRow,
        adjustmentHours,
        reason,
        unitPricePerHour,
      }) => {
        const now = new Date().toISOString()
        const current = resolveCurrentRow(baseRow, get().overrides)
        const derived = deriveCostFieldsAfterVoucherAdjustment({
          row: current,
          adjustmentHours,
          unitPricePerHour,
        })

        const entry: VoucherCardHoursAdjustmentHistoryEntry = {
          id: newId(),
          cost_id: baseRow.id,
          voucher_card_hours_before: current.voucher_card_hours,
          voucher_card_hours_after: derived.voucherCardHoursAfter,
          adjustment_hours: String(adjustmentHours),
          gifted_duration_cost_excl_tax_before:
            current.gifted_duration_cost_excl_tax,
          gifted_duration_cost_excl_tax_after:
            derived.giftedDurationCostExclTax,
          gross_profit_before: current.gross_profit,
          gross_profit_after: derived.grossProfit,
          unit_price_per_hour: String(unitPricePerHour),
          reason: reason.trim(),
          created_at: now,
        }

        const nextFields = {
          voucher_card_hours: derived.voucherCardHoursAfter,
          gifted_duration_cost_excl_tax: derived.giftedDurationCostExclTax,
          gross_profit: derived.grossProfit,
          updated_at: now,
        }

        set((s) => {
          const prevOverride = s.overrides[baseRow.id]
          return {
            voucherAdjustmentHistories: {
              ...s.voucherAdjustmentHistories,
              [baseRow.id]: [
                ...(s.voucherAdjustmentHistories[baseRow.id] ?? []),
                entry,
              ],
            },
            overrides: {
              ...s.overrides,
              [baseRow.id]: {
                ...prevOverride,
                ...nextFields,
              },
            },
          }
        })
      },
    }),
    { name: "finance-cost-ops-v1" },
  ),
)
