import { db } from '@/lib/db'
import { platformTenantImportDataAccess } from '@/lib/server/dataaccess/crm/platform-tenant-import'
import { tenantBillingImportDataAccess } from '@/lib/server/dataaccess/crm/tenant-billing-import'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import { fetchPlatformMetalOrdersGlobal } from '@/lib/server/integrations/suanli-billing-api'
import {
  bareMetalSyncJobItem,
  bareMetalSyncJobRun,
  bareMetalSyncState,
  billingTenant,
} from '@workspace/db/schema'
import { sql } from 'drizzle-orm'
import {
  BARE_METAL_ORDER_SYNC_LOCK_KEY,
  getBareMetalOrderSyncBillingLookbackMonths,
} from './bare-metal-order-sync-config'
import { upsertPlatformBareMetalOrder } from './bare-metal-order-sync'

function newId() {
  return crypto.randomUUID()
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function billingLookbackStartDate(months: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  d.setMonth(d.getMonth() - months)
  return formatDate(d)
}

async function tryAcquireLock(): Promise<boolean> {
  const result = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${BARE_METAL_ORDER_SYNC_LOCK_KEY}) AS acquired`,
  )
  return Boolean(result.rows[0]?.acquired)
}

async function releaseLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${BARE_METAL_ORDER_SYNC_LOCK_KEY})`)
}

async function touchSyncState(partial: { lastRunAt?: Date; lastSuccessAt?: Date }) {
  const existing = await db.query.bareMetalSyncState.findFirst({
    where: (t, { eq }) => eq(t.id, 'default'),
  })
  if (!existing) {
    await db.insert(bareMetalSyncState).values({
      id: 'default',
      lastRunAt: partial.lastRunAt ?? null,
      lastSuccessAt: partial.lastSuccessAt ?? null,
    })
    return
  }
  await db
    .update(bareMetalSyncState)
    .set({
      lastRunAt: partial.lastRunAt ?? existing.lastRunAt,
      lastSuccessAt: partial.lastSuccessAt ?? existing.lastSuccessAt,
    })
    .where(sql`id = 'default'`)
}

export async function runScheduledBareMetalOrderSync(input: {
  trigger: 'scheduled' | 'manual'
}): Promise<{ jobRunId: string; status: string }> {
  const traceId = crypto.randomUUID().slice(0, 8)
  const acquired = await tryAcquireLock()
  if (!acquired) {
    crmWarn('bare-metal-sync', 'skipped (lock held)', { traceId })
    return { jobRunId: '', status: 'skipped' }
  }

  const jobRunId = newId()
  const startedAt = new Date()
  await touchSyncState({ lastRunAt: startedAt })

  await db.insert(bareMetalSyncJobRun).values({
    id: jobRunId,
    trigger: input.trigger,
    startedAt,
    status: 'running',
  })

  let ordersFetchedCount = 0
  let unknownTenantCount = 0
  let tenantsAutoImportedCount = 0
  let billingSyncTenantCount = 0
  let orderUpsertedCount = 0
  let successCount = 0
  let failedCount = 0
  const errorParts: string[] = []

  try {
    crmLog('bare-metal-sync', 'fetch global orders', { traceId })
    const orders = await fetchPlatformMetalOrdersGlobal({ traceId })
    ordersFetchedCount = orders.length

    const platformTenantIds = [
      ...new Set(orders.map((o) => String(o.tenant_id)).filter(Boolean)),
    ]

    const localTenants = await db
      .select({
        id: billingTenant.id,
        platformTenantId: billingTenant.platformTenantId,
      })
      .from(billingTenant)

    const knownPlatformIds = new Set(
      localTenants.map((t) => t.platformTenantId).filter(Boolean) as string[],
    )
    const unknownIds = platformTenantIds.filter((id) => !knownPlatformIds.has(id))
    unknownTenantCount = unknownIds.length

    const autoImport = await platformTenantImportDataAccess.autoImportTenantsForBareMetalSync(
      unknownIds,
      traceId,
    )
    tenantsAutoImportedCount = autoImport.importedCount
    failedCount += autoImport.errors.length
    for (const err of autoImport.errors) {
      errorParts.push(`租户 ${err.platformTenantId}: ${err.message}`)
    }

    const newlyImportedPlatformIds = unknownIds.filter((id) =>
      autoImport.tenantIdByPlatformId.has(id),
    )
    const lookbackMonths = getBareMetalOrderSyncBillingLookbackMonths()
    const startDate = billingLookbackStartDate(lookbackMonths)
    const endDate = formatDate(new Date())

    for (const platformTenantId of newlyImportedPlatformIds) {
      const tenantId = autoImport.tenantIdByPlatformId.get(platformTenantId)!
      billingSyncTenantCount++
      try {
        const result = await tenantBillingImportDataAccess.directImport({
          tenantId,
          startDate,
          endDate,
        })
        await db.insert(bareMetalSyncJobItem).values({
          id: newId(),
          jobRunId,
          platformTenantId,
          tenantId,
          phase: 'billing_sync',
          status: result.success ? 'success' : 'failed',
          orderCount: 0,
          errorMessage: result.success ? null : result.error,
        })
        if (result.success) successCount++
        else {
          failedCount++
          errorParts.push(`账单 ${platformTenantId}: ${result.error}`)
        }
      } catch (e) {
        failedCount++
        const msg = e instanceof Error ? e.message : '账单同步失败'
        errorParts.push(`账单 ${platformTenantId}: ${msg}`)
        await db.insert(bareMetalSyncJobItem).values({
          id: newId(),
          jobRunId,
          platformTenantId,
          tenantId,
          phase: 'billing_sync',
          status: 'failed',
          orderCount: 0,
          errorMessage: msg,
        })
      }
    }

    for (const record of orders) {
      const platformTenantId = String(record.tenant_id)
      const tenantRow = await db.query.billingTenant.findFirst({
        where: (t, { eq }) => eq(t.platformTenantId, platformTenantId),
        columns: { id: true, platformTenantId: true, customerId: true },
      })
      if (!tenantRow?.platformTenantId) continue

      try {
        await upsertPlatformBareMetalOrder({
          record,
          tenant: {
            tenantId: tenantRow.id,
            platformTenantId: tenantRow.platformTenantId,
            customerId: tenantRow.customerId,
          },
          traceId,
        })
        orderUpsertedCount++
      } catch (e) {
        failedCount++
        errorParts.push(`订单 ${record.order_no}: ${e instanceof Error ? e.message : 'upsert 失败'}`)
      }
    }

    const status =
      failedCount > 0 && orderUpsertedCount > 0
        ? 'partial'
        : failedCount > 0
          ? 'failed'
          : 'success'

    await db
      .update(bareMetalSyncJobRun)
      .set({
        finishedAt: new Date(),
        status,
        ordersFetchedCount,
        unknownTenantCount,
        tenantsAutoImportedCount,
        billingSyncTenantCount,
        orderUpsertedCount,
        successCount,
        failedCount,
        errorSummary: errorParts.length > 0 ? errorParts.slice(0, 20).join('；') : null,
      })
      .where(sql`id = ${jobRunId}`)

    if (status !== 'failed') {
      await touchSyncState({ lastSuccessAt: new Date() })
    }

    crmLog('bare-metal-sync', 'done', {
      traceId,
      status,
      ordersFetchedCount,
      orderUpsertedCount,
    })

    return { jobRunId, status }
  } catch (e) {
    crmError('bare-metal-sync', 'job failed', e, { traceId })
    await db
      .update(bareMetalSyncJobRun)
      .set({
        finishedAt: new Date(),
        status: 'failed',
        ordersFetchedCount,
        unknownTenantCount,
        tenantsAutoImportedCount,
        billingSyncTenantCount,
        orderUpsertedCount,
        successCount,
        failedCount,
        errorSummary: e instanceof Error ? e.message : '任务失败',
      })
      .where(sql`id = ${jobRunId}`)
    return { jobRunId, status: 'failed' }
  } finally {
    await releaseLock()
  }
}
