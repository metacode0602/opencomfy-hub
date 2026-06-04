import { formatShanghaiDate, shanghaiDateTimeToUtc } from '@/lib/crm/balance-snapshot-utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d!
}

/** 自然日 ± N 天，返回 YYYY-MM-DD */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function prevDayDateString(dateStr: string): string {
  return addDaysToDateString(dateStr, -1)
}

/** 生效日 00:00:00 东八区 */
export function effectiveFromStartUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return shanghaiDateTimeToUtc(y!, m!, d!, 0, 0, 0)
}

/** 自然日 23:59:59 东八区 */
export function dateEndUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return shanghaiDateTimeToUtc(y!, m!, d!, 23, 59, 59)
}

export function toEffectiveDateString(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10)
  return formatShanghaiDate(value)
}

export function todayShanghaiDateString(now = new Date()): string {
  return formatShanghaiDate(now)
}

/** 转正日期 YYYY-MM-DD → 成交锚定月 YYYY-MM（预览用） */
export function conversionDateToAnchorMonth(conversionDate: string): string | null {
  if (!isValidDateString(conversionDate)) return null
  return conversionDate.slice(0, 7)
}
