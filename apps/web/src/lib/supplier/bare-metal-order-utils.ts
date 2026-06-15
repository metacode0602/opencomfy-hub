export const BARE_METAL_ORDER_MARK_LABELS: Record<string, string> = {
  online: '线上',
  offline: '线下',
}

export const BARE_METAL_ORDER_SOURCE_LABELS: Record<string, string> = {
  platform_sync: '平台同步',
  offline_excel: '线下 Excel',
}

export const BARE_METAL_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  provisioning: '开通中',
  paid: '已支付',
  active: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}

export function bareMetalOrderDetailPath(id: string) {
  return `/supplier/bare-metal-orders/${id}`
}

export function formatBareMetalMoney(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatBareMetalDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
