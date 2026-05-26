import { toMoneyString } from '@/lib/finance/income-row-utils'
import type { billingPeriodCostPricingSnapshot } from '@workspace/db/schema'
import {
  loadPricingResolveContext,
  resolveUnitCostForDcCard,
  type PricingResolveContext,
  type ResolvedUnitCost,
} from './tenant-bill-pricing'

export function pricingRefKey(
  dataCenterId: string,
  gpuCardTypeId: string,
  asOfDate: string,
): string {
  return `${dataCenterId}::${gpuCardTypeId}::${asOfDate}`
}

export async function loadResolvedPricingMap(input: {
  pairs: { dataCenterId: string; gpuCardTypeId: string; asOfDate: string }[]
  ctx?: PricingResolveContext
}): Promise<{ map: Map<string, ResolvedUnitCost>; ctx: PricingResolveContext }> {
  const ctx = input.ctx ?? (await loadPricingResolveContext())
  const map = new Map<string, ResolvedUnitCost>()

  for (const pair of input.pairs) {
    const key = pricingRefKey(pair.dataCenterId, pair.gpuCardTypeId, pair.asOfDate)
    if (map.has(key)) continue
    const resolved = await resolveUnitCostForDcCard({
      dataCenterId: pair.dataCenterId,
      gpuCardTypeId: pair.gpuCardTypeId,
      asOfDate: pair.asOfDate,
      ctx,
    })
    if (resolved) map.set(key, resolved)
  }

  return { map, ctx }
}

export function hasResolvedPricingRef(
  resolved: Pick<ResolvedUnitCost, 'supplierUnitCostId' | 'pricingRecordId'> | null | undefined,
): boolean {
  if (!resolved) return false
  return Boolean(resolved.supplierUnitCostId || resolved.pricingRecordId)
}

export function sourceLineHasPricingConfig(line: {
  supplierUnitCostId?: string | null
  supplierPricingRecordId?: string | null
}): boolean {
  return Boolean(line.supplierUnitCostId || line.supplierPricingRecordId)
}

function moneyField(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null
  return toMoneyString(value)
}

export function resolvedUnitCostToPricingSnapshotFields(
  resolved: ResolvedUnitCost,
): Pick<
  typeof billingPeriodCostPricingSnapshot.$inferInsert,
  | 'supplierUnitCostId'
  | 'supplierPricingRecordId'
  | 'pricingMode'
  | 'billingUnit'
  | 'monthlyRentPerMachine'
  | 'cardsPerMachine'
  | 'listPricePerHour'
  | 'dealUnitPricePerHour'
  | 'revenueSharePercent'
  | 'pricingTiers'
> {
  const billingUnit = resolved.billingUnit ?? 'hour'
  return {
    supplierUnitCostId: resolved.supplierUnitCostId,
    supplierPricingRecordId: resolved.pricingRecordId,
    pricingMode: resolved.pricingMode,
    billingUnit: billingUnit === 'month' ? 'month' : 'hour',
    monthlyRentPerMachine:
      billingUnit === 'month' ? moneyField(resolved.unitPrice) : null,
    cardsPerMachine:
      billingUnit === 'month'
        ? (resolved.cardsPerMachine ?? null)
        : null,
    listPricePerHour: moneyField(resolved.listPricePerHour),
    dealUnitPricePerHour: moneyField(resolved.unitPricePerHour),
    revenueSharePercent:
      resolved.revenueSharePercent != null
        ? resolved.revenueSharePercent.toFixed(4)
        : null,
    pricingTiers: resolved.pricingTiers.length > 0 ? resolved.pricingTiers : null,
  }
}

export function pricingRefsFromResolved(resolved: ResolvedUnitCost | null | undefined): {
  supplierUnitCostId: string | null
  supplierPricingRecordId: string | null
} {
  return {
    supplierUnitCostId: resolved?.supplierUnitCostId ?? null,
    supplierPricingRecordId: resolved?.pricingRecordId ?? null,
  }
}
