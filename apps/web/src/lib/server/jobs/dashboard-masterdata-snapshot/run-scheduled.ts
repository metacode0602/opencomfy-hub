import { dashboardError, dashboardWarn } from '@/lib/server/dataaccess/dashboard/logger'

import {
  releaseDeviceMasterdataSnapshotLock,
  tryAcquireDeviceMasterdataSnapshotLock,
} from './device-masterdata-snapshot-lock'
import { runEtlMdDaily, runEtlMdHourly } from './project-devices'

export async function runScheduledDeviceMasterdataHourlySnapshot(): Promise<void> {
  const acquired = await tryAcquireDeviceMasterdataSnapshotLock()
  if (!acquired) {
    dashboardWarn('device-masterdata-snapshot-cron', 'hourly skipped (lock held)')
    return
  }

  try {
    await runEtlMdHourly()
  } catch (error) {
    dashboardError('device-masterdata-snapshot-cron', 'hourly failed', error)
  } finally {
    await releaseDeviceMasterdataSnapshotLock()
  }
}

export async function runScheduledDeviceMasterdataDailySnapshot(): Promise<void> {
  const acquired = await tryAcquireDeviceMasterdataSnapshotLock()
  if (!acquired) {
    dashboardWarn('device-masterdata-snapshot-cron', 'daily skipped (lock held)')
    return
  }

  try {
    await runEtlMdDaily()
  } catch (error) {
    dashboardError('device-masterdata-snapshot-cron', 'daily failed', error)
  } finally {
    await releaseDeviceMasterdataSnapshotLock()
  }
}
