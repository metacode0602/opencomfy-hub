const DEFAULT_PROBE_CRON = '20 * * * *'
const DEFAULT_CLEANUP_CRON = '30 1 * * *'
const DEFAULT_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_PAGE_SIZE = 100
const DEFAULT_BARE_METAL_STALE_HOURS = 2
const DEFAULT_STAGING_RETENTION_HOURS = 24
const DEFAULT_SNAPSHOT_RETENTION_DAYS = 3

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export function isDevicePlatformProbeEnabled(): boolean {
  return process.env.DEVICE_PLATFORM_PROBE_ENABLED === 'true'
}

export function getDevicePlatformProbeCron(): string {
  return process.env.DEVICE_PLATFORM_PROBE_CRON?.trim() || DEFAULT_PROBE_CRON
}

export function getDevicePlatformProbeSnapshotCleanupCron(): string {
  return (
    process.env.DEVICE_PLATFORM_PROBE_SNAPSHOT_CLEANUP_CRON?.trim() || DEFAULT_CLEANUP_CRON
  )
}

export function getDevicePlatformProbeTimezone(): string {
  return process.env.DEVICE_PLATFORM_PROBE_TIMEZONE?.trim() || DEFAULT_TIMEZONE
}

export function getDevicePlatformProbePageSize(): number {
  return parsePositiveInt(process.env.DEVICE_PLATFORM_PROBE_PAGE_SIZE, DEFAULT_PAGE_SIZE)
}

export function getDevicePlatformProbeBareMetalStaleHours(): number {
  return parsePositiveInt(
    process.env.DEVICE_PLATFORM_PROBE_BARE_METAL_STALE_HOURS,
    DEFAULT_BARE_METAL_STALE_HOURS,
  )
}

export function getDevicePlatformProbeStagingRetentionHours(): number {
  return parsePositiveInt(
    process.env.DEVICE_PLATFORM_PROBE_STAGING_RETENTION_HOURS,
    DEFAULT_STAGING_RETENTION_HOURS,
  )
}

export function getDevicePlatformProbeSnapshotRetentionDays(): number {
  return parsePositiveInt(
    process.env.DEVICE_PLATFORM_PROBE_SNAPSHOT_RETENTION_DAYS,
    DEFAULT_SNAPSHOT_RETENTION_DAYS,
  )
}

export function getDevicePlatformProbeConfig() {
  return {
    enabled: isDevicePlatformProbeEnabled(),
    cron: getDevicePlatformProbeCron(),
    snapshotCleanupCron: getDevicePlatformProbeSnapshotCleanupCron(),
    timezone: getDevicePlatformProbeTimezone(),
    pageSize: getDevicePlatformProbePageSize(),
    bareMetalStaleHours: getDevicePlatformProbeBareMetalStaleHours(),
    stagingRetentionHours: getDevicePlatformProbeStagingRetentionHours(),
    snapshotRetentionDays: getDevicePlatformProbeSnapshotRetentionDays(),
  }
}

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET?.trim() || undefined
}

/** PostgreSQL advisory lock key（设计 §6.1） */
export const DEVICE_PLATFORM_PROBE_LOCK_KEY = 89451236791
