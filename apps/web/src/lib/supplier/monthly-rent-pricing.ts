/** 供应商成本侧计费单位（与 platform billing_unit 子集一致） */
export type SupplierBillingUnit = 'hour' | 'month'

export const DEFAULT_CARDS_PER_MACHINE = 8

export function normalizeSupplierBillingUnit(
  value: string | null | undefined,
): SupplierBillingUnit {
  return value === 'month' ? 'month' : 'hour'
}

/** 自然月天数；reference 为 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss */
export function daysInNaturalMonth(reference: string): number {
  const datePart = reference.trim().slice(0, 10)
  const [yearStr, monthStr] = datePart.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!year || !month || month < 1 || month > 12) return 30
  return new Date(year, month, 0).getDate()
}

export function deriveCardHourPriceFromMonthlyRent(input: {
  monthlyRentPerMachine: number
  cardsPerMachine: number
  referenceDate: string
}): number | null {
  const { monthlyRentPerMachine, cardsPerMachine, referenceDate } = input
  if (monthlyRentPerMachine <= 0 || cardsPerMachine <= 0) return null
  const days = daysInNaturalMonth(referenceDate)
  if (days <= 0) return null
  return monthlyRentPerMachine / days / 24 / cardsPerMachine
}

export type StoredCardTimePricingInput = {
  billingUnit?: string | null
  unitPrice?: string | number | null
  unitPricePerHour?: string | number | null
  cardsPerMachine?: number | null
  effectiveFrom: string
}

function parsePositiveNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(n) || n <= 0) return null
  return n
}

/** 从 DB 存储解析卡时单价；月租按 referenceDate（默认 effectiveFrom）折算 */
export function resolveCardTimeUnitPrice(
  input: StoredCardTimePricingInput,
  referenceDate?: string,
): number | null {
  const billingUnit = normalizeSupplierBillingUnit(input.billingUnit)
  const ref = referenceDate ?? input.effectiveFrom

  if (billingUnit === 'month') {
    const monthlyRent = parsePositiveNumber(input.unitPrice)
    const cards = input.cardsPerMachine ?? DEFAULT_CARDS_PER_MACHINE
    if (monthlyRent == null) return null
    return deriveCardHourPriceFromMonthlyRent({
      monthlyRentPerMachine: monthlyRent,
      cardsPerMachine: cards,
      referenceDate: ref,
    })
  }

  return (
    parsePositiveNumber(input.unitPrice) ?? parsePositiveNumber(input.unitPricePerHour)
  )
}

export function formatCardHourPrice(value: number): string {
  if (value >= 1) return value.toFixed(4)
  return value.toFixed(4)
}

export function formatMonthlyRentPricingLabel(input: {
  billingUnit: SupplierBillingUnit
  unitPrice: number
  cardsPerMachine: number
  effectiveFrom: string
}): string {
  if (input.billingUnit === 'hour') {
    return `¥${input.unitPrice}/小时`
  }
  const derived = deriveCardHourPriceFromMonthlyRent({
    monthlyRentPerMachine: input.unitPrice,
    cardsPerMachine: input.cardsPerMachine,
    referenceDate: input.effectiveFrom,
  })
  const days = daysInNaturalMonth(input.effectiveFrom)
  const hourly =
    derived != null ? ` (≈¥${formatCardHourPrice(derived)}/时)` : ''
  return `¥${input.unitPrice}/月${hourly} · ${days}天/${input.cardsPerMachine}卡`
}
