const PERIOD_CODE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

export const PERIOD_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  imported: '已导入',
  import_error: '导入错误',
  pending_allocation: '待配置分成',
  pending_pricing: '待配置成本',
  computed: '已计算',
  published: '已发布',
  adjusted: '已调账',
  void: '已作废',
}

export function isPublishedPeriodStatus(status: string): boolean {
  return status === 'published'
}

export function formatPeriodStatus(status: string): string {
  return PERIOD_STATUS_LABELS[status] ?? status
}

/** 账期编码格式：YYYY-MM */
export function isValidPeriodCode(value: string): boolean {
  return PERIOD_CODE_PATTERN.test(value.trim())
}

/** 根据 YYYY-MM 账期编码计算当月首尾日期（YYYY-MM-DD） */
export function getPeriodDateRange(
  periodCode: string,
): { start: string; end: string } | null {
  const trimmed = periodCode.trim()
  const match = PERIOD_CODE_PATTERN.exec(trimmed)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const lastDay = new Date(year, month, 0).getDate()
  const monthStr = match[2]

  return {
    start: `${match[1]}-${monthStr}-01`,
    end: `${match[1]}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  }
}
