import cron from 'node-cron'
import {
  getBalanceSnapshotDailyCron,
  getBalanceSnapshotHourlyCron,
  getBalanceSnapshotTimezone,
  isBalanceSnapshotEnabled,
} from '@/lib/server/dataaccess/crm/balance-snapshot-config'
import {
  runScheduledDailyBalanceSnapshot,
  runScheduledHourlyBalanceSnapshot,
} from '@/lib/server/dataaccess/crm/balance-snapshot'
import { crmError, crmLog } from '@/lib/server/dataaccess/crm/logger'

let registered = false

export function registerBalanceSnapshotCron(): void {
  if (registered) return
  if (!isBalanceSnapshotEnabled()) {
    crmLog('balance-snapshot-cron', 'disabled (BALANCE_SNAPSHOT_ENABLED != true)')
    return
  }

  const timezone = getBalanceSnapshotTimezone()
  const hourlyCron = getBalanceSnapshotHourlyCron()
  const dailyCron = getBalanceSnapshotDailyCron()

  if (!cron.validate(hourlyCron)) {
    crmError('balance-snapshot-cron', 'invalid hourly cron', new Error(hourlyCron), {
      hourlyCron,
    })
    return
  }
  if (!cron.validate(dailyCron)) {
    crmError('balance-snapshot-cron', 'invalid daily cron', new Error(dailyCron), { dailyCron })
    return
  }

  cron.schedule(
    hourlyCron,
    () => {
      void runScheduledHourlyBalanceSnapshot().catch((error) => {
        crmError('balance-snapshot-cron', 'hourly run failed', error)
      })
    },
    { timezone },
  )

  cron.schedule(
    dailyCron,
    () => {
      void runScheduledDailyBalanceSnapshot().catch((error) => {
        crmError('balance-snapshot-cron', 'daily run failed', error)
      })
    },
    { timezone },
  )

  registered = true
  crmLog('balance-snapshot-cron', 'registered', { hourlyCron, dailyCron, timezone })
}
