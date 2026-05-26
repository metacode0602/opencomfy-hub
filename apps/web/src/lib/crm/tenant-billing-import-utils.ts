import type { TenantBillingImportCommitResult } from '@/lib/types/tenant-billing-import'

export function formatBillingCommitSummary(result: TenantBillingImportCommitResult): string {
  const parts: string[] = []
  const push = (label: string, s: { created: number; updated: number }) => {
    if (s.created + s.updated > 0) {
      parts.push(`${label} 新增 ${s.created} / 更新 ${s.updated}`)
    }
  }
  push('裸金属', result.metalOrders)
  push('月度账单', result.monthlyBills)
  push('充值', result.recharges)
  push('每日用量', result.dailyUsageBills)
  if ((result.billDetails.created ?? 0) + (result.billDetails.updated ?? 0) > 0) {
    parts.push(`账单明细 ${result.billDetails.created ?? 0} 行`)
  }
  return parts.join('；') || '无变更'
}

/** 租户账单同步 — 日期、金额、映射工具 */

/** billing_value / total_billing_value / discount_value — 10^6 平台单位 = 1 元 */
export const PLATFORM_BILLING_VALUE_DIVISOR = 1_000_000

/** total_price（裸金属）/ total_amount（充值）— 10^4 平台单位 = 1 元 */
export const PLATFORM_ORDER_AMOUNT_DIVISOR = 10_000

/** @deprecated 请使用 PLATFORM_ORDER_AMOUNT_DIVISOR */
export const PLATFORM_AMOUNT_DIVISOR = PLATFORM_ORDER_AMOUNT_DIVISOR

export function platformBillingValueToRmb(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 0
  return raw / PLATFORM_BILLING_VALUE_DIVISOR
}

export function platformOrderAmountToRmb(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 0
  return raw / PLATFORM_ORDER_AMOUNT_DIVISOR
}

export function platformBillingValueToMoneyString(
  raw: number | null | undefined,
): string {
  return platformBillingValueToRmb(raw).toFixed(4)
}

export function platformOrderAmountToMoneyString(
  raw: number | null | undefined,
): string {
  return platformOrderAmountToRmb(raw).toFixed(4)
}

/** @deprecated 裸金属/充值请用 platformOrderAmountToRmb */
export function platformAmountToRmb(raw: number | null | undefined): number {
  return platformOrderAmountToRmb(raw)
}

/** @deprecated 裸金属/充值请用 platformOrderAmountToMoneyString */
export function platformAmountToMoneyString(raw: number | null | undefined): string {
  return platformOrderAmountToMoneyString(raw)
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

/** 每日用量账单 API：UTC ISO，东八区自然日界（左闭右开） */
export function toDailyUsageBillQueryTimes(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return emptyApiDateRange()
  return {
    start_time: cstDateStartToUtcIso(startDate),
    end_time: cstDateEndExclusiveToUtcIso(endDate),
  }
}

/** 平台 Pod 任务类型 → 产品线（billing_pod_record_list task_type） */
export const PLATFORM_DAILY_USAGE_TASK_TYPES = ['Deployment', 'Job', 'Development'] as const

const TASK_TYPE_PRODUCT_LINE_MAP: Record<
  string,
  { productLine: string; label: string }
> = {
  Deployment: { productLine: 'pod_deployment', label: 'Deployment' },
  Job: { productLine: 'pod_job', label: 'Job' },
  Development: { productLine: 'pod_development', label: 'Development' },
}

export function mapPlatformTaskType(taskType: string) {
  const mapped = TASK_TYPE_PRODUCT_LINE_MAP[taskType]
  if (mapped) return mapped
  const snake = taskType.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  return { productLine: snake, label: taskType }
}

/** 从平台账期 start_time 提取东八区 usage_date（YYYY-MM-DD） */
export function usageDateFromPlatformPeriod(startTime: string): string {
  const d = parsePlatformDateTime(startTime)
  if (d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(startTime)
  return m ? m[1]! : startTime.slice(0, 10)
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
  const trimmed = raw.trim()
  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) return direct

  const normalized = trimmed
    .replace(' +00:00', 'Z')
    .replace(' ', 'T')
    .replace(/ \+(\d{2}:\d{2})$/, '+$1')
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
