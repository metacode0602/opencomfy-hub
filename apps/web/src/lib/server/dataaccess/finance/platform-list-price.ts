import type { PlatformBillingUnit, PlatformProductLine } from '@/lib/types/platform-pricing'
import { db } from '@/lib/db'
import { normalizePlatformDateTime } from '@/lib/platform-pricing/datetime'
import { gpuCardType, platformCardListPrice } from '@workspace/db/schema'
import { and, eq, sql } from 'drizzle-orm'

export const DEFAULT_TENANT_BILL_PRODUCT_LINE: PlatformProductLine = 'elastic_service'
export const DEFAULT_TENANT_BILL_BILLING_UNIT: PlatformBillingUnit = 'hour'
export const DEFAULT_BAREMETAL_PRODUCT_LINE: PlatformProductLine = 'bare_metal'
export const DEFAULT_BAREMETAL_BILLING_UNIT: PlatformBillingUnit = 'hour'

export type ResolvedPlatformListPrice = {
  listPricePerHour: number
  platformCardListPriceId: string
  gpuCardTypeId: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
}

export type PlatformListPriceWindow = {
  windowStart: string
  windowEnd: string
  sortOrder: number
}

export type PlatformListPriceChangeInfo = {
  hasChanges: boolean
  windows: PlatformListPriceWindow[]
  changedCardTypes: Array<{
    id: string
    code: string
    changeDates: string[]
  }>
}

function dateOnly(value: string): string {
  const normalized = normalizePlatformDateTime(value)
  return normalized.slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isPlatformListPriceEffectiveAt(
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
  asOfDate: string,
): boolean {
  const endOfDay = `${asOfDate} 23:59:59`
  const startOfDay = `${asOfDate} 00:00:00`
  const from = normalizePlatformDateTime(effectiveFrom)
  if (from > endOfDay) return false
  if (effectiveTo != null && effectiveTo !== '') {
    const to = normalizePlatformDateTime(effectiveTo)
    if (to < startOfDay) return false
  }
  return true
}

export function buildPlatformListPriceWindows(input: {
  periodStart: string
  periodEnd: string
  cutDates: string[]
}): PlatformListPriceWindow[] {
  const { periodStart, periodEnd } = input
  const cuts = [...new Set(input.cutDates.map(dateOnly))]
    .filter((d) => d > periodStart && d <= periodEnd)
    .sort()

  if (cuts.length === 0) {
    return [{ windowStart: periodStart, windowEnd: periodEnd, sortOrder: 0 }]
  }

  const windows: PlatformListPriceWindow[] = []
  let cursor = periodStart
  for (const cut of cuts) {
    const prevEnd = addDays(cut, -1)
    if (cursor <= prevEnd) {
      windows.push({
        windowStart: cursor,
        windowEnd: prevEnd,
        sortOrder: windows.length,
      })
    }
    cursor = cut
  }
  if (cursor <= periodEnd) {
    windows.push({
      windowStart: cursor,
      windowEnd: periodEnd,
      sortOrder: windows.length,
    })
  }
  return windows
}

async function loadActivePlatformPrices(): Promise<
  Array<{
    id: string
    gpuCardTypeId: string
    code: string
    productLine: string
    billingUnit: string
    sellPrice: string
    effectiveFrom: string
    effectiveTo: string | null
  }>
> {
  const rows = await db
    .select({
      id: platformCardListPrice.id,
      gpuCardTypeId: platformCardListPrice.gpuCardTypeId,
      code: gpuCardType.code,
      productLine: platformCardListPrice.productLine,
      billingUnit: platformCardListPrice.billingUnit,
      sellPrice: platformCardListPrice.sellPrice,
      effectiveFrom: platformCardListPrice.effectiveFrom,
      effectiveTo: platformCardListPrice.effectiveTo,
    })
    .from(platformCardListPrice)
    .innerJoin(gpuCardType, eq(platformCardListPrice.gpuCardTypeId, gpuCardType.id))
    .where(eq(platformCardListPrice.status, 'active'))

  return rows
}

export async function detectPlatformListPriceWindows(input: {
  periodStart: string
  periodEnd: string
  productLine?: PlatformProductLine
  billingUnit?: PlatformBillingUnit
}): Promise<PlatformListPriceChangeInfo> {
  const productLine = input.productLine ?? DEFAULT_TENANT_BILL_PRODUCT_LINE
  const billingUnit = input.billingUnit ?? DEFAULT_TENANT_BILL_BILLING_UNIT
  const rows = await loadActivePlatformPrices()
  const filtered = rows.filter(
    (r) => r.productLine === productLine && r.billingUnit === billingUnit,
  )

  const cutDates: string[] = []
  const changesByCard = new Map<string, { id: string; code: string; dates: Set<string> }>()

  for (const row of filtered) {
    const cut = dateOnly(row.effectiveFrom)
    if (cut > input.periodStart && cut <= input.periodEnd) {
      cutDates.push(cut)
      const existing = changesByCard.get(row.gpuCardTypeId)
      if (existing) {
        existing.dates.add(cut)
      } else {
        changesByCard.set(row.gpuCardTypeId, {
          id: row.gpuCardTypeId,
          code: row.code,
          dates: new Set([cut]),
        })
      }
    }
  }

  const windows = buildPlatformListPriceWindows({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    cutDates,
  })

  return {
    hasChanges: cutDates.length > 0,
    windows,
    changedCardTypes: [...changesByCard.values()].map((c) => ({
      id: c.id,
      code: c.code,
      changeDates: [...c.dates].sort(),
    })),
  }
}

export async function resolvePlatformListPriceAt(input: {
  gpuCardTypeId: string
  asOfDate: string
  productLine?: PlatformProductLine
  billingUnit?: PlatformBillingUnit
}): Promise<ResolvedPlatformListPrice | null> {
  const productLine = input.productLine ?? DEFAULT_TENANT_BILL_PRODUCT_LINE
  const billingUnit = input.billingUnit ?? DEFAULT_TENANT_BILL_BILLING_UNIT

  const rows = await db
    .select({
      id: platformCardListPrice.id,
      gpuCardTypeId: platformCardListPrice.gpuCardTypeId,
      sellPrice: platformCardListPrice.sellPrice,
      effectiveFrom: platformCardListPrice.effectiveFrom,
      effectiveTo: platformCardListPrice.effectiveTo,
    })
    .from(platformCardListPrice)
    .where(
      and(
        eq(platformCardListPrice.gpuCardTypeId, input.gpuCardTypeId),
        eq(platformCardListPrice.productLine, productLine),
        eq(platformCardListPrice.billingUnit, billingUnit),
        eq(platformCardListPrice.status, 'active'),
      ),
    )
    .orderBy(sql`${platformCardListPrice.effectiveFrom} DESC`)

  const hit = rows.find((r) =>
    isPlatformListPriceEffectiveAt(r.effectiveFrom, r.effectiveTo, input.asOfDate),
  )
  if (!hit) return null

  const price = Number(hit.sellPrice)
  if (Number.isNaN(price) || price <= 0) return null

  return {
    listPricePerHour: price,
    platformCardListPriceId: hit.id,
    gpuCardTypeId: hit.gpuCardTypeId,
    productLine,
    billingUnit,
  }
}

export async function resolvePlatformListPriceByGpuCode(input: {
  gpuCode: string
  asOfDate: string
  productLine?: PlatformProductLine
  billingUnit?: PlatformBillingUnit
}): Promise<(ResolvedPlatformListPrice & { gpuCardTypeCode: string }) | null> {
  const normalized = input.gpuCode.trim().toLowerCase()
  if (!normalized) return null

  const cards = await db
    .select({ id: gpuCardType.id, code: gpuCardType.code })
    .from(gpuCardType)

  const card = cards.find((c) => c.code.trim().toLowerCase() === normalized)
  if (!card) return null

  const resolved = await resolvePlatformListPriceAt({
    gpuCardTypeId: card.id,
    asOfDate: input.asOfDate,
    productLine: input.productLine,
    billingUnit: input.billingUnit,
  })
  if (!resolved) return null

  return { ...resolved, gpuCardTypeCode: card.code }
}

export function asOfFromOrderedAt(orderedAt: Date): string {
  const y = orderedAt.getFullYear()
  const m = String(orderedAt.getMonth() + 1).padStart(2, '0')
  const d = String(orderedAt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
