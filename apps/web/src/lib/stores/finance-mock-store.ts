import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  BillingPeriod,
  PlatformCostMonthly,
  PlatformIncomeMonthly,
} from "@/lib/types/finance"

export type FinanceMockBundle = {
  period: BillingPeriod
  income: PlatformIncomeMonthly[]
  cost: PlatformCostMonthly[]
}

type FinanceMockState = {
  bundles: FinanceMockBundle[]
  addBundle: (bundle: FinanceMockBundle) => void
  clearBundles: () => void
}

export const useFinanceMockStore = create<FinanceMockState>()(
  persist(
    (set) => ({
      bundles: [],
      addBundle: (bundle) =>
        set((s) => ({
          bundles: [...s.bundles, bundle],
        })),
      clearBundles: () => set({ bundles: [] }),
    }),
    { name: "finance-mock-bundles-v1" },
  ),
)
