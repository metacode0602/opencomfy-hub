import type { PlatformBillingUnit } from '@/lib/types/platform-pricing'

export type ParsedDeviceModel = {
  cardCode: string
  cardCount: number
}

export type ParsedPurchaseQty = {
  qty: number
  billingUnit: PlatformBillingUnit
}

const DEVICE_MODEL_RE = /^(.+?)\s*[x×]\s*(\d+)\s*$/i
const PURCHASE_QTY_RE = /^(\d+(?:\.\d+)?)\s*[x×]\s*(.+)$/

const DURATION_PACKAGE_TO_UNIT: Array<{ pattern: RegExp; unit: PlatformBillingUnit }> = [
  { pattern: /24\s*小时时长包/, unit: 'day' },
  { pattern: /7\s*天时长包/, unit: 'week' },
  { pattern: /30\s*天时长包/, unit: 'month' },
  { pattern: /小时时长包/, unit: 'hour' },
]

export const BILLING_UNIT_LABEL: Record<PlatformBillingUnit, string> = {
  hour: '小时',
  day: '天',
  week: '周',
  month: '月',
}

export function parseDeviceModel(text: string | null | undefined): ParsedDeviceModel | null {
  const raw = text?.trim()
  if (!raw) return null
  const match = raw.match(DEVICE_MODEL_RE)
  if (!match) return null
  const cardCode = match[1]!.trim()
  const cardCount = Number.parseInt(match[2]!, 10)
  if (!cardCode || !Number.isFinite(cardCount) || cardCount <= 0) return null
  return { cardCode, cardCount }
}

/** 解析 Excel「设备数量」；缺省为 1。无效值返回 null。 */
export function parseDeviceQty(raw: string | number | null | undefined): number | null {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return 1
  }
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).trim())
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
  return n
}

export function parsePurchaseQty(text: string | null | undefined): ParsedPurchaseQty | null {
  const raw = text?.trim()
  if (!raw) return null
  const match = raw.match(PURCHASE_QTY_RE)
  if (!match) return null
  const qty = Number.parseFloat(match[1]!)
  const unitText = match[2]!.trim()
  if (!Number.isFinite(qty) || qty <= 0 || !unitText) return null

  for (const { pattern, unit } of DURATION_PACKAGE_TO_UNIT) {
    if (pattern.test(unitText)) {
      return { qty, billingUnit: unit }
    }
  }
  return null
}

export function normalizeBaremetalRegion(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return value.trim().toLowerCase()
}

export function formatBaremetalPricingKey(input: {
  regionCode: string
  cardCode: string
  billingUnit: PlatformBillingUnit
}): string {
  return `${input.regionCode} × ${input.cardCode}（${BILLING_UNIT_LABEL[input.billingUnit]}）`
}
