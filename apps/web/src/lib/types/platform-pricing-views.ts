/** 平台定价 UI 视图模型（与 DB 行记录解耦，由服务端行列转换生成） */

import type {
  PlatformBillingUnit,
  PlatformPriceStatus,
  PlatformProductLine,
} from '@/lib/types/platform-pricing'
import type { PlatformPricePeriodPhase } from '@/lib/platform-pricing/periods'

/** 列表页：一行 = 一个卡型（聚合多产品线定价） */
export type PlatformCardTypeListRow = {
  cardTypeId: string
  cardTypeName: string
  manufacturer: string
  memoryGB: number
  /** 已配置平台价条目数（含裸金属多租期） */
  platformPriceCount: number
  /** 生效中平台价条目数 */
  activePlatformPriceCount: number
  /** 价格摘要，如 ¥8–28/时 */
  priceSummary: string
  /** 已配置产品线（中文，逗号分隔） */
  productLinesLabel: string
  /** 接入该卡型的机房数 */
  datacenterCount: number
}

/** 详情页：卡型定价时间段 */
export type PlatformCardPricePeriodRow = {
  periodId: string
  effectiveFrom: string
  effectiveTo: string | null
  rangeLabel: string
  phase: PlatformPricePeriodPhase
  phaseLabel: string
  priceEntryCount: number
  isCurrent: boolean
}

/** 详情页：平台标准价 — 一行 = 产品线 × 租期（选定时间段内） */
export type PlatformProductLinePriceRow = {
  recordId: string | null
  productLine: PlatformProductLine
  productLineLabel: string
  billingUnit: PlatformBillingUnit
  billingUnitLabel: string
  sellPrice: number | null
  currency: string
  effectiveFrom: string | null
  status: PlatformPriceStatus | null
  statusLabel: string
  updatedAt: string | null
  updatedBy: string | null
  remark?: string
}

/** 详情页：机房 — 一行 = 一个机房（含嵌套产品线价行） */
export type PlatformDatacenterPriceGroupRow = {
  dataCenterId: string
  dataCenterName: string
  supplierId: string
  supplierName: string
  location: string
  status: 'online' | 'offline' | 'maintenance'
  statusLabel: string
  priceEntryCount: number
  /** 机房内该卡型销售价，按产品线×租期展开 */
  productLinePrices: PlatformDatacenterProductLinePriceRow[]
}

/** 详情页：机房销售价 — 一行 = 一条定价记录 */
export type PlatformDatacenterProductLinePriceRow = {
  recordId: string | null
  productLine: PlatformProductLine
  productLineLabel: string
  billingUnit: PlatformBillingUnit
  billingUnitLabel: string
  sellPrice: number | null
  platformSellPrice: number | null
  deltaPercent: number | null
  inheritPlatformPrice: boolean
  source: 'contract' | 'manual' | 'platform_inherit' | null
  sourceLabel: string
  updatedAt: string | null
}

export type PlatformPricingListPageData = {
  stats: {
    cardTypeCount: number
    activePlatformPriceCount: number
    datacenterCardPairCount: number
    sellPriceEntryCount: number
  }
  rows: PlatformCardTypeListRow[]
}

export type PlatformPricingDetailPageData = {
  cardTypeId: string
  cardTypeName: string
  manufacturer: string
  memoryGB: number
  periods: PlatformCardPricePeriodRow[]
  /** 默认选中的时间段（当前有效） */
  currentPeriodId: string | null
  platformPrices: PlatformProductLinePriceRow[]
  datacenters: PlatformDatacenterPriceGroupRow[]
  platformHistoryCount: number
}
