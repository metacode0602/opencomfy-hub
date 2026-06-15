import { normalizeBillingRegion } from '@/lib/server/dataaccess/finance/tenant-bill-pricing'
import { normalizeDatacenterName } from '@/lib/supplier/datacenter-import-utils'
import { parseEndpointHost } from '@/lib/supplier/ip-endpoint-utils'

export function normalizeIdcKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return normalizeDatacenterName(value)
}

export function normalizeRegionKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return normalizeBillingRegion(value)
}

export function normalizeIpHost(value: string | null | undefined): string | null {
  const host = parseEndpointHost(value)
  return host || null
}

/** 东八区当前小时整点 */
export function getSnapshotHourAsiaShanghai(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const y = Number(pick('year'))
  const m = Number(pick('month'))
  const d = Number(pick('day'))
  const h = Number(pick('hour'))
  return new Date(Date.UTC(y, m - 1, d, h - 8, 0, 0, 0))
}
