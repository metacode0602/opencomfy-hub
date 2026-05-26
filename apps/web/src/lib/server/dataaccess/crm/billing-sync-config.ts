const DEFAULT_CRON = '0 5 * * *'
const DEFAULT_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_SAFETY_DAYS = 2
const DEFAULT_PROJECT_STATUSES = ['active']

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export function isBillingSyncEnabled(): boolean {
  return process.env.BILLING_SYNC_ENABLED === 'true'
}

export function getBillingSyncCron(): string {
  return process.env.BILLING_SYNC_CRON?.trim() || DEFAULT_CRON
}

export function getBillingSyncTimezone(): string {
  return process.env.BILLING_SYNC_TIMEZONE?.trim() || DEFAULT_TIMEZONE
}

export function getBillingSyncSafetyDays(): number {
  return parsePositiveInt(process.env.BILLING_SYNC_SAFETY_DAYS, DEFAULT_SAFETY_DAYS)
}

export function getBillingSyncInitialStartDate(): string | null {
  const raw = process.env.BILLING_SYNC_INITIAL_START_DATE?.trim()
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

export function getBillingSyncProjectStatuses(): string[] {
  const raw = process.env.BILLING_SYNC_PROJECT_STATUSES?.trim()
  if (!raw) return DEFAULT_PROJECT_STATUSES
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts : DEFAULT_PROJECT_STATUSES
}

export function getBillingSyncConfig() {
  return {
    enabled: isBillingSyncEnabled(),
    cron: getBillingSyncCron(),
    timezone: getBillingSyncTimezone(),
    safetyDays: getBillingSyncSafetyDays(),
    projectStatuses: getBillingSyncProjectStatuses(),
  }
}

export function getCronSecret(): string | null {
  const raw = process.env.CRON_SECRET?.trim()
  return raw || null
}
