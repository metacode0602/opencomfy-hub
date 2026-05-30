const SHANGHAI_TZ = 'Asia/Shanghai'

type ShanghaiParts = {
  year: number
  month: number
  day: number
  hour: number
}

function shanghaiParts(date: Date): ShanghaiParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatShanghaiDate(date: Date): string {
  const p = shanghaiParts(date)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

export function shanghaiDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+08:00`,
  )
}

/** 当前东八区整点桶（cron :05 采集时写入所属小时） */
export function currentHourBucket(now = new Date()): {
  bucketStart: Date
  bucketDate: string
} {
  const p = shanghaiParts(now)
  return {
    bucketStart: shanghaiDateTimeToUtc(p.year, p.month, p.day, p.hour),
    bucketDate: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
  }
}

/** 东八区上一自然日 00:00 桶（日末余额，由次日 00:05 job 写入） */
export function previousDayBucket(now = new Date()): {
  bucketStart: Date
  bucketDate: string
} {
  const todayStart = shanghaiDateTimeToUtc(
    ...(() => {
      const p = shanghaiParts(now)
      return [p.year, p.month, p.day] as const
    })(),
  )
  const bucketStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
  return {
    bucketStart,
    bucketDate: formatShanghaiDate(bucketStart),
  }
}

export function usageMonthFromDate(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/** 东八区自然月 YYYY-MM；offsetMonths=1 为上月 */
export function shanghaiUsageMonth(now = new Date(), offsetMonths = 0): string {
  const p = shanghaiParts(now)
  let year = p.year
  let month = p.month - offsetMonths
  while (month <= 0) {
    month += 12
    year -= 1
  }
  while (month > 12) {
    month -= 12
    year += 1
  }
  return `${year}-${pad2(month)}`
}

/** 最近 N 个东八区自然月（含当月），升序 */
export function lastNShanghaiUsageMonths(count: number, now = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => shanghaiUsageMonth(now, count - 1 - i))
}

export function monthDateRange(usageMonth: string): { from: string; to: string } {
  const [y, m] = usageMonth.split('-').map(Number)
  const lastDay = new Date(y!, m!, 0).getDate()
  return {
    from: `${usageMonth}-01`,
    to: `${usageMonth}-${pad2(lastDay)}`,
  }
}

export function snapshotRowId(
  granularity: 'hour' | 'day',
  tenantId: string,
  bucketStart: Date,
  bucketDate: string,
): string {
  if (granularity === 'day') {
    return `balance-day-${tenantId}-${bucketDate}`
  }
  return `balance-hour-${tenantId}-${bucketStart.toISOString()}`
}

export function formatHourLabel(iso: string): string {
  const d = new Date(iso)
  const p = shanghaiParts(d)
  return `${pad2(p.hour)}:00`
}

export function formatDayLabel(dateStr: string): string {
  return dateStr.slice(5)
}
