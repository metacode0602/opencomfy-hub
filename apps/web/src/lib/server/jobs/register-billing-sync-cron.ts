import cron from 'node-cron'
import {
  getBillingSyncCron,
  getBillingSyncTimezone,
  isBillingSyncEnabled,
} from '@/lib/server/dataaccess/crm/billing-sync-config'
import { runScheduledBillingSync } from '@/lib/server/dataaccess/crm/billing-scheduled-sync'
import { crmError, crmLog } from '@/lib/server/dataaccess/crm/logger'

let registered = false

export function registerBillingSyncCron(): void {
  if (registered) return
  if (!isBillingSyncEnabled()) {
    crmLog('billing-cron', 'disabled (BILLING_SYNC_ENABLED != true)')
    return
  }

  const expression = getBillingSyncCron()
  if (!cron.validate(expression)) {
    crmError('billing-cron', 'invalid cron expression', new Error(expression), { expression })
    return
  }

  const timezone = getBillingSyncTimezone()
  cron.schedule(
    expression,
    () => {
      void runScheduledBillingSync({ trigger: 'scheduled' }).catch((error) => {
        crmError('billing-cron', 'scheduled run failed', error)
      })
    },
    { timezone },
  )

  registered = true
  crmLog('billing-cron', 'registered', { expression, timezone })
}
