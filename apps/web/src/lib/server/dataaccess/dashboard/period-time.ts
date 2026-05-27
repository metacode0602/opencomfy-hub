/** 大盘区间时间工具（Asia/Shanghai UTC+8） */

export const DASHBOARD_TZ = 'Asia/Shanghai'
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000

export type PeriodGranularity = 'day' | 'hour'

export type PeriodBucket = {
  key: string
  label: string
  start: Date
  end: Date
}

export function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

export function formatDateKey(d: Date) {
  const cst = new Date(d.getTime() + TZ_OFFSET_MS)
  return `${cst.getUTCFullYear()}-${pad2(cst.getUTCMonth() + 1)}-${pad2(cst.getUTCDate())}`
}

export function formatDateTimeKey(d: Date) {
  const cst = new Date(d.getTime() + TZ_OFFSET_MS)
  return `${formatDateKey(d)}T${pad2(cst.getUTCHours())}`
}

export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  return new Date(Date.UTC(y, mo, day) - TZ_OFFSET_MS)
}

export function parseDateTimeKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const hour = Number(m[4])
  return new Date(Date.UTC(y, mo, day, hour) - TZ_OFFSET_MS)
}

export function startOfLocalDay(d: Date) {
  const key = formatDateKey(d)
  return parseDateKey(key)!
}

export function endOfLocalDay(d: Date) {
  const start = startOfLocalDay(d)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}

export function startOfLocalHour(d: Date) {
  const key = formatDateTimeKey(d)
  return parseDateTimeKey(key)!
}

export function endOfLocalHour(d: Date) {
  const start = startOfLocalHour(d)
  return new Date(start.getTime() + 60 * 60 * 1000 - 1)
}

export function buildPeriodBuckets(
  granularity: PeriodGranularity,
  periodStart: Date,
  periodEnd: Date,
): PeriodBucket[] {
  const buckets: PeriodBucket[] = []
  if (granularity === 'day') {
    let cursor = startOfLocalDay(periodStart)
    const end = endOfLocalDay(periodEnd)
    while (cursor.getTime() <= end.getTime()) {
      const bStart = cursor
      const bEnd = endOfLocalDay(cursor)
      buckets.push({
        key: formatDateKey(bStart),
        label: `${formatDateKey(bStart)} 00:00`,
        start: bStart,
        end: bEnd,
      })
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    }
    return buckets
  }

  let cursor = startOfLocalHour(periodStart)
  const end = endOfLocalHour(periodEnd)
  while (cursor.getTime() <= end.getTime()) {
    const bStart = cursor
    const bEnd = endOfLocalHour(cursor)
    buckets.push({
      key: formatDateTimeKey(bStart),
      label: `${formatDateTimeKey(bStart)}:00`,
      start: bStart,
      end: bEnd,
    })
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000)
  }
  return buckets
}

export function previousPeriodRange(periodStart: Date, periodEnd: Date) {
  const span = periodEnd.getTime() - periodStart.getTime()
  return {
    periodStart: new Date(periodStart.getTime() - span - 1),
    periodEnd: new Date(periodStart.getTime() - 1),
  }
}

export function bucketDurationHours(granularity: PeriodGranularity): number {
  return granularity === 'day' ? 24 : 1
}
