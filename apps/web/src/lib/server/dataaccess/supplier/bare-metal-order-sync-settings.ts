import { db } from '@/lib/db'
import type {
  BareMetalOrderSyncConfigDto,
  BareMetalOrderSyncJobItemDto,
  BareMetalOrderSyncJobRunDetailDto,
  BareMetalOrderSyncJobRunDto,
  BareMetalOrderSyncRunResult,
} from '@/lib/types/bare-metal-order-sync-api'
import {
  bareMetalSyncJobItem,
  bareMetalSyncJobRun,
  billingTenant,
} from '@workspace/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { getBareMetalOrderSyncConfig } from './bare-metal-order-sync-config'
import { runScheduledBareMetalOrderSync } from './bare-metal-order-scheduled-sync'

function toIso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null
}

function mapJobRun(row: typeof bareMetalSyncJobRun.$inferSelect): BareMetalOrderSyncJobRunDto {
  return {
    id: row.id,
    trigger: row.trigger as BareMetalOrderSyncJobRunDto['trigger'],
    startedAt: row.startedAt.toISOString(),
    finishedAt: toIso(row.finishedAt),
    status: row.status as BareMetalOrderSyncJobRunDto['status'],
    ordersFetchedCount: row.ordersFetchedCount,
    unknownTenantCount: row.unknownTenantCount,
    tenantsAutoImportedCount: row.tenantsAutoImportedCount,
    billingSyncTenantCount: row.billingSyncTenantCount,
    orderUpsertedCount: row.orderUpsertedCount,
    successCount: row.successCount,
    failedCount: row.failedCount,
    errorSummary: row.errorSummary,
  }
}

export const bareMetalOrderSyncSettingsDataAccess = {
  async getConfig(): Promise<BareMetalOrderSyncConfigDto> {
    const config = getBareMetalOrderSyncConfig()
    const state = await db.query.bareMetalSyncState.findFirst({
      where: (t, { eq }) => eq(t.id, 'default'),
    })

    return {
      enabled: config.enabled,
      cron: config.cron,
      timezone: config.timezone,
      billingLookbackMonths: config.billingLookbackMonths,
      autoImportTenantsEnabled: config.enabled,
      lastRunAt: toIso(state?.lastRunAt),
      lastSuccessAt: toIso(state?.lastSuccessAt),
    }
  },

  async runNow(): Promise<BareMetalOrderSyncRunResult> {
    const result = await runScheduledBareMetalOrderSync({ trigger: 'manual' })
    if (!result.jobRunId) {
      return {
        acquiredLock: false,
        message: '已有裸金属订单同步任务正在运行',
      }
    }
    return {
      acquiredLock: true,
      jobRunId: result.jobRunId,
      status: result.status,
    }
  },

  async listRuns(input?: { limit?: number; offset?: number }): Promise<{
    runs: BareMetalOrderSyncJobRunDto[]
    total: number
  }> {
    const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100)
    const offset = Math.max(input?.offset ?? 0, 0)

    const runs = await db
      .select()
      .from(bareMetalSyncJobRun)
      .orderBy(desc(bareMetalSyncJobRun.startedAt))
      .limit(limit)
      .offset(offset)

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bareMetalSyncJobRun)

    return {
      runs: runs.map(mapJobRun),
      total: countRows[0]?.count ?? 0,
    }
  },

  async getRunById(id: string): Promise<BareMetalOrderSyncJobRunDetailDto | null> {
    const run = await db.query.bareMetalSyncJobRun.findFirst({
      where: eq(bareMetalSyncJobRun.id, id),
    })
    if (!run) return null

    const items = await db
      .select({
        id: bareMetalSyncJobItem.id,
        jobRunId: bareMetalSyncJobItem.jobRunId,
        platformTenantId: bareMetalSyncJobItem.platformTenantId,
        tenantId: bareMetalSyncJobItem.tenantId,
        tenantName: billingTenant.name,
        phase: bareMetalSyncJobItem.phase,
        status: bareMetalSyncJobItem.status,
        orderCount: bareMetalSyncJobItem.orderCount,
        errorMessage: bareMetalSyncJobItem.errorMessage,
      })
      .from(bareMetalSyncJobItem)
      .leftJoin(billingTenant, eq(bareMetalSyncJobItem.tenantId, billingTenant.id))
      .where(eq(bareMetalSyncJobItem.jobRunId, id))
      .orderBy(bareMetalSyncJobItem.platformTenantId)

    const mappedItems: BareMetalOrderSyncJobItemDto[] = items.map((item) => ({
      id: item.id,
      jobRunId: item.jobRunId,
      platformTenantId: item.platformTenantId,
      tenantId: item.tenantId,
      tenantName: item.tenantName,
      phase: item.phase,
      status: item.status,
      orderCount: item.orderCount,
      errorMessage: item.errorMessage,
    }))

    return {
      ...mapJobRun(run),
      items: mappedItems,
    }
  },
}
