import {
  formatShanghaiDate,
  shanghaiDateTimeToUtc,
} from '@/lib/crm/balance-snapshot-utils'

export type WorkbenchPeriodPreset = 'today' | 'last7days' | 'thisMonth' | 'custom'

export type WorkbenchDateRange = {
  preset: WorkbenchPeriodPreset
  startDate: string
  endDate: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year: year!, month: month!, day: day! }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** 东八区自然日 ± N 天（dateStr 为 YYYY-MM-DD） */
export function addShanghaiDays(dateStr: string, deltaDays: number): string {
  const { year, month, day } = parseDateParts(dateStr)
  const utc = shanghaiDateTimeToUtc(year, month, day)
  utc.setUTCDate(utc.getUTCDate() + deltaDays)
  return formatShanghaiDate(utc)
}

export function daysInclusive(startDate: string, endDate: string): number {
  const start = parseDateParts(startDate)
  const end = parseDateParts(endDate)
  const startMs = shanghaiDateTimeToUtc(start.year, start.month, start.day).getTime()
  const endMs = shanghaiDateTimeToUtc(end.year, end.month, end.day).getTime()
  return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1
}

export function normalizeDateRange(startDate: string, endDate: string): {
  startDate: string
  endDate: string
} {
  return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate }
}

export function defaultWorkbenchThisMonthRange(now = new Date()): WorkbenchDateRange {
  const today = formatShanghaiDate(now)
  const { year, month } = parseDateParts(today)
  return {
    preset: 'thisMonth',
    startDate: `${year}-${pad2(month)}-01`,
    endDate: today,
  }
}

export function resolveWorkbenchPresetRange(
  preset: Exclude<WorkbenchPeriodPreset, 'custom'>,
  now = new Date(),
): { startDate: string; endDate: string } {
  const today = formatShanghaiDate(now)
  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today }
    case 'last7days':
      return { startDate: addShanghaiDays(today, -6), endDate: today }
    case 'thisMonth': {
      const { year, month } = parseDateParts(today)
      return { startDate: `${year}-${pad2(month)}-01`, endDate: today }
    }
  }
}

export function resolveWorkbenchDateRange(input?: {
  preset?: WorkbenchPeriodPreset
  startDate?: string
  endDate?: string
}): WorkbenchDateRange {
  const preset = input?.preset ?? 'thisMonth'
  if (preset === 'custom') {
    const startDate = input?.startDate
    const endDate = input?.endDate
    if (startDate && endDate && DATE_RE.test(startDate) && DATE_RE.test(endDate)) {
      const normalized = normalizeDateRange(startDate, endDate)
      return { preset: 'custom', ...normalized }
    }
    return defaultWorkbenchThisMonthRange()
  }
  return { preset, ...resolveWorkbenchPresetRange(preset) }
}

/** 环比对比区间 */
export function resolveCompareDateRange(
  startDate: string,
  endDate: string,
  preset: WorkbenchPeriodPreset,
): { startDate: string; endDate: string } {
  switch (preset) {
    case 'today':
      return {
        startDate: addShanghaiDays(startDate, -1),
        endDate: addShanghaiDays(endDate, -1),
      }
    case 'last7days':
      return {
        startDate: addShanghaiDays(startDate, -7),
        endDate: addShanghaiDays(startDate, -1),
      }
    case 'thisMonth': {
      const { year, month, day } = parseDateParts(endDate)
      let prevYear = year
      let prevMonth = month - 1
      if (prevMonth <= 0) {
        prevMonth = 12
        prevYear -= 1
      }
      const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
      const compareEndDay = Math.min(day, lastDayOfPrevMonth)
      return {
        startDate: `${prevYear}-${pad2(prevMonth)}-01`,
        endDate: `${prevYear}-${pad2(prevMonth)}-${pad2(compareEndDay)}`,
      }
    }
    case 'custom': {
      const len = daysInclusive(startDate, endDate)
      return {
        startDate: addShanghaiDays(startDate, -len),
        endDate: addShanghaiDays(startDate, -1),
      }
    }
  }
}

/** 充值 completed_at 查询：东八区左闭右开 */
export function shanghaiDateRangeToUtcBounds(startDate: string, endDate: string): {
  startUtc: Date
  endExclusiveUtc: Date
} {
  const { startDate: from, endDate: to } = normalizeDateRange(startDate, endDate)
  const startParts = parseDateParts(from)
  const endParts = parseDateParts(to)
  const startUtc = shanghaiDateTimeToUtc(startParts.year, startParts.month, startParts.day)
  const endExclusiveUtc = shanghaiDateTimeToUtc(endParts.year, endParts.month, endParts.day)
  endExclusiveUtc.setUTCDate(endExclusiveUtc.getUTCDate() + 1)
  return { startUtc, endExclusiveUtc }
}

export function enumerateShanghaiDates(startDate: string, endDate: string): string[] {
  const { startDate: from, endDate: to } = normalizeDateRange(startDate, endDate)
  const dates: string[] = []
  let cursor = from
  while (cursor <= to) {
    dates.push(cursor)
    cursor = addShanghaiDays(cursor, 1)
  }
  return dates
}

export function formatWorkbenchPeriodLabel(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} ~ ${endDate}`
}

export function consumptionTrendLabel(preset: WorkbenchPeriodPreset): string {
  switch (preset) {
    case 'today':
      return '今日消费'
    case 'last7days':
      return '近7天消费'
    case 'thisMonth':
      return '本月消费'
    case 'custom':
      return '时段消费'
  }
}

export function consumptionTrendCompareLabel(preset: WorkbenchPeriodPreset): string {
  switch (preset) {
    case 'today':
      return '较昨日'
    case 'last7days':
      return '较上7天'
    case 'thisMonth':
      return '较上月'
    case 'custom':
      return '较上周期'
  }
}
