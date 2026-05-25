import { db } from '@/lib/db'
import type { ContractPricingMode, ContractPricingTier } from '@/lib/data/types'
import { parsePricingTiers } from '@/lib/finance/cost-pricing-utils'
import { dataCenter, gpuCardType, supplierUnitCost } from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'
import { normalizeBaremetalRegion } from './baremetal-order-parse'
import {
  normalizeBillingRegion,
  normalizeGpuCodeForMatch,
} from './tenant-bill-pricing'

type GpuCardRef = { id: string; code: string; name: string }
type DataCenterRef = {
  id: string
  code: string
  name: string
  containerInstanceRegion: string | null
  bareMetalRegion: string | null
}

export type CostMasterDataContext = {
  gpuByCode: Map<string, GpuCardRef>
  dataCenters: DataCenterRef[]
  dataCentersByContainerRegion: Map<string, DataCenterRef[]>
  dataCentersByBareMetalRegion: Map<string, DataCenterRef[]>
}

export async function loadCostMasterDataContext(): Promise<CostMasterDataContext> {
  const [gpuRows, dcRows] = await Promise.all([
    db.select({ id: gpuCardType.id, code: gpuCardType.code, name: gpuCardType.name }).from(gpuCardType),
    db
      .select({
        id: dataCenter.id,
        code: dataCenter.code,
        name: dataCenter.name,
        containerInstanceRegion: dataCenter.containerInstanceRegion,
        bareMetalRegion: dataCenter.bareMetalRegion,
      })
      .from(dataCenter),
  ])

  const gpuByCode = new Map<string, GpuCardRef>()
  for (const row of gpuRows) {
    gpuByCode.set(normalizeGpuCodeForMatch(row.code), row)
  }

  const dataCentersByContainerRegion = new Map<string, DataCenterRef[]>()
  const dataCentersByBareMetalRegion = new Map<string, DataCenterRef[]>()
  for (const row of dcRows) {
    const containerRegion = row.containerInstanceRegion?.trim()
    if (containerRegion) {
      const key = normalizeBillingRegion(containerRegion)
      const list = dataCentersByContainerRegion.get(key) ?? []
      list.push(row)
      dataCentersByContainerRegion.set(key, list)
    }
    const bareMetalRegion = row.bareMetalRegion?.trim()
    if (bareMetalRegion) {
      const key = normalizeBaremetalRegion(bareMetalRegion)
      const list = dataCentersByBareMetalRegion.get(key) ?? []
      list.push(row)
      dataCentersByBareMetalRegion.set(key, list)
    }
  }

  return {
    gpuByCode,
    dataCenters: dcRows,
    dataCentersByContainerRegion,
    dataCentersByBareMetalRegion,
  }
}

export function resolveDataCenterByContainerRegion(
  ctx: CostMasterDataContext,
  regionCode: string,
): DataCenterRef | null {
  const list = ctx.dataCentersByContainerRegion.get(normalizeBillingRegion(regionCode)) ?? []
  return list[0] ?? null
}

export function resolveDataCenterByBareMetalRegion(
  ctx: CostMasterDataContext,
  idcName: string,
): DataCenterRef | null {
  const list = ctx.dataCentersByBareMetalRegion.get(normalizeBaremetalRegion(idcName)) ?? []
  return list[0] ?? null
}

export function resolveGpuCardType(
  ctx: CostMasterDataContext,
  gpuModel: string,
): GpuCardRef | null {
  return ctx.gpuByCode.get(normalizeGpuCodeForMatch(gpuModel)) ?? null
}

function isUnitCostEffectiveAt(
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
  asOfDate: string,
): boolean {
  if (effectiveFrom > asOfDate) return false
  if (effectiveTo != null && effectiveTo !== '' && effectiveTo < asOfDate) return false
  return true
}

export type ResolvedSupplierUnitCost = {
  id: string
  pricingMode: ContractPricingMode
  listPricePerHour: string | null
  dealUnitPricePerHour: string | null
  revenueSharePercent: string | null
  pricingTiers: ContractPricingTier[]
}

export async function resolveSupplierUnitCostForPair(input: {
  dataCenterId: string
  gpuCardTypeId: string
  asOfDate: string
}): Promise<ResolvedSupplierUnitCost | null> {
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
        eq(supplierUnitCost.dataCenterId, input.dataCenterId),
        eq(supplierUnitCost.gpuCardTypeId, input.gpuCardTypeId),
      ),
    )

  const hit = rows
    .filter((r) => isUnitCostEffectiveAt(r.effectiveFrom, r.effectiveTo, input.asOfDate))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]

  if (!hit) return null

  const tierJson = hit.tierJson as { tiers?: ContractPricingTier[]; pricing_mode?: string } | null
  return {
    id: hit.id,
    pricingMode: (tierJson?.pricing_mode as ContractPricingMode) ?? 'card_time',
    listPricePerHour: hit.listPricePerHour,
    dealUnitPricePerHour: hit.dealUnitPricePerHour,
    revenueSharePercent: hit.revenueSharePercent,
    pricingTiers: parsePricingTiers(tierJson?.tiers),
  }
}
