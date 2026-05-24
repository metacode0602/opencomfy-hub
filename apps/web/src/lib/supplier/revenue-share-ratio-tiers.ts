import type { ContractPricingTier, SupplierPricingRecord } from '@/lib/data/types'

/** 阶梯分成编辑态：按成交/刊例比例划档（UI 以 % 展示） */
export type RevenueShareRatioTierDraft = {
  tierOrder: number
  /** 成交/刊例比例下限（%，不含） */
  ratioFromPercent: string
  /** 成交/刊例比例上限（%，含）；留空表示无上限 */
  ratioToPercent: string
  revenueSharePercent: string
}

export function percentToRatio(percent: number): number {
  return percent / 100
}

export function ratioToPercent(ratio: number): number {
  return ratio * 100
}

export function formatRatioAsPercent(ratio: number): string {
  const pct = ratioToPercent(ratio)
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(4).replace(/\.?0+$/, '')
}

export function emptyRevenueShareRatioTier(order: number): RevenueShareRatioTierDraft {
  return {
    tierOrder: order,
    ratioFromPercent: order === 1 ? '0' : '',
    ratioToPercent: '',
    revenueSharePercent: '',
  }
}

function tierRatioMinToDraftPercent(tier: ContractPricingTier): string {
  if (tier.dealToListRatioMin != null) {
    return formatRatioAsPercent(tier.dealToListRatioMin)
  }
  if (tier.thresholdFromHours != null) {
    return String(tier.thresholdFromHours)
  }
  return ''
}

function tierRatioMaxToDraftPercent(tier: ContractPricingTier): string {
  if (tier.dealToListRatioMax === null || tier.dealToListRatioMax === undefined) {
    if (tier.thresholdToHours === null || tier.thresholdToHours === undefined) {
      return ''
    }
    return String(tier.thresholdToHours)
  }
  return formatRatioAsPercent(tier.dealToListRatioMax)
}

export function revenueShareRatioTiersFromRecord(
  record: SupplierPricingRecord,
): RevenueShareRatioTierDraft[] {
  const tiers = record.pricingTiers?.filter(
    (t) => t.tierBasis === 'ratio_band' || t.dealToListRatioMin != null || t.revenueSharePercent != null,
  )
  if (tiers?.length) {
    return tiers.map((t) => ({
      tierOrder: t.tierOrder,
      ratioFromPercent: tierRatioMinToDraftPercent(t),
      ratioToPercent: tierRatioMaxToDraftPercent(t),
      revenueSharePercent:
        t.revenueSharePercent != null ? String(t.revenueSharePercent) : '',
    }))
  }
  return [emptyRevenueShareRatioTier(1), emptyRevenueShareRatioTier(2)]
}

export function revenueShareRatioTiersToContractTiers(
  tiers: RevenueShareRatioTierDraft[],
): ContractPricingTier[] {
  return tiers.map((t) => ({
    tierOrder: t.tierOrder,
    tierBasis: 'ratio_band' as const,
    dealToListRatioMin: percentToRatio(parseFloat(t.ratioFromPercent)),
    dealToListRatioMax: t.ratioToPercent.trim()
      ? percentToRatio(parseFloat(t.ratioToPercent))
      : null,
    revenueSharePercent: parseFloat(t.revenueSharePercent),
  }))
}

type ParsedTier = {
  tierOrder: number
  from: number
  to: number | null
  share: number
}

function parseDraftTiers(tiers: RevenueShareRatioTierDraft[]): ParsedTier[] | string {
  const parsed: ParsedTier[] = []
  for (const tier of tiers) {
    const from = parseFloat(tier.ratioFromPercent)
    const to = tier.ratioToPercent.trim() ? parseFloat(tier.ratioToPercent) : null
    const share = parseFloat(tier.revenueSharePercent)

    if (Number.isNaN(from)) {
      return `请填写第 ${tier.tierOrder} 档成交/刊例比例下限`
    }
    if (Number.isNaN(share)) {
      return `请填写第 ${tier.tierOrder} 档供应商分成比例`
    }
    if (tier.ratioToPercent.trim() && Number.isNaN(to!)) {
      return `第 ${tier.tierOrder} 档比例上限无效，请填写数字或留空`
    }
    if (to != null && from >= to) {
      return `第 ${tier.tierOrder} 档：比例下限须小于上限`
    }
    parsed.push({ tierOrder: tier.tierOrder, from, to, share })
  }
  return parsed
}

function parseContractTiers(tiers: ContractPricingTier[]): ParsedTier[] | string {
  const parsed: ParsedTier[] = []
  for (const tier of tiers) {
    const from =
      tier.dealToListRatioMin != null
        ? ratioToPercent(tier.dealToListRatioMin)
        : tier.thresholdFromHours
    const to =
      tier.dealToListRatioMax != null
        ? ratioToPercent(tier.dealToListRatioMax)
        : tier.thresholdToHours ?? null
    const share = tier.revenueSharePercent

    if (from == null || Number.isNaN(from)) {
      return `第 ${tier.tierOrder} 档缺少成交/刊例比例下限`
    }
    if (share == null || Number.isNaN(share)) {
      return `第 ${tier.tierOrder} 档缺少供应商分成比例`
    }
    if (to != null && Number.isNaN(to)) {
      return `第 ${tier.tierOrder} 档比例上限无效`
    }
    if (to != null && from >= to) {
      return `第 ${tier.tierOrder} 档：比例下限须小于上限`
    }
    parsed.push({ tierOrder: tier.tierOrder, from, to, share })
  }
  return parsed
}

function validateParsedTiersNoOverlap(parsed: ParsedTier[]): string | null {
  for (let i = 0; i < parsed.length - 1; i++) {
    const tier = parsed[i]
    if (!tier) continue
    if (tier.to == null) {
      return `仅最后一档可设置「无上限」，请为第 ${tier.tierOrder} 档填写比例上限`
    }
  }

  const sorted = [...parsed].sort((a, b) => a.from - b.from || a.tierOrder - b.tierOrder)
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]
    const next = sorted[i + 1]
    if (!curr || !next) continue
    if (curr.to != null && curr.to > next.from) {
      return `成交/刊例比例区间存在重叠（第 ${curr.tierOrder} 档与第 ${next.tierOrder} 档），请调整边界`
    }
  }

  return null
}

/** 校验阶梯区间不重叠（左开右闭区间 (from, to]） */
export function validateRevenueShareRatioTiers(tiers: RevenueShareRatioTierDraft[]): string | null {
  if (tiers.length < 1) {
    return '请至少配置一档阶梯'
  }

  const parsed = parseDraftTiers(tiers)
  if (typeof parsed === 'string') return parsed

  return validateParsedTiersNoOverlap(parsed)
}

export function validateRevenueShareRatioContractTiers(
  tiers: ContractPricingTier[],
): string | null {
  if (tiers.length < 1) {
    return '请至少配置一档阶梯'
  }

  const parsed = parseContractTiers(tiers)
  if (typeof parsed === 'string') return parsed

  return validateParsedTiersNoOverlap(parsed)
}

export function normalizeRatioBandTiersForCompare(
  tiers: ContractPricingTier[] | null | undefined,
): string {
  if (!tiers?.length) return '[]'
  const normalized = [...tiers]
    .sort((a, b) => a.tierOrder - b.tierOrder)
    .map((t) => ({
      tierOrder: t.tierOrder,
      dealToListRatioMin: t.dealToListRatioMin ?? null,
      dealToListRatioMax: t.dealToListRatioMax ?? null,
      revenueSharePercent: t.revenueSharePercent ?? null,
    }))
  return JSON.stringify(normalized)
}

export function formatRatioRangeLabel(from: number, to: number | null) {
  const fromLabel = `${from}%`
  if (to == null) return `(${fromLabel}, +∞)`
  return `(${fromLabel}, ${to}%]`
}

export function summarizeRatioBandTiers(tiers: ContractPricingTier[] | undefined): string {
  if (!tiers?.length) return '—'
  return tiers
    .slice()
    .sort((a, b) => a.tierOrder - b.tierOrder)
    .map((t) => {
      const from =
        t.dealToListRatioMin != null
          ? ratioToPercent(t.dealToListRatioMin)
          : (t.thresholdFromHours ?? 0)
      const to =
        t.dealToListRatioMax != null
          ? ratioToPercent(t.dealToListRatioMax)
          : t.thresholdToHours ?? null
      const share = t.revenueSharePercent ?? '—'
      return `${formatRatioRangeLabel(from, to)} → ${share}%`
    })
    .join('；')
}
