import type { PlatformPricingDatacenterContext } from '@/lib/data/types'
import type {
  PlatformCardPriceRecord,
  PlatformBillingUnit,
  PlatformProductLine,
  SupplierDatacenterSellPrice,
} from '@/lib/types/platform-pricing'
import {
  platformBillingUnitNames,
  platformPriceStatusNames,
  platformProductLineNames,
  platformSellPriceSourceNames,
  priceDeltaPercent,
} from '@/lib/types/platform-pricing'
import {
  findCurrentPeriod,
  findCurrentPeriodId,
  getCurrentPlatformRecords,
  getRecordsForPeriod,
  groupPeriodsFromRecords,
  platformPricePeriodPhaseNames,
} from '@/lib/platform-pricing/periods'
import type {
  PlatformCardPricePeriodRow,
  PlatformDatacenterPriceGroupRow,
  PlatformDatacenterProductLinePriceRow,
  PlatformPricingDetailPageData,
  PlatformProductLinePriceRow,
} from '@/lib/types/platform-pricing-views'

const PRODUCT_LINES: PlatformProductLine[] = [
  'elastic_service',
  'cloud_vm',
  'bare_metal',
  'job',
  'spot',
]

const BARE_METAL_UNITS: PlatformBillingUnit[] = ['hour', 'day', 'week', 'month']

const dcStatusNames: Record<string, string> = {
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
}

function billingUnitDisplay(
  productLine: PlatformProductLine,
  unit: PlatformBillingUnit,
): string {
  if (productLine === 'bare_metal') return platformBillingUnitNames[unit]
  return '小时'
}

function expandPlatformSlots(): Array<{
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
}> {
  const slots: Array<{ productLine: PlatformProductLine; billingUnit: PlatformBillingUnit }> = []
  for (const pl of PRODUCT_LINES) {
    if (pl === 'bare_metal') {
      for (const unit of BARE_METAL_UNITS) {
        slots.push({ productLine: pl, billingUnit: unit })
      }
    } else {
      slots.push({ productLine: pl, billingUnit: 'hour' })
    }
  }
  return slots
}

export const PLATFORM_PRICE_SLOTS = expandPlatformSlots()

export function platformPriceSlotKey(
  productLine: PlatformProductLine,
  billingUnit: PlatformBillingUnit,
): string {
  return `${productLine}:${billingUnit}`
}

function recordKey(
  productLine: PlatformProductLine,
  billingUnit: PlatformBillingUnit,
): string {
  return platformPriceSlotKey(productLine, billingUnit)
}

function buildPlatformRecordMap(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
  periodId?: string,
): Map<string, PlatformCardPriceRecord> {
  const map = new Map<string, PlatformCardPriceRecord>()
  for (const r of records) {
    if (r.gpuCardTypeId !== cardTypeId) continue
    if (periodId != null && r.periodId !== periodId) continue
    map.set(recordKey(r.productLine, r.billingUnit), r)
  }
  return map
}

export function toPeriodRows(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
): PlatformCardPricePeriodRow[] {
  return groupPeriodsFromRecords(records, cardTypeId).map((p) => ({
    periodId: p.periodId,
    effectiveFrom: p.effectiveFrom,
    effectiveTo: p.effectiveTo,
    rangeLabel: p.rangeLabel,
    phase: p.phase,
    phaseLabel: platformPricePeriodPhaseNames[p.phase],
    priceEntryCount: p.priceEntryCount,
    isCurrent: p.isCurrent,
  }))
}

function buildSellRecordMap(
  records: SupplierDatacenterSellPrice[],
  cardTypeId: string,
  dataCenterId: string,
): Map<string, SupplierDatacenterSellPrice> {
  const map = new Map<string, SupplierDatacenterSellPrice>()
  for (const r of records) {
    if (r.gpuCardTypeId !== cardTypeId || r.dataCenterId !== dataCenterId) continue
    map.set(recordKey(r.productLine, r.billingUnit), r)
  }
  return map
}

export function toPlatformProductLinePriceRows(
  cardTypeId: string,
  platformRecords: PlatformCardPriceRecord[],
  periodId: string,
): PlatformProductLinePriceRow[] {
  const map = buildPlatformRecordMap(platformRecords, cardTypeId, periodId)

  return PLATFORM_PRICE_SLOTS.map(({ productLine, billingUnit }) => {
    const rec = map.get(recordKey(productLine, billingUnit))
    return {
      recordId: rec?.id ?? null,
      productLine,
      productLineLabel: platformProductLineNames[productLine],
      billingUnit,
      billingUnitLabel: billingUnitDisplay(productLine, billingUnit),
      sellPrice: rec?.sellPrice ?? null,
      currency: rec?.currency ?? 'CNY',
      effectiveFrom: rec?.effectiveFrom ?? null,
      status: rec?.status ?? null,
      statusLabel: rec ? platformPriceStatusNames[rec.status] : '未配置',
      updatedAt: rec?.updatedAt ?? null,
      updatedBy: rec?.updatedBy ?? null,
      remark: rec?.remark,
    }
  })
}

export function toDatacenterProductLinePriceRows(
  cardTypeId: string,
  dataCenterId: string,
  sellRecords: SupplierDatacenterSellPrice[],
  platformRecords: PlatformCardPriceRecord[],
): PlatformDatacenterProductLinePriceRow[] {
  const sellMap = buildSellRecordMap(sellRecords, cardTypeId, dataCenterId)
  const currentRecords = getCurrentPlatformRecords(platformRecords, cardTypeId)
  const platformMap = buildPlatformRecordMap(currentRecords, cardTypeId)

  return PLATFORM_PRICE_SLOTS.map(({ productLine, billingUnit }) => {
    const sell = sellMap.get(recordKey(productLine, billingUnit))
    const platform = platformMap.get(recordKey(productLine, billingUnit))
    const sellPrice = sell?.sellPrice ?? null
    const platformSellPrice = platform?.sellPrice ?? sell?.platformSellPrice ?? null

    return {
      recordId: sell?.id ?? null,
      productLine,
      productLineLabel: platformProductLineNames[productLine],
      billingUnit,
      billingUnitLabel: billingUnitDisplay(productLine, billingUnit),
      sellPrice,
      platformSellPrice,
      deltaPercent:
        sellPrice != null && platformSellPrice != null
          ? priceDeltaPercent(sellPrice, platformSellPrice)
          : null,
      inheritPlatformPrice: sell?.inheritPlatformPrice ?? false,
      source: sell?.source ?? null,
      sourceLabel: sell ? platformSellPriceSourceNames[sell.source] : '—',
      updatedAt: sell?.updatedAt ?? null,
    }
  })
}

export function toDatacenterGroupRows(
  cardTypeId: string,
  sellRecords: SupplierDatacenterSellPrice[],
  platformRecords: PlatformCardPriceRecord[],
  datacenters: PlatformPricingDatacenterContext[],
): PlatformDatacenterPriceGroupRow[] {
  return datacenters
    .map((dc) => {
      const productLinePrices = toDatacenterProductLinePriceRows(
        cardTypeId,
        dc.dataCenterId,
        sellRecords,
        platformRecords,
      )
      return {
        dataCenterId: dc.dataCenterId,
        dataCenterName: dc.dataCenterName,
        supplierId: dc.supplierId,
        supplierName: dc.supplierName,
        location: dc.location,
        status: dc.status,
        statusLabel: dcStatusNames[dc.status] ?? dc.status,
        priceEntryCount: productLinePrices.filter((p) => p.recordId != null).length,
        productLinePrices,
      } satisfies PlatformDatacenterPriceGroupRow
    })
    .sort((a, b) => a.dataCenterName.localeCompare(b.dataCenterName, 'zh-CN'))
}

export function buildDetailPageDataForCard(
  card: { id: string; name: string; manufacturer: string; memoryGB: number },
  platformRecords: PlatformCardPriceRecord[],
  sellRecords: SupplierDatacenterSellPrice[],
  platformHistoryCount: number,
  datacenters: PlatformPricingDatacenterContext[] = [],
): PlatformPricingDetailPageData {
  const periods = toPeriodRows(platformRecords, card.id)
  const currentPeriodId = findCurrentPeriodId(platformRecords, card.id) ?? null

  return {
    cardTypeId: card.id,
    cardTypeName: card.name,
    manufacturer: card.manufacturer,
    memoryGB: card.memoryGB,
    periods,
    currentPeriodId,
    platformPrices: currentPeriodId
      ? toPlatformProductLinePriceRows(card.id, platformRecords, currentPeriodId)
      : [],
    datacenters: toDatacenterGroupRows(card.id, sellRecords, platformRecords, datacenters),
    platformHistoryCount,
  }
}

export function buildDetailPageDataForPeriod(
  cardTypeId: string,
  periodId: string,
  platformRecords: PlatformCardPriceRecord[],
  sellRecords: SupplierDatacenterSellPrice[],
  platformHistoryCount: number,
  datacenters: PlatformPricingDatacenterContext[] = [],
): Pick<
  PlatformPricingDetailPageData,
  'platformPrices' | 'datacenters' | 'periods' | 'currentPeriodId'
> {
  const periods = toPeriodRows(platformRecords, cardTypeId)
  return {
    periods,
    currentPeriodId: findCurrentPeriodId(platformRecords, cardTypeId) ?? null,
    platformPrices: toPlatformProductLinePriceRows(cardTypeId, platformRecords, periodId),
    datacenters: toDatacenterGroupRows(cardTypeId, sellRecords, platformRecords, datacenters),
  }
}

export { findCurrentPeriod, getRecordsForPeriod, groupPeriodsFromRecords }
