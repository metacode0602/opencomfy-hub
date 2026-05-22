import type { PlatformCardPriceRecord } from '@/lib/types/platform-pricing'
import {
  formatPlatformPeriodRange,
  parsePlatformDateTime,
  secondBeforePlatformDateTime,
} from '@/lib/platform-pricing/datetime'

/** 时间段生命周期（相对当前时刻） */
export type PlatformPricePeriodPhase = 'current' | 'scheduled' | 'expired' | 'draft'

export type PlatformPricePeriod = {
  periodId: string
  gpuCardTypeId: string
  effectiveFrom: string
  effectiveTo: string | null
  phase: PlatformPricePeriodPhase
  /** 展示用，如 2024-07-01 00:00:00 ~ 至今 */
  rangeLabel: string
  priceEntryCount: number
  isCurrent: boolean
}

export function parsePeriodDate(iso: string): number {
  return parsePlatformDateTime(iso)
}

export function formatPeriodDate(iso: string): string {
  return iso
}

export function formatPeriodRange(from: string, to: string | null): string {
  return formatPlatformPeriodRange(from, to)
}

export function dayBefore(iso: string): string {
  return secondBeforePlatformDateTime(iso)
}

/** 闭区间 [from, to]；to 为 null 表示正无穷 */
export function periodsOverlap(
  fromA: string,
  toA: string | null,
  fromB: string,
  toB: string | null,
): boolean {
  const aStart = parsePeriodDate(fromA)
  const aEnd = toA ? parsePeriodDate(toA) : Number.POSITIVE_INFINITY
  const bStart = parsePeriodDate(fromB)
  const bEnd = toB ? parsePeriodDate(toB) : Number.POSITIVE_INFINITY
  return aStart <= bEnd && bStart <= aEnd
}

export function getPeriodPhase(
  effectiveFrom: string,
  effectiveTo: string | null,
  hasDraftPrices: boolean,
  refDate = new Date(),
): PlatformPricePeriodPhase {
  if (hasDraftPrices) return 'draft'
  const now = refDate.getTime()
  const from = parsePeriodDate(effectiveFrom)
  const to = effectiveTo ? parsePeriodDate(effectiveTo) : Number.POSITIVE_INFINITY
  if (now < from) return 'scheduled'
  if (now > to) return 'expired'
  return 'current'
}

export const platformPricePeriodPhaseNames: Record<PlatformPricePeriodPhase, string> = {
  current: '当前有效',
  scheduled: '未生效',
  expired: '已过期',
  draft: '草稿',
}

export function groupPeriodsFromRecords(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
  refDate = new Date(),
): PlatformPricePeriod[] {
  const cardRecords = records.filter((r) => r.gpuCardTypeId === cardTypeId)

  const byPeriod = new Map<
    string,
    {
      periodId: string
      effectiveFrom: string
      effectiveTo: string | null
      records: PlatformCardPriceRecord[]
    }
  >()

  for (const r of cardRecords) {
    const key = r.periodId
    const existing = byPeriod.get(key)
    if (existing) {
      existing.records.push(r)
    } else {
      byPeriod.set(key, {
        periodId: r.periodId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo ?? null,
        records: [r],
      })
    }
  }

  const periods: PlatformPricePeriod[] = [...byPeriod.values()].map((g) => {
    const hasDraft = g.records.some((r) => r.status === 'draft')
    const phase = getPeriodPhase(g.effectiveFrom, g.effectiveTo, hasDraft, refDate)
    return {
      periodId: g.periodId,
      gpuCardTypeId: cardTypeId,
      effectiveFrom: g.effectiveFrom,
      effectiveTo: g.effectiveTo,
      phase,
      rangeLabel: formatPeriodRange(g.effectiveFrom, g.effectiveTo),
      priceEntryCount: g.records.length,
      isCurrent: false,
    }
  })

  const currentCandidates = periods.filter((p) => p.phase === 'current')
  if (currentCandidates.length === 1) {
    currentCandidates[0]!.isCurrent = true
  }

  return periods.sort(
    (a, b) => parsePeriodDate(b.effectiveFrom) - parsePeriodDate(a.effectiveFrom),
  )
}

export function findCurrentPeriod(
  periods: PlatformPricePeriod[],
): PlatformPricePeriod | undefined {
  return periods.find((p) => p.isCurrent)
}

export function findCurrentPeriodId(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
): string | undefined {
  return findCurrentPeriod(groupPeriodsFromRecords(records, cardTypeId))?.periodId
}

export function getRecordsForPeriod(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
  periodId: string,
): PlatformCardPriceRecord[] {
  return records.filter(
    (r) => r.gpuCardTypeId === cardTypeId && r.periodId === periodId,
  )
}

/** 当前生效时间段内的平台价（机房对比、继承用） */
export function getCurrentPlatformRecords(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
): PlatformCardPriceRecord[] {
  const currentId = findCurrentPeriodId(records, cardTypeId)
  if (!currentId) return []
  return getRecordsForPeriod(records, cardTypeId, currentId).filter(
    (r) => r.status === 'active',
  )
}

export type PeriodOverlapError = {
  code: 'overlap' | 'invalid_range' | 'multiple_current'
  message: string
}

export function validatePeriodRange(
  effectiveFrom: string,
  effectiveTo: string | null,
): PeriodOverlapError | null {
  if (!effectiveFrom) {
    return { code: 'invalid_range', message: '请填写生效开始时间' }
  }
  if (effectiveTo && parsePeriodDate(effectiveFrom) > parsePeriodDate(effectiveTo)) {
    return { code: 'invalid_range', message: '结束时间不能早于开始时间' }
  }
  return null
}

export function validatePeriodAgainstExisting(
  cardTypeId: string,
  effectiveFrom: string,
  effectiveTo: string | null,
  existingRecords: PlatformCardPriceRecord[],
  excludePeriodId?: string,
): PeriodOverlapError | null {
  const rangeErr = validatePeriodRange(effectiveFrom, effectiveTo)
  if (rangeErr) return rangeErr

  const periods = groupPeriodsFromRecords(existingRecords, cardTypeId).filter(
    (p) => p.periodId !== excludePeriodId,
  )

  for (const p of periods) {
    if (periodsOverlap(effectiveFrom, effectiveTo, p.effectiveFrom, p.effectiveTo)) {
      return {
        code: 'overlap',
        message: `与已有时间段「${p.rangeLabel}」重叠，请调整起止时间`,
      }
    }
  }

  const refDate = new Date()
  const newPhase = getPeriodPhase(effectiveFrom, effectiveTo, false, refDate)
  const existingCurrent = periods.filter((p) => p.phase === 'current')
  if (newPhase === 'current' && existingCurrent.length > 0) {
    return {
      code: 'multiple_current',
      message: `已存在当前有效时间段「${existingCurrent[0]!.rangeLabel}」。请先为其设置结束时间，或让新时间段的开始时间晚于当前时刻且不与现有区间重叠。`,
    }
  }

  return null
}

/** 新建「当前」时间段时，自动闭合原当前时间段的结束时间 */
export function closePreviousCurrentPeriod(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
  newEffectiveFrom: string,
): PlatformCardPriceRecord[] {
  const currentId = findCurrentPeriodId(records, cardTypeId)
  if (!currentId) return records

  const closeTo = dayBefore(newEffectiveFrom)
  return records.map((r) => {
    if (r.gpuCardTypeId !== cardTypeId || r.periodId !== currentId) return r
    if (r.effectiveTo != null) return r
    return { ...r, effectiveTo: closeTo }
  })
}
