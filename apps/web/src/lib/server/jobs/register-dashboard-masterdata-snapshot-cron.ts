import cron from 'node-cron'

import {
  getDeviceMasterdataSnapshotDailyCron,
  getDeviceMasterdataSnapshotHourlyCron,
  getDeviceMasterdataSnapshotTimezone,
  isDeviceMasterdataSnapshotEnabled,
} from './dashboard-masterdata-snapshot/device-masterdata-snapshot-config'
import {
  runScheduledDeviceMasterdataDailySnapshot,
  runScheduledDeviceMasterdataHourlySnapshot,
} from './dashboard-masterdata-snapshot/run-scheduled'
import { dashboardError, dashboardLog } from '@/lib/server/dataaccess/dashboard/logger'

let registered = false

export function registerDashboardMasterdataSnapshotCron(): void {
  if (registered) return
  if (!isDeviceMasterdataSnapshotEnabled()) {
    dashboardLog(
      'device-masterdata-snapshot-cron',
      'disabled (DEVICE_MASTERDATA_SNAPSHOT_ENABLED != true)',
    )
    return
  }

  const timezone = getDeviceMasterdataSnapshotTimezone()
  const hourlyCron = getDeviceMasterdataSnapshotHourlyCron()
  const dailyCron = getDeviceMasterdataSnapshotDailyCron()

  if (!cron.validate(hourlyCron)) {
    dashboardError(
      'device-masterdata-snapshot-cron',
      'invalid hourly cron',
      new Error(hourlyCron),
      { hourlyCron },
    )
    return
  }
  if (!cron.validate(dailyCron)) {
    dashboardError(
      'device-masterdata-snapshot-cron',
      'invalid daily cron',
      new Error(dailyCron),
      { dailyCron },
    )
    return
  }

  cron.schedule(
    hourlyCron,
    () => {
      void runScheduledDeviceMasterdataHourlySnapshot()
    },
    { timezone },
  )

  cron.schedule(
    dailyCron,
    () => {
      void runScheduledDeviceMasterdataDailySnapshot()
    },
    { timezone },
  )

  registered = true
  dashboardLog('device-masterdata-snapshot-cron', 'registered', {
    hourlyCron,
    dailyCron,
    timezone,
  })
}
