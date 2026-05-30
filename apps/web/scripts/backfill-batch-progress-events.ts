/**
 * ETL-BE-2：历史批次进度事件回填（H1）
 * 用法：pnpm --filter web exec tsx scripts/backfill-batch-progress-events.ts [--dry-run]
 */

import { db } from '../src/lib/db'
import { appendBatchProgressEvent } from '../src/lib/server/aggregation/batch-progress-events'
import { onboardingBatch } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

const BATCH_SIZE = 500
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const rows = await db
    .select({ id: onboardingBatch.id })
    .from(onboardingBatch)
    .orderBy(onboardingBatch.createdAt)

  console.log(`批次总数 ${rows.length}，dryRun=${dryRun}`)

  let created = 0
  let synced = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    for (const { id } of chunk) {
      const [batch] = await db
        .select({
          createdAt: onboardingBatch.createdAt,
          progressSyncedAt: onboardingBatch.progressSyncedAt,
          updatedAt: onboardingBatch.updatedAt,
        })
        .from(onboardingBatch)
        .where(eq(onboardingBatch.id, id))
        .limit(1)

      if (!batch) continue

      const createdAt = batch.createdAt
      const syncedAt = batch.progressSyncedAt ?? batch.updatedAt

      if (dryRun) {
        created++
        synced++
        continue
      }

      await db.transaction(async (tx) => {
        const r1 = await appendBatchProgressEvent({
          batchId: id,
          eventType: 'batch_created',
          occurredAt: createdAt,
          tx,
          payload: { source: 'system', backfill: 'H1' },
        })
        if (r1.inserted) created++

        const r2 = await appendBatchProgressEvent({
          batchId: id,
          eventType: 'progress_synced',
          occurredAt: syncedAt,
          tx,
          payload: { source: 'system', backfill: 'H1' },
        })
        if (r2.inserted) synced++
      })
    }

    console.log(`进度 ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`)
  }

  console.log(`完成：batch_created=${created}，progress_synced=${synced}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
