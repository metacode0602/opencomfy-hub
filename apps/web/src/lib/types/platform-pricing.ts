/** 平台定价体系 — 类型定义（依据 platform-pricing-design.md） */

export type PlatformProductLine =
  | 'elastic_service'
  | 'cloud_vm'
  | 'bare_metal'
  | 'job'
  | 'spot'

export type PlatformBillingUnit = 'hour' | 'day' | 'week' | 'month'

export type PlatformPriceStatus = 'draft' | 'active' | 'archived'

/** L1 平台销售价（按卡型时间段 + 产品线 × 租期） */
export type PlatformCardPriceRecord = {
  id: string
  gpuCardTypeId: string
  cardTypeName: string
  /** 同一卡型下的定价时间段 ID，该段内所有产品线记录共享起止日 */
  periodId: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  sellPrice: number
  currency: string
  effectiveFrom: string
  /** null = 仍在此时间段内（与 period 结束日一致） */
  effectiveTo?: string | null
  status: PlatformPriceStatus
  remark?: string
  updatedAt: string
  updatedBy?: string
}

/** L1 平台调价历史 */
export type PlatformCardPriceHistory = {
  id: string
  priceRecordId: string
  gpuCardTypeId: string
  cardTypeName: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  previousSellPrice?: number
  newSellPrice: number
  changedAt: string
  changedBy: string
  reason?: string
}

/** L2 供应商机房销售价 */
export type SupplierDatacenterSellPrice = {
  id: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  gpuCardTypeId: string
  cardTypeName: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  sellPrice: number
  platformSellPrice?: number
  inheritPlatformPrice: boolean
  currency: string
  effectiveFrom: string
  source: 'contract' | 'manual' | 'platform_inherit'
  remark?: string
  updatedAt: string
  updatedBy?: string
}

/** L2 机房销售价变更历史 */
export type SupplierDatacenterSellPriceHistory = {
  id: string
  sellPriceId: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  gpuCardTypeId: string
  cardTypeName: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  previousSellPrice?: number
  newSellPrice: number
  changedAt: string
  changedBy: string
  reason?: string
}

export const platformProductLineNames: Record<PlatformProductLine, string> = {
  elastic_service: '弹性服务部署',
  cloud_vm: '云主机',
  bare_metal: '裸金属',
  job: 'Job',
  spot: 'Spot',
}

export const platformBillingUnitNames: Record<PlatformBillingUnit, string> = {
  hour: '小时',
  day: '天',
  week: '周',
  month: '月',
}

export const platformPriceStatusNames: Record<PlatformPriceStatus, string> = {
  draft: '草稿',
  active: '生效中',
  archived: '已归档',
}

export const platformSellPriceSourceNames: Record<
  SupplierDatacenterSellPrice['source'],
  string
> = {
  contract: '合同约定',
  manual: '人工维护',
  platform_inherit: '继承平台价',
}

/** 非裸金属产品线固定按小时计价 */
export function defaultBillingUnitForProductLine(
  productLine: PlatformProductLine,
): PlatformBillingUnit {
  return productLine === 'bare_metal' ? 'hour' : 'hour'
}

export function billingUnitLabel(
  productLine: PlatformProductLine,
  unit: PlatformBillingUnit,
): string {
  if (productLine === 'bare_metal') {
    return `元/卡/${platformBillingUnitNames[unit]}`
  }
  return '元/卡/时'
}

export function formatSellPrice(
  price: number,
  productLine: PlatformProductLine,
  billingUnit: PlatformBillingUnit,
): string {
  const unit = billingUnitLabel(productLine, billingUnit)
  return `¥${price.toFixed(2)}/${unit.replace('元/卡/', '')}`
}

export function priceDeltaPercent(
  sellPrice: number,
  platformPrice?: number,
): number | null {
  if (platformPrice == null || platformPrice === 0) return null
  return ((sellPrice - platformPrice) / platformPrice) * 100
}
