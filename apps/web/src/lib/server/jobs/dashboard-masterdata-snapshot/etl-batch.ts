import { db } from '@/lib/db'
import { dashboardEtlBatch } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

export type MasterdataEtlJobCode =
  | 'etl_md_hourly'
  | 'etl_md_daily'
  | 'etl_md_inventory_realtime'

function newId(): string {
  return crypto.randomUUID()
}

export async function startDashboardEtlBatch(input: {
  jobCode: MasterdataEtlJobCode
  granularity: 'hour' | 'day'
  bucketStart: Date
  bucketEnd?: Date
  payload?: Record<string, unknown>
}): Promise<string> {
  const id = newId()
  await db.insert(dashboardEtlBatch).values({
    id,
    jobCode: input.jobCode,
    granularity: input.granularity,
    bucketStart: input.bucketStart,
    bucketEnd: input.bucketEnd ?? null,
    status: 'running',
    rowsAffected: 0,
    payload: input.payload ?? null,
  })
  return id
}

export async function finishDashboardEtlBatch(input: {
  batchId: string
  status: 'succeeded' | 'failed'
  rowsAffected: number
  errorMessage?: string
}): Promise<void> {
  await db
    .update(dashboardEtlBatch)
    .set({
      status: input.status,
      rowsAffected: input.rowsAffected,
      errorMessage: input.errorMessage ?? null,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dashboardEtlBatch.id, input.batchId))
}
