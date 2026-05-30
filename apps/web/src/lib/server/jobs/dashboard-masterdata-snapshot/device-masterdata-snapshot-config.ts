const DEFAULT_HOURLY_CRON = '5 * * * *'
const DEFAULT_DAILY_CRON = '15 0 * * *'
const DEFAULT_TIMEZONE = 'Asia/Shanghai'

export function isDeviceMasterdataSnapshotEnabled(): boolean {
  return process.env.DEVICE_MASTERDATA_SNAPSHOT_ENABLED === 'true'
}

export function getDeviceMasterdataSnapshotHourlyCron(): string {
  return process.env.DEVICE_MASTERDATA_SNAPSHOT_HOURLY_CRON?.trim() || DEFAULT_HOURLY_CRON
}

export function getDeviceMasterdataSnapshotDailyCron(): string {
  return process.env.DEVICE_MASTERDATA_SNAPSHOT_DAILY_CRON?.trim() || DEFAULT_DAILY_CRON
}

export function getDeviceMasterdataSnapshotTimezone(): string {
  return process.env.DEVICE_MASTERDATA_SNAPSHOT_TIMEZONE?.trim() || DEFAULT_TIMEZONE
}

export function getDeviceMasterdataSnapshotConfig() {
  return {
    enabled: isDeviceMasterdataSnapshotEnabled(),
    hourlyCron: getDeviceMasterdataSnapshotHourlyCron(),
    dailyCron: getDeviceMasterdataSnapshotDailyCron(),
    timezone: getDeviceMasterdataSnapshotTimezone(),
  }
}
