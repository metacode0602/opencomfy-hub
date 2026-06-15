import cron from 'node-cron'
import { crmError, crmLog } from '@/lib/server/dataaccess/crm/logger'
import {
  getDevicePlatformProbeCron,
  getDevicePlatformProbeSnapshotCleanupCron,
  getDevicePlatformProbeTimezone,
  isDevicePlatformProbeEnabled,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-config'
import {
  runDevicePlatformProbeSnapshotCleanup,
  runScheduledDevicePlatformProbe,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-scheduled'

let probeRegistered = false
let cleanupRegistered = false

export function registerDevicePlatformProbeCron(): void {
  if (probeRegistered && cleanupRegistered) return

  if (!isDevicePlatformProbeEnabled()) {
    crmLog('device-platform-probe-cron', 'disabled (DEVICE_PLATFORM_PROBE_ENABLED != true)')
    probeRegistered = true
    cleanupRegistered = true
    return
  }

  const timezone = getDevicePlatformProbeTimezone()

  if (!probeRegistered) {
    const expression = getDevicePlatformProbeCron()
    if (!cron.validate(expression)) {
      crmError('device-platform-probe-cron', 'invalid probe cron', new Error(expression), {
        expression,
      })
    } else {
      cron.schedule(
        expression,
        () => {
          void runScheduledDevicePlatformProbe({ trigger: 'scheduled' }).catch((error) => {
            crmError('device-platform-probe-cron', 'scheduled probe failed', error)
          })
        },
        { timezone },
      )
      crmLog('device-platform-probe-cron', 'probe registered', { expression, timezone })
    }
    probeRegistered = true
  }

  if (!cleanupRegistered) {
    const cleanupExpression = getDevicePlatformProbeSnapshotCleanupCron()
    if (!cron.validate(cleanupExpression)) {
      crmError(
        'device-platform-probe-cron',
        'invalid cleanup cron',
        new Error(cleanupExpression),
        { expression: cleanupExpression },
      )
    } else {
      cron.schedule(
        cleanupExpression,
        () => {
          void runDevicePlatformProbeSnapshotCleanup().catch((error) => {
            crmError('device-platform-probe-cron', 'snapshot cleanup failed', error)
          })
        },
        { timezone },
      )
      crmLog('device-platform-probe-cron', 'cleanup registered', {
        expression: cleanupExpression,
        timezone,
      })
    }
    cleanupRegistered = true
  }
}
