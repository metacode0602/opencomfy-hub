export function formatRmb(amount: number) {
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDateTime(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

export const rechargeStatusLabels: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
}

export const orderStatusLabels: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  cancelled: "已取消",
}

export const billStatusLabels: Record<string, string> = {
  pending: "待支付",
  paid: "已出账",
  overdue: "逾期",
}

export const billDetailTypeLabels: Record<string, string> = {
  prepaid: "预付费",
  postpaid: "后付费",
}

export const billingUnitLabels: Record<string, string> = {
  hour: "小时",
  day: "天",
  month: "月",
}
