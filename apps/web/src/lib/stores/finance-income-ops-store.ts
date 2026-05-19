import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  computeTotalConsumption,
  type IncomeRowOverride,
  toMoneyString,
} from "@/lib/finance/income-row-utils"
import type { PlatformIncomeMonthly } from "@/lib/types/finance"
import type {
  IncomeAdjustmentHistoryEntry,
  SupplementaryConsumptionHistoryEntry,
  SupplementaryConsumptionType,
} from "@/lib/types/finance"

type FinanceIncomeOpsState = {
  overrides: Record<string, IncomeRowOverride>
  supplementaryHistories: Record<string, SupplementaryConsumptionHistoryEntry[]>
  adjustmentHistories: Record<string, IncomeAdjustmentHistoryEntry[]>
  applySupplementaryChange: (input: {
    baseRow: PlatformIncomeMonthly
    newValue: string
    type: SupplementaryConsumptionType
    remark: string
  }) => void
  applyIncomeAdjustment: (input: {
    baseRow: PlatformIncomeMonthly
    balanceAfter: string | null
    bareMetalAfter: string | null
    reason: string
  }) => void
  getSupplementaryHistory: (incomeId: string) => SupplementaryConsumptionHistoryEntry[]
  getAdjustmentHistory: (incomeId: string) => IncomeAdjustmentHistoryEntry[]
}

function newId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function resolveCurrentRow(
  base: PlatformIncomeMonthly,
  overrides: Record<string, IncomeRowOverride>,
): PlatformIncomeMonthly {
  const o = overrides[base.id]
  if (!o) return base
  const merged = { ...base, ...o, updated_at: o.updated_at }
  return {
    ...merged,
    total_consumption: computeTotalConsumption(merged),
  }
}

export const useFinanceIncomeOpsStore = create<FinanceIncomeOpsState>()(
  persist(
    (set, get) => ({
      overrides: {},
      supplementaryHistories: {},
      adjustmentHistories: {},

      getSupplementaryHistory: (incomeId) =>
        get().supplementaryHistories[incomeId] ?? [],

      getAdjustmentHistory: (incomeId) =>
        get().adjustmentHistories[incomeId] ?? [],

      applySupplementaryChange: ({ baseRow, newValue, type, remark }) => {
        const now = new Date().toISOString()
        const current = resolveCurrentRow(baseRow, get().overrides)
        const entry: SupplementaryConsumptionHistoryEntry = {
          id: newId(),
          income_id: baseRow.id,
          previous_value: current.supplementary_consumption,
          new_value: toMoneyString(Number(newValue)),
          type,
          remark: remark.trim(),
          created_at: now,
        }
        const nextFields = {
          supplementary_consumption: entry.new_value,
          updated_at: now,
        }
        set((s) => {
          const prevOverride = s.overrides[baseRow.id]
          const merged = { ...baseRow, ...prevOverride, ...nextFields }
          return {
            supplementaryHistories: {
              ...s.supplementaryHistories,
              [baseRow.id]: [
                ...(s.supplementaryHistories[baseRow.id] ?? []),
                entry,
              ],
            },
            overrides: {
              ...s.overrides,
              [baseRow.id]: {
                ...prevOverride,
                ...nextFields,
                total_consumption: computeTotalConsumption(merged),
              },
            },
          }
        })
      },

      applyIncomeAdjustment: ({
        baseRow,
        balanceAfter,
        bareMetalAfter,
        reason,
      }) => {
        const now = new Date().toISOString()
        const current = resolveCurrentRow(baseRow, get().overrides)
        const entry: IncomeAdjustmentHistoryEntry = {
          id: newId(),
          income_id: baseRow.id,
          balance_consumption_before: current.balance_consumption,
          balance_consumption_after: balanceAfter,
          bare_metal_consumption_before: current.bare_metal_consumption,
          bare_metal_consumption_after: bareMetalAfter,
          reason: reason.trim(),
          created_at: now,
        }
        const nextFields = {
          balance_consumption: balanceAfter,
          bare_metal_consumption: bareMetalAfter,
          updated_at: now,
        }
        set((s) => {
          const prevOverride = s.overrides[baseRow.id]
          const merged = { ...baseRow, ...prevOverride, ...nextFields }
          return {
            adjustmentHistories: {
              ...s.adjustmentHistories,
              [baseRow.id]: [
                ...(s.adjustmentHistories[baseRow.id] ?? []),
                entry,
              ],
            },
            overrides: {
              ...s.overrides,
              [baseRow.id]: {
                ...prevOverride,
                ...nextFields,
                total_consumption: computeTotalConsumption(merged),
              },
            },
          }
        })
      },
    }),
    { name: "finance-income-ops-v1" },
  ),
)
