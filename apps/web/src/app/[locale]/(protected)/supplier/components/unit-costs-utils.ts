import {
  formatPlatformPeriodDateTime,
  formatPlatformPeriodRange,
} from '@/lib/platform-pricing/datetime'
import type {
  ContractPricingMode,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import {
  DEFAULT_CARDS_PER_MACHINE,
  formatMonthlyRentPricingLabel,
  normalizeSupplierBillingUnit,
} from '@/lib/supplier/monthly-rent-pricing'
import { summarizeRatioBandTiers } from '@/lib/supplier/revenue-share-ratio-tiers'

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return formatPlatformPeriodDateTime(value)
}

export function formatEffectiveRange(from: string, to?: string | null) {
  return formatPlatformPeriodRange(from, to ?? null)
}

export function getRecordPricingMode(record: SupplierPricingRecord): ContractPricingMode {
  return record.pricingMode ?? (record.cooperationMode === 'card_time' ? 'card_time' : 'revenue_share')
}

export function pricingValueLabel(record: SupplierPricingRecord) {
  const mode = getRecordPricingMode(record)
  if (mode === 'card_time') {
    const billingUnit = normalizeSupplierBillingUnit(record.billingUnit)
    const unitPrice = record.unitPrice ?? record.unitPricePerHour
    if (unitPrice == null) return '—'
    if (billingUnit === 'month') {
      return formatMonthlyRentPricingLabel({
        billingUnit: 'month',
        unitPrice,
        cardsPerMachine: record.cardsPerMachine ?? DEFAULT_CARDS_PER_MACHINE,
        effectiveFrom: record.effectiveFrom,
      })
    }
    return `¥${unitPrice}/小时`
  }
  if (mode === 'revenue_share') {
    return record.revenueSharePercent != null ? `${record.revenueSharePercent}%` : '—'
  }
  if (mode === 'tiered_revenue_share') {
    const tiers = record.pricingTiers?.length ?? 0
    return tiers > 0 ? summarizeRatioBandTiers(record.pricingTiers) : '—'
  }
  const tiers = record.pricingTiers?.length ?? 0
  return tiers > 0 ? `${tiers} 档阶梯` : '—'
}

export function historyChangeLabel(row: SupplierPricingHistory) {
  const billingUnit = normalizeSupplierBillingUnit(row.billingUnit)
  if (row.cooperationMode === 'card_time' && billingUnit === 'month') {
    const prev =
      row.previousUnitPrice != null ? `¥${row.previousUnitPrice}` : '—'
    const next = row.newUnitPrice != null ? `¥${row.newUnitPrice}` : '—'
    return { prev, next, unit: '/月（整租）' }
  }
  if (row.cooperationMode === 'card_time') {
    const prev =
      row.previousUnitPrice != null
        ? `¥${row.previousUnitPrice}`
        : row.previousUnitPricePerHour != null
          ? `¥${row.previousUnitPricePerHour}`
          : '—'
    const next =
      row.newUnitPrice != null
        ? `¥${row.newUnitPrice}`
        : row.newUnitPricePerHour != null
          ? `¥${row.newUnitPricePerHour}`
          : '—'
    return { prev, next, unit: '/小时' }
  }
  const prev = row.previousRevenueSharePercent != null ? `${row.previousRevenueSharePercent}%` : '—'
  const next = row.newRevenueSharePercent != null ? `${row.newRevenueSharePercent}%` : '—'
  return { prev, next, unit: '' }
}
