import type { ContractPricingMode, ContractPricingTier } from '@/lib/data/types'
import { db } from '@/lib/db'
import {
  isPricingFieldsComplete,
  parsePositiveMoney,
  parsePositivePercent,
  parsePricingTiers,
  type ResolvedPricingFields,
} from '@/lib/finance/cost-pricing-utils'
import {
  DEFAULT_CARDS_PER_MACHINE,
  normalizeSupplierBillingUnit,
  resolveCardTimeUnitPrice,
  type SupplierBillingUnit,
} from '@/lib/supplier/monthly-rent-pricing'
import {
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawTenantBill,
  dataCenter,
  gpuCardType,
  supplierPricingHistory,
  supplierPricingRecord,
  supplierUnitCost,
} from '@workspace/db/schema'
import { and, desc, eq, lte, or, sql } from 'drizzle-orm'
import {
  normalizeBaremetalRegion,
  parseDeviceModel,
  parsePurchaseQty,
} from './baremetal-order-parse'
import {
  asOfFromOrderedAt,
  DEFAULT_BAREMETAL_PRODUCT_LINE,
  resolvePlatformListPriceAt,
} from './platform-list-price'
import { listTenantBillWindows, type TenantBillWindowDto } from './tenant-bill-windows'
import type { PlatformBillingUnit } from '@/lib/types/platform-pricing'

export type PricingFailureReason =
  | 'card_type_not_found'
  | 'region_not_found'
  | 'pricing_pair_not_found'
  | 'platform_list_price_not_found'

export type MissingPricingPair = {
  regionCode: string
  gpuModel: string
}

export type MissingPricingIssue = MissingPricingPair & {
  failureReason: PricingFailureReason
  matchedGpuCardTypeCode?: string
  matchedGpuCardTypeId?: string
  matchedDataCenterId?: string
  billingUnit?: PlatformBillingUnit
  windowId?: string
  windowStart?: string
  windowEnd?: string
  orderId?: string
  orderedAt?: string
}

export type PricingSnapshotSource = 'record' | 'history' | 'supplier_unit_cost'

export type ResolvedUnitCost = ResolvedPricingFields & {
  pricingRecordId: string | null
  supplierUnitCostId: string | null
  source: PricingSnapshotSource
  pricingHistoryId?: string
  gpuCardTypeId: string
  dataCenterId: string
  platformCardListPriceId?: string | null
  listPriceSource?: 'platform'
}

type GpuCardRef = { id: string; code: string }
type DataCenterRef = { id: string; containerInstanceRegion: string }
type BareMetalDataCenterRef = { id: string; bareMetalRegion: string }

type PricingRecordRow = {
  id: string
  supplierId: string
  dataCenterId: string
  gpuCardTypeId: string
  supplierUnitCostId: string | null
  pricingMode: string
  configStatus: string
  billingUnit: string | null
  unitPrice: string | null
  cardsPerMachine: number | null
  unitPricePerHour: string | null
  revenueSharePercent: string | null
  listPricePerHour: string | null
  pricingTiers: unknown
  effectiveFrom: string
  effectiveTo: string | null
}

/** 账单区域编码：trim + lower（与 import 写入 Raw 的规则一致） */
export function normalizeBillingRegion(value: string): string {
  return value.trim().toLowerCase()
}

/** 卡型 code 精确匹配归一化 */
export function normalizeGpuCodeForMatch(value: string): string {
  return value.trim().toLowerCase()
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

function isUnitCostEffectiveAtPeriodEnd(
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
  periodEnd: string,
): boolean {
  if (effectiveFrom > periodEnd) return false
  if (effectiveTo != null && effectiveTo !== '' && effectiveTo < periodEnd) return false
  return true
}

function toResolvedFields(input: {
  configStatus: string
  pricingMode: ContractPricingMode
  billingUnit?: string | null
  unitPrice?: string | null
  cardsPerMachine?: number | null
  unitPricePerHour?: string | null
  revenueSharePercent?: string | null
  listPricePerHour?: string | null
  pricingTiers: ContractPricingTier[] | null
  effectiveFrom?: string
  referenceDate?: string
}): ResolvedPricingFields & { configStatus: string } {
  const billingUnit = normalizeSupplierBillingUnit(input.billingUnit)
  const cardsPerMachine = input.cardsPerMachine ?? DEFAULT_CARDS_PER_MACHINE
  const unitPrice = parsePositiveMoney(input.unitPrice)
  const referenceDate = input.referenceDate ?? input.effectiveFrom ?? ''
  const unitPricePerHour =
    input.pricingMode === 'card_time'
      ? resolveCardTimeUnitPrice(
          {
            billingUnit,
            unitPrice: input.unitPrice,
            unitPricePerHour: input.unitPricePerHour,
            cardsPerMachine,
            effectiveFrom: input.effectiveFrom ?? referenceDate,
          },
          referenceDate,
        )
      : parsePositiveMoney(input.unitPricePerHour)

  return {
    configStatus: input.configStatus,
    pricingMode: input.pricingMode,
    billingUnit,
    unitPrice,
    cardsPerMachine: billingUnit === 'month' ? cardsPerMachine : null,
    unitPricePerHour,
    revenueSharePercent: parsePositivePercent(input.revenueSharePercent),
    listPricePerHour: parsePositiveMoney(input.listPricePerHour),
    pricingTiers: input.pricingTiers ?? [],
  }
}

function recordKey(dataCenterId: string, gpuCardTypeId: string): string {
  return `${dataCenterId}::${gpuCardTypeId}`
}

function pairKey(regionCode: string, gpuModel: string): string {
  return `${regionCode}::${gpuModel}`
}

async function loadGpuCardByCode(): Promise<Map<string, GpuCardRef>> {
  const rows = await db.select({ id: gpuCardType.id, code: gpuCardType.code }).from(gpuCardType)
  const map = new Map<string, GpuCardRef>()
  for (const row of rows) {
    const key = normalizeGpuCodeForMatch(row.code)
    if (key) map.set(key, { id: row.id, code: row.code })
  }
  return map
}

async function loadDataCentersByRegion(): Promise<Map<string, DataCenterRef[]>> {
  const rows = await db
    .select({
      id: dataCenter.id,
      containerInstanceRegion: dataCenter.containerInstanceRegion,
    })
    .from(dataCenter)
  const map = new Map<string, DataCenterRef[]>()
  for (const row of rows) {
    const region = row.containerInstanceRegion?.trim()
    if (!region) continue
    const key = normalizeBillingRegion(region)
    const list = map.get(key) ?? []
    list.push({ id: row.id, containerInstanceRegion: region })
    map.set(key, list)
  }
  return map
}

async function loadDataCentersByBareMetalRegion(): Promise<Map<string, BareMetalDataCenterRef[]>> {
  const rows = await db
    .select({
      id: dataCenter.id,
      bareMetalRegion: dataCenter.bareMetalRegion,
    })
    .from(dataCenter)
  const map = new Map<string, BareMetalDataCenterRef[]>()
  for (const row of rows) {
    const region = row.bareMetalRegion?.trim()
    if (!region) continue
    const key = normalizeBaremetalRegion(region)
    const list = map.get(key) ?? []
    list.push({ id: row.id, bareMetalRegion: region })
    map.set(key, list)
  }
  return map
}

async function loadAllPricingRecords(): Promise<Map<string, PricingRecordRow[]>> {
  const rows = await db
    .select({
      id: supplierPricingRecord.id,
      supplierId: supplierPricingRecord.supplierId,
      dataCenterId: supplierPricingRecord.dataCenterId,
      gpuCardTypeId: supplierPricingRecord.gpuCardTypeId,
      supplierUnitCostId: supplierPricingRecord.supplierUnitCostId,
      pricingMode: supplierPricingRecord.pricingMode,
      configStatus: supplierPricingRecord.configStatus,
      billingUnit: supplierPricingRecord.billingUnit,
      unitPrice: supplierPricingRecord.unitPrice,
      cardsPerMachine: supplierPricingRecord.cardsPerMachine,
      unitPricePerHour: supplierPricingRecord.unitPricePerHour,
      revenueSharePercent: supplierPricingRecord.revenueSharePercent,
      listPricePerHour: supplierPricingRecord.listPricePerHour,
      pricingTiers: supplierPricingRecord.pricingTiers,
      effectiveFrom: supplierPricingRecord.effectiveFrom,
      effectiveTo: supplierPricingRecord.effectiveTo,
    })
    .from(supplierPricingRecord)

  const map = new Map<string, PricingRecordRow[]>()
  for (const row of rows) {
    const key = recordKey(row.dataCenterId, row.gpuCardTypeId)
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return map
}

async function loadHistorySnapshot(
  pricingRecordId: string,
  periodEnd: string,
): Promise<{
  id: string
  pricingMode: ContractPricingMode
  billingUnit: SupplierBillingUnit
  unitPrice: string | null
  cardsPerMachine: number | null
  unitPricePerHour: string | null
  revenueSharePercent: string | null
  listPricePerHour: string | null
  effectiveFrom: string
} | null> {
  const endOfDay = `${periodEnd} 23:59:59`
  const rows = await db
    .select({
      id: supplierPricingHistory.id,
      pricingMode: supplierPricingHistory.pricingMode,
      newBillingUnit: supplierPricingHistory.newBillingUnit,
      newUnitPrice: supplierPricingHistory.newUnitPrice,
      newCardsPerMachine: supplierPricingHistory.newCardsPerMachine,
      newUnitPricePerHour: supplierPricingHistory.newUnitPricePerHour,
      newRevenueSharePercent: supplierPricingHistory.newRevenueSharePercent,
      newListPricePerHour: supplierPricingHistory.newListPricePerHour,
      changedAt: supplierPricingHistory.changedAt,
    })
    .from(supplierPricingHistory)
    .where(
      and(
        eq(supplierPricingHistory.pricingRecordId, pricingRecordId),
        lte(supplierPricingHistory.changedAt, sql`${endOfDay}::timestamptz`),
      ),
    )
    .orderBy(desc(supplierPricingHistory.changedAt))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  const effectiveFrom = row.changedAt.toISOString().slice(0, 19).replace('T', ' ')
  return {
    id: row.id,
    pricingMode: row.pricingMode as ContractPricingMode,
    billingUnit: normalizeSupplierBillingUnit(row.newBillingUnit),
    unitPrice: row.newUnitPrice,
    cardsPerMachine: row.newCardsPerMachine,
    unitPricePerHour: row.newUnitPricePerHour,
    revenueSharePercent: row.newRevenueSharePercent,
    listPricePerHour: row.newListPricePerHour,
    effectiveFrom,
  }
}

async function loadUnitCostSnapshot(
  dataCenterId: string,
  gpuCardTypeId: string,
  periodEnd: string,
): Promise<{
  id: string
  pricingMode: ContractPricingMode
  unitPricePerHour: string | null
  revenueSharePercent: string | null
  listPricePerHour: string | null
  pricingTiers: ContractPricingTier[]
} | null> {
  const rows = await db
    .select({
      id: supplierUnitCost.id,
      listPricePerHour: supplierUnitCost.listPricePerHour,
      dealUnitPricePerHour: supplierUnitCost.dealUnitPricePerHour,
      revenueSharePercent: supplierUnitCost.revenueSharePercent,
      tierJson: supplierUnitCost.tierJson,
      effectiveFrom: supplierUnitCost.effectiveFrom,
      effectiveTo: supplierUnitCost.effectiveTo,
    })
    .from(supplierUnitCost)
    .where(
      and(
        eq(supplierUnitCost.dataCenterId, dataCenterId),
        eq(supplierUnitCost.gpuCardTypeId, gpuCardTypeId),
      ),
    )

  const hit = rows
    .filter((r) => isUnitCostEffectiveAtPeriodEnd(r.effectiveFrom, r.effectiveTo, periodEnd))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]

  if (!hit) return null

  const tierJson = hit.tierJson as { tiers?: ContractPricingTier[]; pricing_mode?: string } | null
  const tiers = parsePricingTiers(tierJson?.tiers)

  return {
    id: hit.id,
    pricingMode: (tierJson?.pricing_mode as ContractPricingMode) ?? 'card_time',
    unitPricePerHour: hit.dealUnitPricePerHour ?? hit.listPricePerHour,
    revenueSharePercent: hit.revenueSharePercent,
    listPricePerHour: hit.listPricePerHour,
    pricingTiers: tiers,
  }
}

function snapshotFromRecord(
  record: PricingRecordRow,
  periodEnd: string,
): (ResolvedPricingFields & { configStatus: string }) | null {
  if (!isPricingEffectiveAtPeriodEnd(record.effectiveFrom, record.effectiveTo, periodEnd)) {
    return null
  }
  const fields = toResolvedFields({
    configStatus: record.configStatus,
    pricingMode: record.pricingMode as ContractPricingMode,
    billingUnit: record.billingUnit,
    unitPrice: record.unitPrice,
    cardsPerMachine: record.cardsPerMachine,
    unitPricePerHour: record.unitPricePerHour,
    revenueSharePercent: record.revenueSharePercent,
    listPricePerHour: record.listPricePerHour,
    pricingTiers: parsePricingTiers(record.pricingTiers),
    effectiveFrom: record.effectiveFrom,
    referenceDate: periodEnd,
  })
  if (!isPricingFieldsComplete(fields, { requireListPrice: false })) return null
  return fields
}

async function attachPlatformListPrice(
  supplier: Omit<ResolvedUnitCost, 'listPricePerHour'> & { listPricePerHour?: number | null },
  gpuCardTypeId: string,
  asOfDate: string,
): Promise<ResolvedUnitCost | null> {
  const platform = await resolvePlatformListPriceAt({
    gpuCardTypeId,
    asOfDate,
  })
  if (!platform) return null

  return {
    ...supplier,
    listPricePerHour: platform.listPricePerHour,
    platformCardListPriceId: platform.platformCardListPriceId,
    listPriceSource: 'platform',
  }
}

async function resolvePricingSnapshotForDcCard(input: {
  record: PricingRecordRow
  dataCenterId: string
  gpuCardTypeId: string
  periodEnd: string
}): Promise<ResolvedUnitCost | null> {
  const { record, dataCenterId, gpuCardTypeId, periodEnd } = input

  const fromRecord = snapshotFromRecord(record, periodEnd)
  if (fromRecord) {
    const base = {
      ...fromRecord,
      pricingRecordId: record.id,
      supplierUnitCostId: record.supplierUnitCostId,
      source: 'record' as const,
      gpuCardTypeId,
      dataCenterId,
    }
    return attachPlatformListPrice(base, gpuCardTypeId, periodEnd)
  }

  const history = await loadHistorySnapshot(record.id, periodEnd)
  if (history) {
    const fields = toResolvedFields({
      configStatus: 'active',
      pricingMode: history.pricingMode,
      billingUnit: history.billingUnit,
      unitPrice: history.unitPrice,
      cardsPerMachine: history.cardsPerMachine,
      unitPricePerHour: history.unitPricePerHour,
      revenueSharePercent: history.revenueSharePercent,
      listPricePerHour: history.listPricePerHour,
      pricingTiers: parsePricingTiers(record.pricingTiers),
      effectiveFrom: history.effectiveFrom,
      referenceDate: periodEnd,
    })
    if (isPricingFieldsComplete(fields, { requireListPrice: false })) {
      const base = {
        ...fields,
        pricingRecordId: record.id,
        supplierUnitCostId: record.supplierUnitCostId,
        source: 'history' as const,
        pricingHistoryId: history.id,
        gpuCardTypeId,
        dataCenterId,
      }
      return attachPlatformListPrice(base, gpuCardTypeId, periodEnd)
    }
  }

  const unitCost = await loadUnitCostSnapshot(dataCenterId, gpuCardTypeId, periodEnd)
  if (unitCost) {
    const mode = (record.pricingMode as ContractPricingMode) || unitCost.pricingMode
    const fields = toResolvedFields({
      configStatus: 'active',
      pricingMode: mode,
      unitPricePerHour: unitCost.unitPricePerHour,
      revenueSharePercent: unitCost.revenueSharePercent,
      listPricePerHour: unitCost.listPricePerHour,
      pricingTiers: unitCost.pricingTiers,
    })
    if (isPricingFieldsComplete(fields, { requireListPrice: false })) {
      const base = {
        ...fields,
        pricingRecordId: record.id,
        supplierUnitCostId: unitCost.id,
        source: 'supplier_unit_cost' as const,
        gpuCardTypeId,
        dataCenterId,
      }
      return attachPlatformListPrice(base, gpuCardTypeId, periodEnd)
    }
  }

  return null
}

export type PricingResolveContext = {
  gpuByCode: Map<string, GpuCardRef>
  dataCentersByRegion: Map<string, DataCenterRef[]>
  dataCentersByBareMetalRegion: Map<string, BareMetalDataCenterRef[]>
  recordsByDcCard: Map<string, PricingRecordRow[]>
}

export async function loadPricingResolveContext(): Promise<PricingResolveContext> {
  const [gpuByCode, dataCentersByRegion, dataCentersByBareMetalRegion, recordsByDcCard] =
    await Promise.all([
      loadGpuCardByCode(),
      loadDataCentersByRegion(),
      loadDataCentersByBareMetalRegion(),
      loadAllPricingRecords(),
    ])
  return { gpuByCode, dataCentersByRegion, dataCentersByBareMetalRegion, recordsByDcCard }
}

/** 按机房×卡型 ID 解析成本定价（与导入前校验 tenant-bill-pricing 同源） */
export async function resolveUnitCostForDcCard(input: {
  dataCenterId: string
  gpuCardTypeId: string
  asOfDate: string
  ctx: PricingResolveContext
}): Promise<ResolvedUnitCost | null> {
  const records =
    input.ctx.recordsByDcCard.get(recordKey(input.dataCenterId, input.gpuCardTypeId)) ?? []
  for (const record of records) {
    const resolved = await resolvePricingSnapshotForDcCard({
      record,
      dataCenterId: input.dataCenterId,
      gpuCardTypeId: input.gpuCardTypeId,
      periodEnd: input.asOfDate,
    })
    if (resolved) return resolved
  }
  return null
}

export function diagnosePricingPair(
  pair: MissingPricingPair,
  ctx: PricingResolveContext,
): MissingPricingIssue {
  const regionNorm = normalizeBillingRegion(pair.regionCode)
  const gpuNorm = normalizeGpuCodeForMatch(pair.gpuModel)

  if (!regionNorm || !gpuNorm) {
    return {
      ...pair,
      failureReason: !gpuNorm ? 'card_type_not_found' : 'region_not_found',
    }
  }

  const gpu = ctx.gpuByCode.get(gpuNorm)
  if (!gpu) {
    return { ...pair, failureReason: 'card_type_not_found' }
  }

  const dcs = ctx.dataCentersByRegion.get(regionNorm) ?? []
  if (dcs.length === 0) {
    return { ...pair, failureReason: 'region_not_found' }
  }

  return {
    ...pair,
    failureReason: 'pricing_pair_not_found',
    matchedGpuCardTypeCode: gpu.code,
    matchedGpuCardTypeId: gpu.id,
    matchedDataCenterId: dcs[0]?.id,
  }
}

export async function resolveUnitCostForPair(
  pair: MissingPricingPair,
  asOfDate: string,
  ctx: PricingResolveContext,
): Promise<ResolvedUnitCost | null> {
  const issue = diagnosePricingPair(pair, ctx)
  if (issue.failureReason !== 'pricing_pair_not_found') return null

  const gpu = ctx.gpuByCode.get(normalizeGpuCodeForMatch(pair.gpuModel))
  const dcs = ctx.dataCentersByRegion.get(normalizeBillingRegion(pair.regionCode)) ?? []
  if (!gpu || dcs.length === 0) return null

  for (const dc of dcs) {
    const records = ctx.recordsByDcCard.get(recordKey(dc.id, gpu.id)) ?? []
    for (const record of records) {
      const resolved = await resolvePricingSnapshotForDcCard({
        record,
        dataCenterId: dc.id,
        gpuCardTypeId: gpu.id,
        periodEnd: asOfDate,
      })
      if (resolved) return resolved
    }
  }

  return null
}

async function resolveSupplierOnlyForPair(
  pair: MissingPricingPair,
  asOfDate: string,
  ctx: PricingResolveContext,
): Promise<boolean> {
  const gpu = ctx.gpuByCode.get(normalizeGpuCodeForMatch(pair.gpuModel))
  const dcs = ctx.dataCentersByRegion.get(normalizeBillingRegion(pair.regionCode)) ?? []
  if (!gpu || dcs.length === 0) return false

  for (const dc of dcs) {
    const records = ctx.recordsByDcCard.get(recordKey(dc.id, gpu.id)) ?? []
    for (const record of records) {
      const fromRecord = snapshotFromRecord(record, asOfDate)
      if (fromRecord) return true

      const history = await loadHistorySnapshot(record.id, asOfDate)
      if (history) {
        const fields = toResolvedFields({
          configStatus: 'active',
          pricingMode: history.pricingMode,
          billingUnit: history.billingUnit,
          unitPrice: history.unitPrice,
          cardsPerMachine: history.cardsPerMachine,
          unitPricePerHour: history.unitPricePerHour,
          revenueSharePercent: history.revenueSharePercent,
          listPricePerHour: history.listPricePerHour,
          pricingTiers: parsePricingTiers(record.pricingTiers),
          effectiveFrom: history.effectiveFrom,
          referenceDate: asOfDate,
        })
        if (isPricingFieldsComplete(fields, { requireListPrice: false })) return true
      }

      const unitCost = await loadUnitCostSnapshot(dc.id, gpu.id, asOfDate)
      if (unitCost) {
        const mode = (record.pricingMode as ContractPricingMode) || unitCost.pricingMode
        const fields = toResolvedFields({
          configStatus: 'active',
          pricingMode: mode,
          unitPricePerHour: unitCost.unitPricePerHour,
          revenueSharePercent: unitCost.revenueSharePercent,
          listPricePerHour: unitCost.listPricePerHour,
          pricingTiers: unitCost.pricingTiers,
        })
        if (isPricingFieldsComplete(fields, { requireListPrice: false })) return true
      }
    }
  }

  return false
}

export async function diagnoseMissingPricingForPair(
  pair: MissingPricingPair,
  asOfDate: string,
  ctx: PricingResolveContext,
): Promise<MissingPricingIssue> {
  const preliminary = diagnosePricingPair(pair, ctx)
  if (preliminary.failureReason !== 'pricing_pair_not_found') {
    return preliminary
  }

  const resolved = await resolveUnitCostForPair(pair, asOfDate, ctx)
  if (resolved) return preliminary

  const gpu = ctx.gpuByCode.get(normalizeGpuCodeForMatch(pair.gpuModel))
  if (gpu) {
    const supplierReady = await resolveSupplierOnlyForPair(pair, asOfDate, ctx)
    if (supplierReady) {
      const platform = await resolvePlatformListPriceAt({
        gpuCardTypeId: gpu.id,
        asOfDate,
      })
      if (!platform) {
        return {
          ...pair,
          failureReason: 'platform_list_price_not_found',
          matchedGpuCardTypeCode: gpu.code,
          matchedGpuCardTypeId: gpu.id,
          matchedDataCenterId: preliminary.matchedDataCenterId,
        }
      }
    }
  }

  return preliminary
}

async function loadTenantBillPairsForWindow(
  periodId: string,
  windowId: string,
): Promise<MissingPricingPair[]> {
  const tenantBillBatch = await db.query.billingPeriodImportBatch.findFirst({
    where: and(
      eq(billingPeriodImportBatch.billingPeriodId, periodId),
      eq(billingPeriodImportBatch.fileType, 'tenant_bill'),
      eq(billingPeriodImportBatch.windowId, windowId),
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
    const key = pairKey(row.regionCode, row.gpuModel)
    if (!pairs.has(key)) {
      pairs.set(key, { regionCode: row.regionCode, gpuModel: row.gpuModel })
    }
  }
  return [...pairs.values()]
}

export async function findMissingTenantBillPricing(input: {
  periodId: string
}): Promise<MissingPricingIssue[]> {
  const windows = await listTenantBillWindows(input.periodId)
  if (windows.length === 0) return []

  const ctx = await loadPricingResolveContext()
  const missing: MissingPricingIssue[] = []

  for (const window of windows) {
    const pairs = await loadTenantBillPairsForWindow(input.periodId, window.id)
    for (const pair of pairs) {
      const resolved = await resolveUnitCostForPair(pair, window.windowEnd, ctx)
      if (!resolved) {
        const issue = await diagnoseMissingPricingForPair(pair, window.windowEnd, ctx)
        missing.push({
          ...issue,
          windowId: window.id,
          windowStart: window.windowStart,
          windowEnd: window.windowEnd,
        })
      }
    }
  }

  return missing
}

export async function findMissingTenantBillPricingAtPeriodEnd(input: {
  periodId: string
  periodEnd: string
}): Promise<MissingPricingIssue[]> {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: and(
      eq(billingPeriodImportBatch.billingPeriodId, input.periodId),
      eq(billingPeriodImportBatch.fileType, 'tenant_bill'),
      eq(billingPeriodImportBatch.parseStatus, 'ok'),
    ),
  })
  if (batches.length === 0) return []

  const ctx = await loadPricingResolveContext()
  const missing: MissingPricingIssue[] = []
  const pairs = new Map<string, MissingPricingPair>()

  for (const batch of batches) {
    const rows = await db
      .select({
        regionCode: billingPeriodRawTenantBill.regionCode,
        gpuModel: billingPeriodRawTenantBill.gpuModel,
      })
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
    for (const row of rows) {
      const key = pairKey(row.regionCode, row.gpuModel)
      if (!pairs.has(key)) {
        pairs.set(key, { regionCode: row.regionCode, gpuModel: row.gpuModel })
      }
    }
  }

  for (const pair of pairs.values()) {
    const resolved = await resolveUnitCostForPair(pair, input.periodEnd, ctx)
    if (!resolved) {
      const issue = await diagnoseMissingPricingForPair(pair, input.periodEnd, ctx)
      missing.push({
        ...issue,
        windowEnd: input.periodEnd,
      })
    }
  }

  return missing
}

export async function findMissingBaremetalPlatformListPrice(input: {
  periodId: string
}): Promise<MissingPricingIssue[]> {
  const baremetalBatch = await db.query.billingPeriodImportBatch.findFirst({
    where: and(
      eq(billingPeriodImportBatch.billingPeriodId, input.periodId),
      eq(billingPeriodImportBatch.fileType, 'baremetal_order'),
      eq(billingPeriodImportBatch.parseStatus, 'ok'),
    ),
  })
  if (!baremetalBatch) return []

  const orders = await db
    .select({
      orderId: billingPeriodRawBaremetalOrder.orderId,
      idcName: billingPeriodRawBaremetalOrder.idcName,
      deviceModel: billingPeriodRawBaremetalOrder.deviceModel,
      purchaseQtyText: billingPeriodRawBaremetalOrder.purchaseQtyText,
      orderedAt: billingPeriodRawBaremetalOrder.orderedAt,
    })
    .from(billingPeriodRawBaremetalOrder)
    .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id))

  const ctx = await loadPricingResolveContext()
  const missing: MissingPricingIssue[] = []
  const seen = new Set<string>()

  for (const order of orders) {
    const parsedDevice = parseDeviceModel(order.deviceModel)
    const parsedPurchase = parsePurchaseQty(order.purchaseQtyText)
    const regionCode = normalizeBaremetalRegion(order.idcName)
    const asOfDate = asOfFromOrderedAt(order.orderedAt)

    if (!parsedDevice || !parsedPurchase || !regionCode) continue

    const { cardCode } = parsedDevice
    const { billingUnit } = parsedPurchase
    const dedupeKey = `${regionCode}::${cardCode}::${billingUnit}::${asOfDate}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const gpuNorm = normalizeGpuCodeForMatch(cardCode)
    const gpu = ctx.gpuByCode.get(gpuNorm)
    if (!gpu) {
      missing.push({
        regionCode,
        gpuModel: cardCode,
        failureReason: 'card_type_not_found',
        orderId: order.orderId,
        orderedAt: asOfDate,
        billingUnit,
      })
      continue
    }

    const dcs = ctx.dataCentersByBareMetalRegion.get(regionCode) ?? []
    if (dcs.length === 0) {
      missing.push({
        regionCode,
        gpuModel: cardCode,
        failureReason: 'region_not_found',
        matchedGpuCardTypeCode: gpu.code,
        matchedGpuCardTypeId: gpu.id,
        orderId: order.orderId,
        orderedAt: asOfDate,
        billingUnit,
      })
      continue
    }

    const platform = await resolvePlatformListPriceAt({
      gpuCardTypeId: gpu.id,
      asOfDate,
      productLine: DEFAULT_BAREMETAL_PRODUCT_LINE,
      billingUnit,
    })
    if (!platform) {
      missing.push({
        regionCode,
        gpuModel: cardCode,
        failureReason: 'platform_list_price_not_found',
        matchedGpuCardTypeCode: gpu.code,
        matchedGpuCardTypeId: gpu.id,
        matchedDataCenterId: dcs[0]?.id,
        orderId: order.orderId,
        orderedAt: asOfDate,
        billingUnit,
      })
    }
  }

  return missing
}

export function pricingMapKeyForWindow(
  windowId: string,
  regionCode: string,
  gpuModel: string,
): string {
  return `${windowId}::${pairKey(regionCode, gpuModel)}`
}

export async function buildTenantBillPricingMap(input: {
  periodId: string
}): Promise<Map<string, ResolvedUnitCost>> {
  const windows = await listTenantBillWindows(input.periodId)
  const ctx = await loadPricingResolveContext()
  const map = new Map<string, ResolvedUnitCost>()

  for (const window of windows) {
    const pairs = await loadTenantBillPairsForWindow(input.periodId, window.id)
    for (const pair of pairs) {
      const resolved = await resolveUnitCostForPair(pair, window.windowEnd, ctx)
      if (resolved) {
        map.set(
          pricingMapKeyForWindow(window.id, pair.regionCode, pair.gpuModel),
          resolved,
        )
      }
    }
  }

  return map
}

/** @deprecated 仅保留测试兼容；财务解析改用 normalizeGpuCodeForMatch 精确匹配 */
export function normalizeGpuModelForMatch(value: string): string {
  return normalizeGpuCodeForMatch(value)
}

/** @deprecated 财务成本解析不再使用模糊得分 */
export function gpuModelMatchScore(
  _billGpu: string,
  _cardCode: string,
  _cardName: string,
): number {
  return 0
}

export { isPricingFieldsComplete as isPricingRecordComplete }
