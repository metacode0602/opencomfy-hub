export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerBillingSyncCron } = await import('./lib/server/jobs/register-billing-sync-cron')
    registerBillingSyncCron()
    const { registerBalanceSnapshotCron } = await import(
      './lib/server/jobs/register-balance-snapshot-cron'
    )
    registerBalanceSnapshotCron()
    const { registerDashboardMasterdataSnapshotCron } = await import(
      './lib/server/jobs/register-dashboard-masterdata-snapshot-cron'
    )
    registerDashboardMasterdataSnapshotCron()
  }
}
