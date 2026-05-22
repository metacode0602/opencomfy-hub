import type { SupplierPricingConfigStatus, SupplierPricingRecord } from '@/lib/data/types'

export type { SupplierPricingConfigStatus }

export const SUPPLIER_PRICING_CONFIG_STATUS_LABELS: Record<SupplierPricingConfigStatus, string> = {
  active: '可用',
  unavailable: '不可用',
}

/** 设备导入自动创建的占位成本（单价 0，待运营补全） */
export const PRICING_PLACEHOLDER_NOTE = '新增收入'

export function isPricingRecordUnavailable(
  record: Pick<SupplierPricingRecord, 'configStatus'>,
): boolean {
  return record.configStatus === 'unavailable'
}

export function pricingRecordRowClassName(
  record: Pick<SupplierPricingRecord, 'configStatus'>,
): string {
  return isPricingRecordUnavailable(record) ? 'bg-red-500/5 border-red-500/20' : ''
}

export function pricingValueClassName(
  record: Pick<SupplierPricingRecord, 'configStatus'>,
): string {
  return isPricingRecordUnavailable(record) ? 'text-red-500 font-medium' : 'text-foreground font-medium'
}
