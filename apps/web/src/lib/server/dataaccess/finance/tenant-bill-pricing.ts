import type { ContractPricingMode, ContractPricingTier } from '@/lib/data/types'
import { isSharePricingMode } from '@/lib/data/types'
import { db } from '@/lib/db'
import {
  billingPeriodImportBatch,
  billingPeriodRawTenantBill,
  dataCenter,
  gpuCardType,
  supplierPricingRecord,
} from '@workspace/db/schema'
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { validateRevenueShareRatioContractTiers } from '@/lib/supplier/revenue-share-ratio-tiers'

export type MissingPricingPair = {
  regionCode: string
  gpuModel: string
}

type EffectivePricingCandidate = {
  id: string
  containerInstanceRegion: string | null
  gpuCardCode: string
  gpuCardName: string
  pricingMode: ContractPricingMode
  configStatus: string
  unitPricePerHour: string | null
  revenueSharePercent: string | null
  listPricePerHour: string | null
  pricingTiers: ContractPricingTier[] | null
  effectiveFrom: string
  effectiveTo: string | null
}

/** 账单区域编码：trim + lower（与 import 写入 Raw 的规则一致） */
export function normalizeBillingRegion(value: string): string {
  return value.trim().toLowerCase()
}

/** GPU 型号归一化：忽略大小写与空格，便于与主数据 code/name 比对 */
export function normalizeGpuModelForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function compactGpuModel(value: string): string {
  return normalizeGpuModelForMatch(value).replace(/-/g, '')
}

/**
 * 账单 GPU 与主数据卡型匹配得分。
 * 精确匹配优先；其次允许配置卡型为账单型号前缀（如配置 4090 匹配账单 4090-48G）。
 */
export function gpuModelMatchScore(
  billGpu: string,
  cardCode: string,
  cardName: string,
): number {
  const bill = normalizeGpuModelForMatch(billGpu)
  if (!bill) return 0

  const candidates = [
    normalizeGpuModelForMatch(cardCode),
    normalizeGpuModelForMatch(cardName),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (bill === candidate) return 100
  }

  for (const candidate of candidates) {
    if (bill.startsWith(candidate)) return 50
  }

  const billCompact = compactGpuModel(billGpu)
  if (!billCompact) return 0

  const compactCandidates = [compactGpuModel(cardCode), compactGpuModel(cardName)].filter(
    Boolean,
  )

  for (const candidate of compactCandidates) {
    if (billCompact === candidate) return 100
  }

  for (const candidate of compactCandidates) {
    if (billCompact.startsWith(candidate)) return 50
  }

  return 0
}

export function isPricingEffectiveAtPeriodEnd(
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
  periodEnd: string,
): boolean {
  const endOfDay = `${periodEnd} 23:59:59`
  const startOfDay = `${periodEnd} 00:00:00`
  if (effectiveFrom > endOfDay) return false
  if (effectiveTo != null && effectiveTo !== '' && effectiveTo < startOfDay) return false
  return true
}

function parsePositiveMoney(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const n = Number(value)
  if (Number.isNaN(n) || n <= 0) return null
  return n
}

function parsePositivePercent(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const n = Number(value)
  if (Number.isNaN(n) || n <= 0) return null
  return n
}

function parsePricingTiers(value: unknown): ContractPricingTier[] {
  if (!Array.isArray(value)) return []
  return value as ContractPricingTier[]
}

/** 配置在账期结束日是否具备可计算所需的字段（对齐 unit-costs 校验与设计 §6.1.1） */
export function isPricingRecordComplete(record: {
  configStatus: string
  pricingMode: ContractPricingMode
  unitPricePerHour: string | null
  revenueSharePercent: string | null
  listPricePerHour: string | null
  pricingTiers: ContractPricingTier[] | null
}): boolean {
  if (record.configStatus !== 'active') return false

  const mode = record.pricingMode
  const tiers = record.pricingTiers ?? []

  if (mode === 'tiered_revenue_share') {
    if (parsePositiveMoney(record.listPricePerHour) == null) return false
    return validateRevenueShareRatioContractTiers(tiers) == null
  }

  if (mode === 'tiered_card_time') {
    if (parsePositiveMoney(record.listPricePerHour) == null) return false
    return tiers.length >= 1
  }

  if (isSharePricingMode(mode)) {
    return parsePositivePercent(record.revenueSharePercent) != null
  }

  return parsePositiveMoney(record.unitPricePerHour) != null
}

async function loadEffectivePricingCandidates(
  periodEnd: string,
): Promise<EffectivePricingCandidate[]> {
  const rows = await db
    .select({
      id: supplierPricingRecord.id,
      containerInstanceRegion: dataCenter.containerInstanceRegion,
      gpuCardCode: gpuCardType.code,
      gpuCardName: gpuCardType.name,
      pricingMode: supplierPricingRecord.pricingMode,
      configStatus: supplierPricingRecord.configStatus,
      unitPricePerHour: supplierPricingRecord.unitPricePerHour,
      revenueSharePercent: supplierPricingRecord.revenueSharePercent,
      listPricePerHour: supplierPricingRecord.listPricePerHour,
      pricingTiers: supplierPricingRecord.pricingTiers,
      effectiveFrom: supplierPricingRecord.effectiveFrom,
      effectiveTo: supplierPricingRecord.effectiveTo,
    })
    .from(supplierPricingRecord)
    .innerJoin(dataCenter, eq(supplierPricingRecord.dataCenterId, dataCenter.id))
    .innerJoin(gpuCardType, eq(supplierPricingRecord.gpuCardTypeId, gpuCardType.id))
    .where(
      and(
        eq(supplierPricingRecord.configStatus, 'active'),
        lte(supplierPricingRecord.effectiveFrom, `${periodEnd} 23:59:59`),
        or(
          isNull(supplierPricingRecord.effectiveTo),
          sql`${supplierPricingRecord.effectiveTo} >= ${`${periodEnd} 00:00:00`}`,
        ),
        sql`${dataCenter.containerInstanceRegion} IS NOT NULL`,
        sql`trim(${dataCenter.containerInstanceRegion}) <> ''`,
      ),
    )

  return rows
    .filter((row) =>
      isPricingEffectiveAtPeriodEnd(row.effectiveFrom, row.effectiveTo, periodEnd),
    )
    .map((row) => ({
      ...row,
      pricingMode: row.pricingMode as ContractPricingMode,
      pricingTiers: parsePricingTiers(row.pricingTiers),
    }))
}

function resolvePricingForPair(
  pair: MissingPricingPair,
  candidates: EffectivePricingCandidate[],
): EffectivePricingCandidate | null {
  const region = normalizeBillingRegion(pair.regionCode)
  const gpu = pair.gpuModel.trim()
  if (!region || !gpu) return null

  let best: { candidate: EffectivePricingCandidate; score: number } | null = null

  for (const candidate of candidates) {
    const dcRegion = candidate.containerInstanceRegion
    if (!dcRegion || normalizeBillingRegion(dcRegion) !== region) continue

    const score = gpuModelMatchScore(gpu, candidate.gpuCardCode, candidate.gpuCardName)
    if (score === 0) continue
    if (!isPricingRecordComplete(candidate)) continue

    if (!best || score > best.score) {
      best = { candidate, score }
    }
  }

  return best?.candidate ?? null
}

export async function findMissingTenantBillPricing(input: {
  periodId: string
  periodEnd: string
}): Promise<MissingPricingPair[]> {
  const tenantBillBatch = await db.query.billingPeriodImportBatch.findFirst({
    where: and(
      eq(billingPeriodImportBatch.billingPeriodId, input.periodId),
      eq(billingPeriodImportBatch.fileType, 'tenant_bill'),
      eq(billingPeriodImportBatch.parseStatus, 'ok'),
    ),
  })
  if (!tenantBillBatch) return []

  const rows = await db
    .select({
      regionCode: billingPeriodRawTenantBill.regionCode,
      gpuModel: billingPeriodRawTenantBill.gpuModel,
    })
    .from(billingPeriodRawTenantBill)
    .where(eq(billingPeriodRawTenantBill.batchId, tenantBillBatch.id))

  const pairs = new Map<string, MissingPricingPair>()
  for (const row of rows) {
    const key = `${row.regionCode}::${row.gpuModel}`
    if (!pairs.has(key)) {
      pairs.set(key, { regionCode: row.regionCode, gpuModel: row.gpuModel })
    }
  }

  if (pairs.size === 0) return []

  const candidates = await loadEffectivePricingCandidates(input.periodEnd)
  const missing: MissingPricingPair[] = []

  for (const pair of pairs.values()) {
    if (!normalizeBillingRegion(pair.regionCode) || !pair.gpuModel.trim()) {
      missing.push(pair)
      continue
    }
    if (!resolvePricingForPair(pair, candidates)) {
      missing.push(pair)
    }
  }

  return missing
}
