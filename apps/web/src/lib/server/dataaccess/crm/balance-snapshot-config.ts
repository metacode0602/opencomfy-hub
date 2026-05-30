const DEFAULT_HOURLY_CRON = '5 * * * *'
const DEFAULT_DAILY_CRON = '5 0 * * *'
const DEFAULT_TIMEZONE = 'Asia/Shanghai'

export function isBalanceSnapshotEnabled(): boolean {
  return process.env.BALANCE_SNAPSHOT_ENABLED === 'true'
}

export function getBalanceSnapshotHourlyCron(): string {
  return process.env.BALANCE_SNAPSHOT_HOURLY_CRON?.trim() || DEFAULT_HOURLY_CRON
}

export function getBalanceSnapshotDailyCron(): string {
  return process.env.BALANCE_SNAPSHOT_DAILY_CRON?.trim() || DEFAULT_DAILY_CRON
}

export function getBalanceSnapshotTimezone(): string {
  return process.env.BALANCE_SNAPSHOT_TIMEZONE?.trim() || DEFAULT_TIMEZONE
}

export function getBalanceSnapshotConfig() {
  return {
    enabled: isBalanceSnapshotEnabled(),
    hourlyCron: getBalanceSnapshotHourlyCron(),
    dailyCron: getBalanceSnapshotDailyCron(),
    timezone: getBalanceSnapshotTimezone(),
  }
}
