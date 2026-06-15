import { isBalanceSnapshotEnabled } from '@/lib/server/dataaccess/crm/balance-snapshot-config'
import { isBillingSyncEnabled } from '@/lib/server/dataaccess/crm/billing-sync-config'
import { isDeviceMasterdataSnapshotEnabled } from '@/lib/server/jobs/dashboard-masterdata-snapshot/device-masterdata-snapshot-config'
import { registerDashboardMasterdataSnapshotCron } from '@/lib/server/jobs/register-dashboard-masterdata-snapshot-cron'
import { registerBalanceSnapshotCron } from '@/lib/server/jobs/register-balance-snapshot-cron'
import { registerBillingSyncCron } from '@/lib/server/jobs/register-billing-sync-cron'
import { registerBareMetalOrderSyncCron } from '@/lib/server/jobs/register-bare-metal-order-sync-cron'
import { isBareMetalOrderSyncEnabled } from '@/lib/server/dataaccess/supplier/bare-metal-order-sync-config'

export type CronInitResult = {
  ok: true
  alreadyInitialized: boolean
  jobs: {
    billingSync: { enabled: boolean }
    balanceSnapshot: { enabled: boolean }
    deviceMasterdataSnapshot: { enabled: boolean }
    bareMetalOrderSync: { enabled: boolean }
  }
}

let initialized = false
let initPromise: Promise<CronInitResult> | null = null

function runInit(): CronInitResult {
  registerBillingSyncCron()
  registerBalanceSnapshotCron()
  registerDashboardMasterdataSnapshotCron()
  registerBareMetalOrderSyncCron()

  initialized = true
  return {
    ok: true,
    alreadyInitialized: false,
    jobs: {
      billingSync: { enabled: isBillingSyncEnabled() },
      balanceSnapshot: { enabled: isBalanceSnapshotEnabled() },
      deviceMasterdataSnapshot: { enabled: isDeviceMasterdataSnapshotEnabled() },
      bareMetalOrderSync: { enabled: isBareMetalOrderSyncEnabled() },
    },
  }
}

export function initCronJobs(): Promise<CronInitResult> {
  if (initialized) {
    return Promise.resolve({
      ok: true,
      alreadyInitialized: true,
      jobs: {
        billingSync: { enabled: isBillingSyncEnabled() },
        balanceSnapshot: { enabled: isBalanceSnapshotEnabled() },
        deviceMasterdataSnapshot: { enabled: isDeviceMasterdataSnapshotEnabled() },
        bareMetalOrderSync: { enabled: isBareMetalOrderSyncEnabled() },
      },
    })
  }

  initPromise ??= Promise.resolve().then(runInit)
  return initPromise
}
