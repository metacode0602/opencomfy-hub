const DEFAULT_CRON = '10 * * * *'
const DEFAULT_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_BILLING_LOOKBACK_MONTHS = 6

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export function isBareMetalOrderSyncEnabled(): boolean {
  return process.env.BARE_METAL_ORDER_SYNC_ENABLED === 'true'
}

export function getBareMetalOrderSyncCron(): string {
  return process.env.BARE_METAL_ORDER_SYNC_CRON?.trim() || DEFAULT_CRON
}

export function getBareMetalOrderSyncTimezone(): string {
  return process.env.BARE_METAL_ORDER_SYNC_TIMEZONE?.trim() || DEFAULT_TIMEZONE
}

export function getBareMetalOrderSyncBillingLookbackMonths(): number {
  return parsePositiveInt(
    process.env.BARE_METAL_ORDER_SYNC_BILLING_LOOKBACK_MONTHS,
    DEFAULT_BILLING_LOOKBACK_MONTHS,
  )
}

export function getBareMetalOrderSyncConfig() {
  return {
    enabled: isBareMetalOrderSyncEnabled(),
    cron: getBareMetalOrderSyncCron(),
    timezone: getBareMetalOrderSyncTimezone(),
    billingLookbackMonths: getBareMetalOrderSyncBillingLookbackMonths(),
  }
}

/** PostgreSQL advisory lock key（独立于 billing sync） */
export const BARE_METAL_ORDER_SYNC_LOCK_KEY = 89451236790
