import {
  formatPlatformPeriodDateTime,
  formatPlatformPeriodRange,
} from '@/lib/platform-pricing/datetime'
import type {
  ContractPricingMode,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
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
    return record.unitPricePerHour != null ? `¥${record.unitPricePerHour}/小时` : '—'
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
  if (row.cooperationMode === 'card_time') {
    const prev = row.previousUnitPricePerHour != null ? `¥${row.previousUnitPricePerHour}` : '—'
    const next = row.newUnitPricePerHour != null ? `¥${row.newUnitPricePerHour}` : '—'
    return { prev, next, unit: '/小时' }
  }
  const prev = row.previousRevenueSharePercent != null ? `${row.previousRevenueSharePercent}%` : '—'
  const next = row.newRevenueSharePercent != null ? `${row.newRevenueSharePercent}%` : '—'
  return { prev, next, unit: '' }
}
