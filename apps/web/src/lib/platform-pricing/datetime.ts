/** 平台定价生效时间格式：yyyy-MM-dd HH:mm:ss（本地时间） */
export const PLATFORM_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
export const PLATFORM_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function normalizePlatformDateTime(value: string): string {
  const trimmed = value.trim()
  if (PLATFORM_DATETIME_REGEX.test(trimmed)) return trimmed
  if (PLATFORM_DATE_REGEX.test(trimmed)) return `${trimmed} 00:00:00`
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed
  return formatPlatformDateTime(d)
}

export function formatPlatformDateTime(date: Date | string): string {
  const d =
    typeof date === 'string'
      ? new Date(
          PLATFORM_DATETIME_REGEX.test(date)
            ? date.replace(' ', 'T')
            : PLATFORM_DATE_REGEX.test(date)
              ? `${date}T00:00:00`
              : date,
        )
      : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function parsePlatformDateTime(value: string): number {
  const normalized = normalizePlatformDateTime(value)
  const [datePart = '', timePart = '00:00:00'] = normalized.split(' ')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, mi, s] = timePart.split(':').map(Number)
  return new Date(y!, m! - 1, d!, h!, mi!, s!).getTime()
}

export function formatPlatformPeriodDateTime(value: string): string {
  return normalizePlatformDateTime(value)
}

export function formatPlatformPeriodRange(from: string, to: string | null): string {
  const end = to ? formatPlatformPeriodDateTime(to) : '至今'
  return `${formatPlatformPeriodDateTime(from)} ~ ${end}`
}

/** 新段生效时间的前一秒，用于闭合上一段 */
export function secondBeforePlatformDateTime(value: string): string {
  return formatPlatformDateTime(new Date(parsePlatformDateTime(value) - 1000))
}

export function nowPlatformDateTime(): string {
  return formatPlatformDateTime(new Date())
}

export function toDatetimeLocalValue(platformDt: string): string {
  return normalizePlatformDateTime(platformDt).replace(' ', 'T')
}

export function fromDatetimeLocalValue(local: string): string {
  const trimmed = local.trim()
  if (!trimmed) return ''
  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed
  return normalizePlatformDateTime(withSeconds.replace('T', ' '))
}
