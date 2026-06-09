import type { ContractPricingMode } from '@/lib/data/types'
import {
  computeGiftedDurationCostExclTaxForPricing,
  computeSoldDurationCostExclTax,
  parsePositiveMoney,
  parsePositivePercent,
  parsePricingTiers,
  resolveTierCostContext,
  type ResolvedPricingFields,
} from '@/lib/finance/cost-pricing-utils'
import { COST_TAX_DIVISOR, computeGrossProfit } from '@/lib/finance/cost-row-utils'
import { parseMoney } from '@/lib/finance/income-row-utils'
import type { CostSourceLineDto } from '@/lib/server/dataaccess/finance/list-cost-source-lines'

export type SourceLineFinancials = {
  balanceConsumption: number
  balanceCardHours: number
  voucherCardHours: number
  confirmedRevenueExclTax: number
  soldDurationCostExclTax: number
  giftedDurationCostExclTax: number
  grossProfit: number
}

export function sourceLineToPricingFields(
  line: CostSourceLineDto,
): ResolvedPricingFields | null {
  if (!line.pricing_mode) return null

  return {
    pricingMode: line.pricing_mode as ContractPricingMode,
    unitPricePerHour:
      parsePositiveMoney(line.deal_unit_price_per_hour) ??
      parsePositiveMoney(line.list_price_per_hour),
    revenueSharePercent: parsePositivePercent(line.revenue_share_percent),
    listPricePerHour: parsePositiveMoney(line.list_price_per_hour),
    pricingTiers: parsePricingTiers(line.pricing_tiers),
  }
}

export function computeSourceLineFinancials(
  line: CostSourceLineDto,
): SourceLineFinancials | null {
  const pricing = sourceLineToPricingFields(line)
  if (!pricing) return null

  const metrics = {
    balanceConsumption: parseMoney(line.balance_consumption),
    balanceCardHours: Number(line.balance_card_hours ?? 0),
    voucherCardHours: Number(line.voucher_card_hours ?? 0),
  }

  const tierCtx = resolveTierCostContext(pricing, metrics)
  const confirmedRevenueExclTax = metrics.balanceConsumption / COST_TAX_DIVISOR
  const soldDurationCostExclTax = computeSoldDurationCostExclTax(
    pricing,
    metrics,
    tierCtx,
  )
  const giftedDurationCostExclTax = computeGiftedDurationCostExclTaxForPricing(
    pricing,
    metrics,
    tierCtx,
  )
  const grossProfit = computeGrossProfit(
    confirmedRevenueExclTax,
    soldDurationCostExclTax,
    giftedDurationCostExclTax,
  )

  return {
    balanceConsumption: metrics.balanceConsumption,
    balanceCardHours: metrics.balanceCardHours,
    voucherCardHours: metrics.voucherCardHours,
    confirmedRevenueExclTax,
    soldDurationCostExclTax,
    giftedDurationCostExclTax,
    grossProfit,
  }
}
