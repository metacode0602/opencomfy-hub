/**
 * 日期工具函数
 * 用于精确计算订阅周期，处理月份天数差异和闰年
 */

/**
 * 在指定日期基础上添加指定月数
 * @param date 起始日期
 * @param months 要添加的月数
 * @returns 新的日期对象
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const currentMonth = result.getMonth()
  const currentYear = result.getFullYear()

  // 计算新的月份和年份
  const newMonth = currentMonth + months
  const newYear = currentYear + Math.floor(newMonth / 12)
  const finalMonth = newMonth % 12

  // 设置新的月份和年份
  result.setFullYear(newYear)
  result.setMonth(finalMonth < 0 ? finalMonth + 12 : finalMonth)

  // 处理日期溢出问题（例如：1月31日 + 1个月 = 2月28/29日）
  const originalDate = date.getDate()
  const maxDate = new Date(newYear, finalMonth < 0 ? finalMonth + 13 : finalMonth + 1, 0).getDate()
  result.setDate(Math.min(originalDate, maxDate))

  return result
}

/**
 * 在指定日期基础上添加指定年数
 * @param date 起始日期
 * @param years 要添加的年数
 * @returns 新的日期对象
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)

  // 处理闰年2月29日的情况
  // 如果原日期是2月29日，但目标年份不是闰年，则设置为2月28日
  if (date.getMonth() === 1 && date.getDate() === 29) {
    const targetYear = result.getFullYear()
    const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0
    if (!isLeapYear) {
      result.setDate(28)
    }
  }

  return result
}

/**
 * 根据订阅间隔计算周期结束日期
 * @param startDate 周期开始日期
 * @param interval 订阅间隔 ('month' | 'year')
 * @returns 周期结束日期
 */
export function calculatePeriodEnd(startDate: Date, interval: 'month' | 'year'): Date {
  if (interval === 'year') {
    return addYears(startDate, 1)
  } else {
    return addMonths(startDate, 1)
  }
}

/**
 * 计算试用期结束日期
 * @param startDate 试用期开始日期
 * @param trialPeriodDays 试用期天数
 * @returns 试用期结束日期
 */
export function calculateTrialEnd(startDate: Date, trialPeriodDays: number): Date {
  const result = new Date(startDate)
  result.setDate(result.getDate() + trialPeriodDays)
  return result
}

/**
 * 计算两个日期之间的天数差
 * @param date1 第一个日期
 * @param date2 第二个日期
 * @returns 天数差（date2 - date1）
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * 检查日期是否在指定天数内
 * @param date 要检查的日期
 * @param days 天数
 * @returns 如果日期在未来指定天数内返回true
 */
export function isWithinDays(date: Date, days: number): boolean {
  const now = new Date()
  const targetDate = new Date(date)
  const diffTime = targetDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= days
}

/**
 * 检查日期是否已过期
 * @param date 要检查的日期
 * @returns 如果日期已过期返回true
 */
export function isExpired(date: Date | null | undefined): boolean {
  if (!date) return false
  return new Date(date) < new Date()
}


/**
 * Format a date for display
 * @param date Date to format
 * @returns Formatted date string in the format "Month Day, Year"
 */
export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '-'
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化为 yyyy-MM-dd HH:mm:ss（本地时间）
 * @param date
 * @returns
 */
export function formatDateTime(date: Date | string | undefined | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
