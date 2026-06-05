/** 账期是否按整月、账期结束日刊例价计算成本（忽略刊例价分段） */
export function periodUsesPeriodEndCostPricing(period: {
  ignoreListPriceWindows?: boolean | null
  ignore_list_price_windows?: boolean | null
}): boolean {
  return Boolean(period.ignoreListPriceWindows ?? period.ignore_list_price_windows)
}
