/** 展示用金额格式化（mock 为字符串小数） */
export function formatMoney(value: string | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatText(value: string | null | undefined): string {
  if (value == null || value === "") return "—"
  return value
}

export function formatDate(value: string | null | undefined): string {
  if (value == null || value === "") return "—"
  return value
}
