import {
  mockDataCenterDevices,
  mockDataCenters,
  mockGPUCardTypes,
  mockSuppliers,
} from '@/lib/data/mock-data'
import { getCurrentPlatformRecords } from '@/lib/platform-pricing/periods'
import type {
  PlatformCardPriceHistory,
  PlatformCardPriceRecord,
  PlatformBillingUnit,
  PlatformProductLine,
  SupplierDatacenterSellPrice,
  SupplierDatacenterSellPriceHistory,
} from '@/lib/types/platform-pricing'

/** 卡型 × 产品线基准价（元）— 用于生成 mock */
const PLATFORM_BASE_PRICES: Record<
  string,
  Partial<Record<PlatformProductLine, number | Record<PlatformBillingUnit, number>>>
> = {
  card1: {
    elastic_service: 18,
    cloud_vm: 15,
    bare_metal: { hour: 22, day: 420, week: 2700, month: 9800 },
    job: 12,
    spot: 7.5,
  },
  card2: {
    elastic_service: 14,
    cloud_vm: 12,
    bare_metal: { hour: 18, day: 340, week: 2200, month: 8000 },
    job: 9,
    spot: 5.5,
  },
  card3: {
    elastic_service: 8,
    cloud_vm: 7,
    bare_metal: { hour: 10, day: 180, week: 1150, month: 4200 },
    job: 5.5,
    spot: 3.2,
  },
  card4: {
    elastic_service: 6,
    cloud_vm: 5,
    bare_metal: { hour: 8, day: 150, week: 950, month: 3400 },
    job: 4,
    spot: 2.5,
  },
  card5: {
    elastic_service: 28,
    cloud_vm: 24,
    bare_metal: { hour: 35, day: 650, week: 4200, month: 15200 },
    job: 20,
    spot: 12,
  },
  card6: {
    elastic_service: 12,
    cloud_vm: 10,
    bare_metal: { hour: 15, day: 280, week: 1800, month: 6500 },
    job: 8,
    spot: 5,
  },
  card7: {
    elastic_service: 10,
    cloud_vm: 9,
    job: 7,
    spot: 4,
  },
  card8: {
    elastic_service: 16,
    cloud_vm: 14,
    job: 11,
    spot: 6.5,
  },
}

type PeriodConfig = {
  periodId: string
  effectiveFrom: string
  effectiveTo: string | null
  priceFactor?: number
}

function pushPricesForPeriod(
  records: PlatformCardPriceRecord[],
  card: (typeof mockGPUCardTypes)[number],
  base: (typeof PLATFORM_BASE_PRICES)[string],
  period: PeriodConfig,
  seq: { n: number },
) {
  const factor = period.priceFactor ?? 1

  for (const [pl, val] of Object.entries(base) as [
    PlatformProductLine,
    number | Record<PlatformBillingUnit, number>,
  ][]) {
    if (typeof val === 'number') {
      records.push({
        id: `pcp-${seq.n++}`,
        gpuCardTypeId: card.id,
        cardTypeName: card.name,
        periodId: period.periodId,
        productLine: pl,
        billingUnit: 'hour',
        sellPrice: Math.round(val * factor * 100) / 100,
        currency: 'CNY',
        effectiveFrom: period.effectiveFrom,
        effectiveTo: period.effectiveTo,
        status:
          card.id === 'card7' && pl === 'spot' && period.periodId.endsWith('current')
            ? 'draft'
            : 'active',
        updatedAt: '2024-04-15T08:00:00.000Z',
        updatedBy: '运营管理员',
      })
    } else {
      for (const [unit, price] of Object.entries(val) as [PlatformBillingUnit, number][]) {
        records.push({
          id: `pcp-${seq.n++}`,
          gpuCardTypeId: card.id,
          cardTypeName: card.name,
          periodId: period.periodId,
          productLine: pl,
          billingUnit: unit,
          sellPrice: Math.round(price * factor * 100) / 100,
          currency: 'CNY',
          effectiveFrom: period.effectiveFrom,
          effectiveTo: period.effectiveTo,
          status: 'active',
          updatedAt: '2024-04-15T08:00:00.000Z',
          updatedBy: '运营管理员',
        })
      }
    }
  }
}

function periodsForCard(cardId: string): PeriodConfig[] {
  if (cardId === 'card1') {
    return [
      {
        periodId: 'card1-p-current',
        effectiveFrom: '2024-07-01',
        effectiveTo: null,
      },
      {
        periodId: 'card1-p-hist',
        effectiveFrom: '2024-01-01',
        effectiveTo: '2024-06-30',
        priceFactor: 0.9,
      },
    ]
  }
  if (cardId === 'card5') {
    return [
      {
        periodId: 'card5-p-current',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      },
      {
        periodId: 'card5-p-future',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        priceFactor: 1.08,
      },
    ]
  }
  return [
    {
      periodId: `${cardId}-p-current`,
      effectiveFrom: '2024-01-01',
      effectiveTo: null,
    },
  ]
}

function expandPlatformPrices(): PlatformCardPriceRecord[] {
  const records: PlatformCardPriceRecord[] = []
  const seq = { n: 1 }

  for (const card of mockGPUCardTypes) {
    const base = PLATFORM_BASE_PRICES[card.id]
    if (!base) continue

    for (const period of periodsForCard(card.id)) {
      pushPricesForPeriod(records, card, base, period, seq)
    }
  }

  return records
}

export const mockPlatformCardPriceRecords: PlatformCardPriceRecord[] =
  expandPlatformPrices()

export function getPlatformPrice(
  cardTypeId: string,
  productLine: PlatformProductLine,
  billingUnit: PlatformBillingUnit = 'hour',
): PlatformCardPriceRecord | undefined {
  return getCurrentPlatformRecords(mockPlatformCardPriceRecords, cardTypeId).find(
    (r) =>
      r.productLine === productLine &&
      r.billingUnit === billingUnit &&
      r.status === 'active',
  )
}

function buildDatacenterSellPrices(): SupplierDatacenterSellPrice[] {
  const seen = new Set<string>()
  const records: SupplierDatacenterSellPrice[] = []
  let seq = 1

  for (const device of mockDataCenterDevices) {
    const key = `${device.dataCenterId}:${device.cardTypeId}`
    if (seen.has(key)) continue
    seen.add(key)

    const supplier = mockSuppliers.find((s) => s.id === device.supplierId)
    const dc = mockDataCenters.find((d) => d.id === device.dataCenterId)
    if (!supplier || !dc) continue

    const productLines: PlatformProductLine[] = [
      'elastic_service',
      'cloud_vm',
      'job',
      'spot',
    ]

    for (const pl of productLines) {
      const platform = getPlatformPrice(device.cardTypeId, pl, 'hour')
      if (!platform) continue

      const inherit = device.dataCenterId !== 'dc2'
      const discount = device.dataCenterId === 'dc2' ? 0.95 : inherit ? 1 : 0.92
      const sellPrice = Math.round(platform.sellPrice * discount * 100) / 100

      records.push({
        id: `sdsp-${seq++}`,
        supplierId: device.supplierId,
        supplierName: supplier.shortName,
        dataCenterId: device.dataCenterId,
        dataCenterName: device.dataCenterName,
        gpuCardTypeId: device.cardTypeId,
        cardTypeName: device.cardTypeName,
        productLine: pl,
        billingUnit: 'hour',
        sellPrice,
        platformSellPrice: platform.sellPrice,
        inheritPlatformPrice: inherit && device.dataCenterId !== 'dc2',
        currency: 'CNY',
        effectiveFrom: '2024-02-01',
        source: inherit ? 'platform_inherit' : 'manual',
        updatedAt: '2024-04-10T10:00:00.000Z',
        updatedBy: supplier.businessManager,
      })
    }

    const bmBase = PLATFORM_BASE_PRICES[device.cardTypeId]?.bare_metal
    if (bmBase && typeof bmBase === 'object') {
      for (const [unit, platformPrice] of Object.entries(bmBase) as [
        PlatformBillingUnit,
        number,
      ][]) {
        const discount = dc.code === 'BJ-HL-01' ? 0.93 : 1
        records.push({
          id: `sdsp-${seq++}`,
          supplierId: device.supplierId,
          supplierName: supplier.shortName,
          dataCenterId: device.dataCenterId,
          dataCenterName: device.dataCenterName,
          gpuCardTypeId: device.cardTypeId,
          cardTypeName: device.cardTypeName,
          productLine: 'bare_metal',
          billingUnit: unit,
          sellPrice: Math.round(platformPrice * discount * 100) / 100,
          platformSellPrice: platformPrice,
          inheritPlatformPrice: discount === 1,
          currency: 'CNY',
          effectiveFrom: '2024-02-01',
          source: discount === 1 ? 'platform_inherit' : 'manual',
          updatedAt: '2024-04-10T10:00:00.000Z',
          updatedBy: supplier.businessManager,
        })
      }
    }
  }

  return records
}

export const mockSupplierDatacenterSellPrices: SupplierDatacenterSellPrice[] =
  buildDatacenterSellPrices()

export const mockPlatformCardPriceHistory: PlatformCardPriceHistory[] = [
  {
    id: 'pcph-1',
    priceRecordId: 'pcp-1',
    gpuCardTypeId: 'card1',
    cardTypeName: 'NVIDIA A100 80GB',
    productLine: 'elastic_service',
    billingUnit: 'hour',
    previousSellPrice: 16,
    newSellPrice: 18,
    changedAt: '2024-03-01T09:00:00.000Z',
    changedBy: '运营管理员',
    reason: '市场调价，A100 需求上涨',
  },
  {
    id: 'pcph-2',
    priceRecordId: 'pcp-5',
    gpuCardTypeId: 'card1',
    cardTypeName: 'NVIDIA A100 80GB',
    productLine: 'bare_metal',
    billingUnit: 'day',
    previousSellPrice: 400,
    newSellPrice: 420,
    changedAt: '2024-02-15T14:30:00.000Z',
    changedBy: '运营管理员',
    reason: '裸金属日租包价格调整',
  },
  {
    id: 'pcph-3',
    priceRecordId: 'pcp-21',
    gpuCardTypeId: 'card5',
    cardTypeName: 'NVIDIA H100 80GB',
    productLine: 'elastic_service',
    billingUnit: 'hour',
    previousSellPrice: 26,
    newSellPrice: 28,
    changedAt: '2024-04-01T11:00:00.000Z',
    changedBy: '张华',
    reason: 'H100 上新定价',
  },
  {
    id: 'pcph-4',
    priceRecordId: 'pcp-33',
    gpuCardTypeId: 'card4',
    cardTypeName: 'NVIDIA A10',
    productLine: 'spot',
    billingUnit: 'hour',
    previousSellPrice: 2.8,
    newSellPrice: 2.5,
    changedAt: '2024-03-20T16:00:00.000Z',
    changedBy: '运营管理员',
    reason: 'Spot 促销降价',
  },
]

export const mockSupplierDatacenterSellPriceHistory: SupplierDatacenterSellPriceHistory[] =
  [
    {
      id: 'sdsph-1',
      sellPriceId: 'sdsp-2',
      supplierId: 'sup1',
      supplierName: '云智算力',
      dataCenterId: 'dc2',
      dataCenterName: '北京怀来数据中心',
      gpuCardTypeId: 'card1',
      cardTypeName: 'NVIDIA A100 80GB',
      productLine: 'elastic_service',
      billingUnit: 'hour',
      previousSellPrice: 18,
      newSellPrice: 17.1,
      changedAt: '2024-03-05T10:00:00.000Z',
      changedBy: '李明',
      reason: '怀来机房促销，95 折',
    },
    {
      id: 'sdsph-2',
      sellPriceId: 'sdsp-8',
      supplierId: 'sup2',
      supplierName: '数算云',
      dataCenterId: 'dc4',
      dataCenterName: '上海嘉定数据中心',
      gpuCardTypeId: 'card5',
      cardTypeName: 'NVIDIA H100 80GB',
      productLine: 'cloud_vm',
      billingUnit: 'hour',
      previousSellPrice: 24,
      newSellPrice: 22.8,
      changedAt: '2024-04-08T09:30:00.000Z',
      changedBy: '张华',
      reason: '华东云主机 competitive pricing',
    },
  ]

export function getPlatformPricesByCardType(
  cardTypeId: string,
): PlatformCardPriceRecord[] {
  return mockPlatformCardPriceRecords.filter((r) => r.gpuCardTypeId === cardTypeId)
}

export function getDatacenterSellPricesByCardType(
  cardTypeId: string,
): SupplierDatacenterSellPrice[] {
  return mockSupplierDatacenterSellPrices.filter(
    (r) => r.gpuCardTypeId === cardTypeId,
  )
}
