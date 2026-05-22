/** 租户账单同步 — 日期、金额、映射工具 */

export const PLATFORM_AMOUNT_DIVISOR = 10_000

export function platformAmountToRmb(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 0
  return raw / PLATFORM_AMOUNT_DIVISOR
}

export function platformAmountToMoneyString(raw: number | null | undefined): string {
  return platformAmountToRmb(raw).toFixed(4)
}

export function moneyStringsEqual(a: string, b: string): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.0001
}

export function validateBillingDateRange(startDate?: string, endDate?: string) {
  const hasStart = Boolean(startDate?.trim())
  const hasEnd = Boolean(endDate?.trim())
  if (hasStart !== hasEnd) {
    throw new Error('开始日期与结束日期须同时填写或同时留空')
  }
  if (hasStart && hasEnd && startDate! > endDate!) {
    throw new Error('开始日期不能晚于结束日期')
  }
}

/** 东八区自然日 00:00 → UTC ISO（月度账单 overview 查询） */
export function cstDateStartToUtcIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+08:00`).toISOString()
}

/** 东八区结束日 inclusive → 次日 00:00 CST 的 UTC ISO */
export function cstDateEndExclusiveToUtcIso(dateStr: string): string {
  const start = new Date(`${dateStr}T00:00:00+08:00`)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString()
}

function emptyApiDateRange() {
  return { start_time: '', end_time: '' }
}

/** 裸金属订单 API：UTC ISO，东八区自然日 00:00 → 结束日次日 00:00（左闭右开） */
export function toMetalOrderQueryTimes(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return emptyApiDateRange()
  return {
    start_time: cstDateStartToUtcIso(startDate),
    end_time: cstDateEndExclusiveToUtcIso(endDate),
  }
}

/** 月度账单 overview API：UTC ISO，东八区自然日界（与裸金属请求规则一致） */
export function toMonthlyBillQueryTimes(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return emptyApiDateRange()
  return {
    start_time: cstDateStartToUtcIso(startDate),
    end_time: cstDateEndExclusiveToUtcIso(endDate),
  }
}

/** 充值列表 API：UTC ISO，东八区自然日界（左闭右开） */
export function toRechargeQueryTimes(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return emptyApiDateRange()
  return {
    start_time: cstDateStartToUtcIso(startDate),
    end_time: cstDateEndExclusiveToUtcIso(endDate),
  }
}

/** 账单明细 API：必须与 overview 返回的 start_time / end_time 原样一致 */
export function toBillDetailQueryTimes(startTime: string, endTime: string) {
  return { start_time: startTime, end_time: endTime }
}

export function billMonthFromPlatformPeriod(startTime: string): string {
  const m = /^(\d{4}-\d{2})/.exec(startTime)
  if (m) return m[1]!
  const d = new Date(startTime)
  if (Number.isNaN(d.getTime())) return startTime.slice(0, 7)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const mo = parts.find((p) => p.type === 'month')?.value
  return y && mo ? `${y}-${mo}` : startTime.slice(0, 7)
}

export function dueDateForBillMonth(billMonth: string): string {
  return `${billMonth}-15`
}

export function parsePlatformDateTime(raw: string): Date | null {
  if (!raw?.trim()) return null
  const normalized = raw.trim().replace(' +00:00', 'Z').replace(' ', 'T')
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

const PRODUCT_LINE_MAP: Record<string, { productLine: string; resourceName: string }> = {
  'Pod:Job': { productLine: 'pod_job', resourceName: 'Job' },
  'Pod:Deployment': { productLine: 'pod_deployment', resourceName: 'Deployment' },
  'Pod:Development': { productLine: 'pod_development', resourceName: 'Development' },
  BareMetalFullRental: { productLine: 'bare_metal', resourceName: '裸金属整租' },
  Juicefs: { productLine: 'juicefs', resourceName: 'JuiceFS' },
  ShareStorage: { productLine: 'share_storage', resourceName: '共享存储' },
  Harbor: { productLine: 'harbor', resourceName: 'Harbor' },
  PrepaidDeduction: { productLine: 'prepaid_deduction', resourceName: '预付费抵扣' },
}

export function mapPlatformProductLine(platformKey: string) {
  const mapped = PRODUCT_LINE_MAP[platformKey]
  if (mapped) return mapped
  const snake = platformKey.replace(/[:]/g, '_').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  return { productLine: snake, resourceName: platformKey }
}

export function mapMetalOrderStatus(status: string): string {
  switch (status) {
    case 'Finished':
      return 'completed'
    case 'Canceled':
    case 'Cancelled':
      return 'cancelled'
    default:
      return status.toLowerCase()
  }
}

export function mapMetalBillingUnit(billingType: string | null | undefined): string | null {
  if (!billingType) return null
  switch (billingType) {
    case 'Hour':
      return 'hour'
    case 'Day':
      return 'day'
    case 'Month':
      return 'month'
    default:
      return billingType.toLowerCase()
  }
}

export function mapPayChannel(payChannel: string | null | undefined): string {
  switch (payChannel) {
    case 'Offline':
      return 'bank_transfer'
    case 'WeChat':
      return 'wechat'
    case 'Alipay':
      return 'alipay'
    default:
      return 'bank_transfer'
  }
}

export function payChannelLabel(method: string): string {
  switch (method) {
    case 'bank_transfer':
      return '银行转账'
    case 'wechat':
      return '微信'
    case 'alipay':
      return '支付宝'
    case 'invoice':
      return '发票对公'
    default:
      return method
  }
}

export function mapRechargeStatus(status: string): string {
  return status === 'Completed' ? 'paid' : status.toLowerCase()
}

export function detailLineType(productLine: string): string {
  return productLine === 'bare_metal' || productLine === 'prepaid_deduction'
    ? 'prepaid'
    : 'postpaid'
}

export function formatGpuSummary(
  gpuModels: Array<{ gpu_model?: string; gpu_count?: number }> | undefined,
): string {
  if (!gpuModels?.length) return '—'
  return gpuModels
    .map((g) => `${g.gpu_model ?? '?'} × ${g.gpu_count ?? 0}`)
    .join(', ')
}

export function summarizeSection<T extends { action: string }>(items: T[]) {
  return {
    total: items.length,
    toCreate: items.filter((i) => i.action === 'create').length,
    toUpdate: items.filter((i) => i.action === 'update').length,
    skipped: items.filter((i) => i.action === 'skip').length,
  }
}
