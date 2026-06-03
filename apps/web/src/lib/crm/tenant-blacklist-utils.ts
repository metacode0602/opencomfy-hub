import {
  cstDateEndExclusiveToUtcIso,
  cstDateStartToUtcIso,
  formatCstDate,
  subtractCalendarDays,
} from '@/lib/crm/tenant-billing-import-utils'

export const TENANT_BLACKLIST_TYPE = 'TenantBlack'
export const DEFAULT_BLACKLIST_SAFETY_DAYS = 2
export const MAX_BLACKLIST_SAFETY_DAYS = 14
export const BLACKLIST_SYNC_PAGE_SIZE = 100

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isCstDateString(value: string): boolean {
  return DATE_RE.test(value.trim())
}

/** 平台黑名单列表 Query 时间（UTC ISO） */
export function toBlacklistListQueryTimes(startDate?: string, endDate?: string) {
  if (!endDate?.trim()) {
    return { start_time: '', end_time: '' }
  }
  const end_time = cstDateEndExclusiveToUtcIso(endDate.trim())
  const start_time = startDate?.trim() ? cstDateStartToUtcIso(startDate.trim()) : ''
  return { start_time, end_time }
}

export function computeSuggestedEndDate(safetyDays: number, now = new Date()): string {
  return subtractCalendarDays(formatCstDate(now), safetyDays)
}

export function computeBlacklistSyncWindow(input: {
  lastPullStartDate?: string
  safetyDays: number
  fullSync?: boolean
  now?: Date
}): {
  startDate: string | null
  endDate: string
  startTime: string
  endTime: string
} {
  const endDate = computeSuggestedEndDate(input.safetyDays, input.now)

  if (input.fullSync) {
    return {
      startDate: null,
      endDate,
      startTime: '',
      endTime: cstDateEndExclusiveToUtcIso(endDate),
    }
  }

  const startDate = input.lastPullStartDate?.trim()
  if (!startDate) {
    throw new Error('请填写上次拉取更新至日期，或勾选从最早数据全量拉取')
  }
  if (!isCstDateString(startDate)) {
    throw new Error('起始日期格式无效，请使用 YYYY-MM-DD')
  }
  if (startDate > endDate) {
    throw new Error('起始日期不能晚于结束日期（请检查滑动窗口）')
  }

  const { start_time, end_time } = toBlacklistListQueryTimes(startDate, endDate)
  return {
    startDate,
    endDate,
    startTime: start_time,
    endTime: end_time,
  }
}

export function formatBlacklistStatus(status: string): string {
  if (status === 'Open') return '封禁中'
  if (status === 'Close') return '已解除'
  return status
}
