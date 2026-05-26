export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerBillingSyncCron } = await import('./lib/server/jobs/register-billing-sync-cron')
    registerBillingSyncCron()
  }
}
