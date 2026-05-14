import {
  mockBillingPeriods,
  mockPlatformCostMonthly,
  mockPlatformIncomeMonthly,
} from "@/lib/data/finance-mock"
import type { FinanceMockBundle } from "@/lib/stores/finance-mock-store"
import type {
  BillingPeriod,
  PlatformCostMonthly,
  PlatformIncomeMonthly,
} from "@/lib/types/finance"

export function resolveBillingPeriod(
  id: string,
  bundles: FinanceMockBundle[],
): BillingPeriod | undefined {
  const fromMock = mockBillingPeriods.find((p) => p.id === id)
  if (fromMock) return fromMock
  return bundles.find((b) => b.period.id === id)?.period
}

export function listIncomeForPeriod(
  billingPeriodId: string,
  bundles: FinanceMockBundle[],
): PlatformIncomeMonthly[] {
  const fromMock = mockPlatformIncomeMonthly.filter(
    (r) => r.billing_period_id === billingPeriodId,
  )
  const fromBundles = bundles.flatMap((b) =>
    b.period.id === billingPeriodId ? b.income : [],
  )
  return [...fromMock, ...fromBundles]
}

export function listCostForPeriod(
  billingPeriodId: string,
  bundles: FinanceMockBundle[],
): PlatformCostMonthly[] {
  const fromMock = mockPlatformCostMonthly.filter(
    (r) => r.billing_period_id === billingPeriodId,
  )
  const fromBundles = bundles.flatMap((b) =>
    b.period.id === billingPeriodId ? b.cost : [],
  )
  return [...fromMock, ...fromBundles]
}
