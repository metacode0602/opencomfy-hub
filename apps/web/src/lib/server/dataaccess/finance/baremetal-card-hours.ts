import type { PlatformBillingUnit } from '@/lib/types/platform-pricing'

const HOURS_BY_UNIT: Record<PlatformBillingUnit, number> = {
  hour: 1,
  day: 24,
  week: 168,
  month: 720,
}

export function billingUnitToHours(unit: PlatformBillingUnit): number {
  return HOURS_BY_UNIT[unit]
}

export function computeBaremetalCardHours(input: {
  deviceQty: number
  cardCount: number
  packageQty: number
  billingUnit: PlatformBillingUnit
}): number {
  const { deviceQty, cardCount, packageQty, billingUnit } = input
  if (deviceQty <= 0 || cardCount <= 0 || packageQty <= 0) return 0
  return deviceQty * cardCount * packageQty * billingUnitToHours(billingUnit)
}
