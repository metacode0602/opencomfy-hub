import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/** 与 balance-snapshot (89451236790)、billing-sync (89451236789) 错开 */
const DEVICE_MASTERDATA_SNAPSHOT_LOCK_KEY = 89451236791

export async function tryAcquireDeviceMasterdataSnapshotLock(): Promise<boolean> {
  const result = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${DEVICE_MASTERDATA_SNAPSHOT_LOCK_KEY}) AS acquired`,
  )
  return Boolean(result.rows[0]?.acquired)
}

export async function releaseDeviceMasterdataSnapshotLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${DEVICE_MASTERDATA_SNAPSHOT_LOCK_KEY})`)
}
