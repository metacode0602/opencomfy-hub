import { db } from '@/lib/db'
import { contractPricingModeNames, isSharePricingMode } from '@/lib/data/types'
import type { ContractPricingMode } from '@/lib/data/types'
import { parsePricingTiers } from '@/lib/finance/cost-pricing-utils'
import {
  billingPeriodCostPricingSnapshot,
  billingPeriodCostSourceLine,
  billingTenant,
  dataCenter,
} from '@workspace/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { findLatestPricingSnapshot } from './compute-cost-pricing-snapshot'

export type CostSourceLineDto = {
  id: string
  kind: string
  tenant_id: string | null
  tenant_platform_id: string
  tenant_name: string | null
  total_consumption: string
  voucher_consumption: string
  balance_consumption: string
  total_card_hours: string
  voucher_card_hours: string
  balance_card_hours: string
  gpu_card_type_name: string | null
  data_center_id: string
  gpu_card_type_id: string
  region: string | null
  data_center_name: string | null
  pricing_mode: string | null
  pricing_label: string | null
  list_price_per_hour: string | null
  deal_unit_price_per_hour: string | null
  revenue_share_percent: string | null
  pricing_tiers: unknown
  staff_name: string | null
}

function readRegion(
  sourceMeta: unknown,
  dc: { containerInstanceRegion: string | null; regionTags: string[]; location: string | null } | undefined,
): string | null {
  const meta = sourceMeta as { region_code?: string } | null
  if (meta?.region_code) return meta.region_code
  if (dc?.containerInstanceRegion) return dc.containerInstanceRegion
  if (dc?.regionTags.length) return dc.regionTags.join(', ')
  if (dc?.location) return dc.location
  return null
}

function formatPricingLabel(input: {
  pricingMode: string | null
  listPricePerHour: string | null
  dealUnitPricePerHour: string | null
  revenueSharePercent: string | null
}): string | null {
  const mode = input.pricingMode as ContractPricingMode | null
  if (!mode) return null

  if (isSharePricingMode(mode) && input.revenueSharePercent) {
    const pct = Number(input.revenueSharePercent)
    if (!Number.isNaN(pct)) {
      return `${contractPricingModeNames[mode]} ${pct}%`
    }
  }

  if (input.dealUnitPricePerHour) {
    return `${contractPricingModeNames[mode]} 成交 ${input.dealUnitPricePerHour}/卡时`
  }

  if (input.listPricePerHour) {
    return `${contractPricingModeNames[mode]} 刊例 ${input.listPricePerHour}/卡时`
  }

  return contractPricingModeNames[mode] ?? mode
}

export async function listCostSourceLines(
  billingPeriodId: string,
): Promise<CostSourceLineDto[]> {
  const lines = await db
    .select()
    .from(billingPeriodCostSourceLine)
    .where(eq(billingPeriodCostSourceLine.billingPeriodId, billingPeriodId))

  if (lines.length === 0) return []

  const tenantIds = [...new Set(lines.map((l) => l.tenantId).filter(Boolean))] as string[]
  const dcIds = [...new Set(lines.map((l) => l.dataCenterId))]

  const [tenants, dcRows, snapshots] = await Promise.all([
    tenantIds.length > 0
      ? db
          .select({ id: billingTenant.id, name: billingTenant.name })
          .from(billingTenant)
          .where(inArray(billingTenant.id, tenantIds))
      : Promise.resolve([]),
    dcIds.length > 0
      ? db
          .select({
            id: dataCenter.id,
            containerInstanceRegion: dataCenter.containerInstanceRegion,
            regionTags: dataCenter.regionTags,
            location: dataCenter.location,
          })
          .from(dataCenter)
          .where(inArray(dataCenter.id, dcIds))
      : Promise.resolve([]),
    db
      .select()
      .from(billingPeriodCostPricingSnapshot)
      .where(eq(billingPeriodCostPricingSnapshot.billingPeriodId, billingPeriodId)),
  ])

  const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]))
  const dcById = new Map(dcRows.map((d) => [d.id, d]))

  const snapshotMap = new Map<string, (typeof snapshots)[number]>()
  for (const snap of snapshots) {
    snapshotMap.set(`${snap.dataCenterId}::${snap.gpuCardTypeId}::${snap.windowId}`, snap)
  }

  return lines.map((line) => {
    const snap = line.windowId
      ? snapshotMap.get(`${line.dataCenterId}::${line.gpuCardTypeId}::${line.windowId}`)
      : findLatestPricingSnapshot({
          snapshots: snapshotMap,
          dataCenterId: line.dataCenterId,
          gpuCardTypeId: line.gpuCardTypeId,
          windowIds: line.windowId ? [line.windowId] : [],
        })

    const pricingFields = {
      pricingMode: snap?.pricingMode ?? null,
      listPricePerHour: snap?.listPricePerHour ?? null,
      dealUnitPricePerHour: snap?.dealUnitPricePerHour ?? null,
      revenueSharePercent: snap?.revenueSharePercent ?? null,
    }

    return {
      id: line.id,
      kind: line.kind,
      tenant_id: line.tenantId,
      tenant_platform_id: line.tenantPlatformId,
      tenant_name: line.tenantId ? (tenantNameById.get(line.tenantId) ?? null) : null,
      total_consumption: line.totalConsumption,
      voucher_consumption: line.voucherConsumption,
      balance_consumption: line.balanceConsumption,
      total_card_hours: line.totalCardHours,
      voucher_card_hours: line.voucherCardHours,
      balance_card_hours: line.balanceCardHours,
      gpu_card_type_name: line.gpuCardTypeName,
      data_center_id: line.dataCenterId,
      gpu_card_type_id: line.gpuCardTypeId,
      region: readRegion(line.sourceMeta, dcById.get(line.dataCenterId)),
      data_center_name: line.dataCenterName,
      pricing_mode: pricingFields.pricingMode,
      pricing_label: formatPricingLabel(pricingFields),
      list_price_per_hour: pricingFields.listPricePerHour,
      deal_unit_price_per_hour: pricingFields.dealUnitPricePerHour,
      revenue_share_percent: pricingFields.revenueSharePercent,
      pricing_tiers: snap?.pricingTiers ?? null,
      staff_name: line.staffName,
    }
  })
}
