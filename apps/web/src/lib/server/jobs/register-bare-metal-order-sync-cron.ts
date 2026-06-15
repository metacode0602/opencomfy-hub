import cron from 'node-cron'
import {
  getBareMetalOrderSyncCron,
  getBareMetalOrderSyncTimezone,
  isBareMetalOrderSyncEnabled,
} from '@/lib/server/dataaccess/supplier/bare-metal-order-sync-config'
import { runScheduledBareMetalOrderSync } from '@/lib/server/dataaccess/supplier/bare-metal-order-scheduled-sync'
import { crmError, crmLog } from '@/lib/server/dataaccess/crm/logger'

let registered = false

export function registerBareMetalOrderSyncCron(): void {
  if (registered) return
  if (!isBareMetalOrderSyncEnabled()) {
    crmLog('bare-metal-cron', 'disabled (BARE_METAL_ORDER_SYNC_ENABLED != true)')
    return
  }

  const expression = getBareMetalOrderSyncCron()
  if (!cron.validate(expression)) {
    crmError('bare-metal-cron', 'invalid cron expression', new Error(expression), { expression })
    return
  }

  const timezone = getBareMetalOrderSyncTimezone()
  cron.schedule(
    expression,
    () => {
      void runScheduledBareMetalOrderSync({ trigger: 'scheduled' }).catch((error) => {
        crmError('bare-metal-cron', 'scheduled run failed', error)
      })
    },
    { timezone },
  )

  registered = true
  crmLog('bare-metal-cron', 'registered', { expression, timezone })
}
