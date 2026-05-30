import type { GPUCardType, PlatformPricingDatacenterContext } from '@/lib/data/types'
import type {
  PlatformBillingUnit,
  PlatformCardPriceRecord,
  PlatformProductLine,
  SupplierDatacenterSellPrice,
} from '@/lib/types/platform-pricing'
import {
  platformBillingUnitNames,
  platformProductLineNames,
} from '@/lib/types/platform-pricing'

export const PRODUCT_LINES: PlatformProductLine[] = [
  'elastic_service',
  'cloud_vm',
  'bare_metal',
  'job',
  'spot',
]

export type DatacenterForCard = {
  dataCenterId: string
  dataCenterName: string
  supplierId: string
  supplierName: string
  location: string
  status: 'online' | 'offline' | 'maintenance'
  priceEntryCount: number
}

export type ProductLinePriceCell = {
  productLine: PlatformProductLine
  /** 主展示价（小时或裸金属小时价） */
  primaryPrice?: number
  primaryRecord?: PlatformCardPriceRecord | SupplierDatacenterSellPrice
  /** 裸金属全租期 */
  bareMetalPrices?: Array<{
    unit: PlatformBillingUnit
    price: number
    record: PlatformCardPriceRecord | SupplierDatacenterSellPrice
  }>
  status?: PlatformCardPriceRecord['status']
  platformReference?: number
}

export function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN')
}

export function formatDateTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getDatacentersForCardType(
  cardTypeId: string,
  sellRecords: SupplierDatacenterSellPrice[],
  datacenters: PlatformPricingDatacenterContext[],
): DatacenterForCard[] {
  const dcIds = new Set<string>()
  for (const dc of datacenters) {
    dcIds.add(dc.dataCenterId)
  }
  for (const r of sellRecords) {
    if (r.gpuCardTypeId === cardTypeId) dcIds.add(r.dataCenterId)
  }

  const dcById = new Map(datacenters.map((dc) => [dc.dataCenterId, dc]))

  return [...dcIds]
    .map((id) => {
      const dc = dcById.get(id)
      if (!dc) return null
      const priceEntryCount = sellRecords.filter(
        (r) => r.gpuCardTypeId === cardTypeId && r.dataCenterId === id,
      ).length
      return {
        dataCenterId: dc.dataCenterId,
        dataCenterName: dc.dataCenterName,
        supplierId: dc.supplierId,
        supplierName: dc.supplierName,
        location: dc.location,
        status: dc.status,
        priceEntryCount,
      } satisfies DatacenterForCard
    })
    .filter((x): x is DatacenterForCard => x != null)
    .sort((a, b) => a.dataCenterName.localeCompare(b.dataCenterName, 'zh-CN'))
}

function buildPriceMap(
  records: Array<PlatformCardPriceRecord | SupplierDatacenterSellPrice>,
): Map<string, Array<PlatformCardPriceRecord | SupplierDatacenterSellPrice>> {
  const map = new Map<string, Array<PlatformCardPriceRecord | SupplierDatacenterSellPrice>>()
  for (const r of records) {
    const key =
      r.productLine === 'bare_metal'
        ? `${r.productLine}:${r.billingUnit}`
        : r.productLine
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }
  return map
}

export function buildProductLineCells(
  records: Array<PlatformCardPriceRecord | SupplierDatacenterSellPrice>,
  platformRecords?: PlatformCardPriceRecord[],
): ProductLinePriceCell[] {
  const map = buildPriceMap(records)
  const platformMap = platformRecords ? buildPriceMap(platformRecords) : null

  return PRODUCT_LINES.map((pl) => {
    if (pl === 'bare_metal') {
      const units: PlatformBillingUnit[] = ['hour', 'day', 'week', 'month']
      const bareMetalPrices = units
        .map((unit) => {
          const rec = map.get(`bare_metal:${unit}`)?.[0]
          if (!rec) return null
          return { unit, price: rec.sellPrice, record: rec }
        })
        .filter((x): x is NonNullable<typeof x> => x != null)

      const hourPlatform = platformMap?.get('bare_metal:hour')?.[0]?.sellPrice
      return {
        productLine: pl,
        primaryPrice: bareMetalPrices.find((b) => b.unit === 'hour')?.price,
        primaryRecord: bareMetalPrices.find((b) => b.unit === 'hour')?.record,
        bareMetalPrices,
        platformReference: hourPlatform,
      }
    }

    const rec = map.get(pl)?.[0]
    const platformRef = platformMap?.get(pl)?.[0]?.sellPrice
    return {
      productLine: pl,
      primaryPrice: rec?.sellPrice,
      primaryRecord: rec,
      status: 'status' in (rec ?? {}) ? (rec as PlatformCardPriceRecord).status : undefined,
      platformReference: platformRef,
    }
  })
}

export function cardTypeLabel(card: GPUCardType) {
  return `${card.name} · ${card.manufacturer} · ${card.memoryGB}GB`
}

export function productLineHeader(pl: PlatformProductLine) {
  return platformProductLineNames[pl]
}

export function bareMetalUnitShort(unit: PlatformBillingUnit) {
  return platformBillingUnitNames[unit]
}
