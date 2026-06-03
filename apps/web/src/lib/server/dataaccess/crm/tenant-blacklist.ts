import { db } from '@/lib/db'
import {
  computeBlacklistSyncWindow,
  computeSuggestedEndDate,
  DEFAULT_BLACKLIST_SAFETY_DAYS,
  TENANT_BLACKLIST_TYPE,
} from '@/lib/crm/tenant-blacklist-utils'
import type {
  TenantBlacklistListItem,
  TenantBlacklistListResult,
  TenantBlacklistSyncDefaults,
  TenantBlacklistSyncResult,
} from '@/lib/types/tenant-blacklist'
import {
  billingTenant,
  platformTenantBlacklist,
  tenantBlacklistSyncJobRun,
  tenantBlacklistSyncState,
} from '@workspace/db/schema'
import { and, count, desc, eq, gte, ilike, inArray, isNull, lte } from 'drizzle-orm'
import {
  fetchAllBlacklistPages,
  parsePlatformBlacklistTime,
  type PlatformBlacklistRecord,
} from '@/lib/server/integrations/tenant-blacklist-api'
import { crmError, crmLog } from './logger'

const SYNC_STATE_ID = 'default'

function newId(): string {
  return crypto.randomUUID()
}

function toIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined
  return d.toISOString()
}

function formatDateOnly(d: Date | string | null | undefined): string | null {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

async function ensureSyncState() {
  const existing = await db.query.tenantBlacklistSyncState.findFirst({
    where: eq(tenantBlacklistSyncState.id, SYNC_STATE_ID),
  })
  if (existing) return existing

  await db.insert(tenantBlacklistSyncState).values({
    id: SYNC_STATE_ID,
    defaultSafetyDays: DEFAULT_BLACKLIST_SAFETY_DAYS,
  })

  const row = await db.query.tenantBlacklistSyncState.findFirst({
    where: eq(tenantBlacklistSyncState.id, SYNC_STATE_ID),
  })
  if (!row) throw new Error('初始化黑名单同步状态失败')
  return row
}

async function resolveLocalTenantMap(
  platformTenantIds: string[],
): Promise<Map<string, { id: string; name: string }>> {
  const unique = [...new Set(platformTenantIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const rows = await db
    .select({
      id: billingTenant.id,
      name: billingTenant.name,
      platformTenantId: billingTenant.platformTenantId,
    })
    .from(billingTenant)
    .where(inArray(billingTenant.platformTenantId, unique))

  const map = new Map<string, { id: string; name: string }>()
  for (const row of rows) {
    if (row.platformTenantId) {
      map.set(row.platformTenantId, { id: row.id, name: row.name })
    }
  }
  return map
}

function mapListRow(
  row: typeof platformTenantBlacklist.$inferSelect,
  local?: { id: string; name: string },
): TenantBlacklistListItem {
  return {
    id: row.id,
    platformBlacklistId: row.platformBlacklistId,
    blacklistType: row.blacklistType,
    platformTenantId: row.platformTenantId,
    status: row.status,
    platformTenantName: row.platformTenantName ?? undefined,
    remark: row.remark ?? undefined,
    merchantId: row.merchantId ?? undefined,
    platformCreatedAt: toIso(row.platformCreatedAt),
    platformUpdatedAt: toIso(row.platformUpdatedAt),
    localTenantId: row.localTenantId ?? undefined,
    localTenantName: local?.name,
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    removedAt: toIso(row.removedAt),
  }
}

async function upsertBlacklistRecord(
  record: PlatformBlacklistRecord,
  localTenantId: string | null,
  syncedAt: Date,
): Promise<boolean> {
  const id = String(record.id)
  const platformCreatedAt = parsePlatformBlacklistTime(record.create_time)
  const platformUpdatedAt = parsePlatformBlacklistTime(record.last_update_time)

  const values = {
    id,
    platformBlacklistId: record.id,
    blacklistType: record.type,
    platformTenantId: record.correlation_id,
    status: record.status,
    platformTenantName: record.tenant_name ?? null,
    remark: record.remark ?? null,
    merchantId: record.merchant_id ?? null,
    platformCreatedAt,
    platformUpdatedAt,
    localTenantId,
    lastSyncedAt: syncedAt,
    removedAt: null,
  }

  await db
    .insert(platformTenantBlacklist)
    .values(values)
    .onConflictDoUpdate({
      target: platformTenantBlacklist.id,
      set: {
        blacklistType: values.blacklistType,
        platformTenantId: values.platformTenantId,
        status: values.status,
        platformTenantName: values.platformTenantName,
        remark: values.remark,
        merchantId: values.merchantId,
        platformCreatedAt: values.platformCreatedAt,
        platformUpdatedAt: values.platformUpdatedAt,
        localTenantId: values.localTenantId,
        lastSyncedAt: values.lastSyncedAt,
        removedAt: null,
        updatedAt: new Date(),
      },
    })

  return true
}

export const tenantBlacklistDataAccess = {
  async getSyncDefaults(): Promise<TenantBlacklistSyncDefaults> {
    const state = await ensureSyncState()
    const lastJob = state.lastJobId
      ? await db.query.tenantBlacklistSyncJobRun.findFirst({
          where: eq(tenantBlacklistSyncJobRun.id, state.lastJobId),
        })
      : null

    const lastSuccess = await db.query.tenantBlacklistSyncJobRun.findFirst({
      where: eq(tenantBlacklistSyncJobRun.status, 'success'),
      orderBy: [desc(tenantBlacklistSyncJobRun.finishedAt)],
    })

    const jobForSummary = lastJob?.status === 'success' ? lastJob : lastSuccess

    return {
      lastPullStartDate: formatDateOnly(state.lastPullEndDate),
      defaultSafetyDays: state.defaultSafetyDays,
      suggestedEndDate: computeSuggestedEndDate(state.defaultSafetyDays),
      lastJobFinishedAt: toIso(jobForSummary?.finishedAt) ?? null,
      lastJobStatus: jobForSummary?.status ?? null,
      lastJobUpsertedCount: jobForSummary?.upsertedCount ?? null,
    }
  },

  async list(input: {
    status?: string
    startTime?: string
    endTime?: string
    platformTenantId?: string
    tenantName?: string
    page: number
    pageSize: number
    includeRemoved?: boolean
  }): Promise<TenantBlacklistListResult> {
    const state = await ensureSyncState()
    const page = Math.max(1, input.page)
    const pageSize = Math.min(50, Math.max(1, input.pageSize))
    const offset = (page - 1) * pageSize

    const conditions = [eq(platformTenantBlacklist.blacklistType, TENANT_BLACKLIST_TYPE)]

    if (!input.includeRemoved) {
      conditions.push(isNull(platformTenantBlacklist.removedAt))
    }

    if (input.status && input.status !== '') {
      conditions.push(eq(platformTenantBlacklist.status, input.status))
    }

    if (input.platformTenantId?.trim()) {
      conditions.push(eq(platformTenantBlacklist.platformTenantId, input.platformTenantId.trim()))
    }

    if (input.tenantName?.trim()) {
      conditions.push(ilike(platformTenantBlacklist.platformTenantName, `%${input.tenantName.trim()}%`))
    }

    if (input.startTime?.trim()) {
      const start = new Date(`${input.startTime.trim()}T00:00:00+08:00`)
      if (!Number.isNaN(start.getTime())) {
        conditions.push(gte(platformTenantBlacklist.platformUpdatedAt, start))
      }
    }

    if (input.endTime?.trim()) {
      const end = new Date(`${input.endTime.trim()}T23:59:59.999+08:00`)
      if (!Number.isNaN(end.getTime())) {
        conditions.push(lte(platformTenantBlacklist.platformUpdatedAt, end))
      }
    }

    const whereClause = and(...conditions)

    const [totalRow] = await db
      .select({ total: count() })
      .from(platformTenantBlacklist)
      .where(whereClause)

    const [activeRow] = await db
      .select({ total: count() })
      .from(platformTenantBlacklist)
      .where(
        and(
          eq(platformTenantBlacklist.blacklistType, TENANT_BLACKLIST_TYPE),
          isNull(platformTenantBlacklist.removedAt),
        ),
      )

    const rows = await db
      .select({
        row: platformTenantBlacklist,
        localName: billingTenant.name,
      })
      .from(platformTenantBlacklist)
      .leftJoin(billingTenant, eq(platformTenantBlacklist.localTenantId, billingTenant.id))
      .where(whereClause)
      .orderBy(desc(platformTenantBlacklist.platformUpdatedAt), desc(platformTenantBlacklist.platformBlacklistId))
      .limit(pageSize)
      .offset(offset)

    return {
      items: rows.map(({ row, localName }) =>
        mapListRow(row, row.localTenantId && localName ? { id: row.localTenantId, name: localName } : undefined),
      ),
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      lastPullEndDate: formatDateOnly(state.lastPullEndDate),
      defaultSafetyDays: state.defaultSafetyDays,
      activeCount: Number(activeRow?.total ?? 0),
    }
  },

  async syncFromPlatform(input: {
    lastPullStartDate?: string
    safetyDays: number
    fullSync?: boolean
  }): Promise<TenantBlacklistSyncResult> {
    const window = computeBlacklistSyncWindow({
      lastPullStartDate: input.lastPullStartDate,
      safetyDays: input.safetyDays,
      fullSync: input.fullSync,
    })

    const jobRunId = newId()
    const startedAt = new Date()

    await db.insert(tenantBlacklistSyncJobRun).values({
      id: jobRunId,
      trigger: 'manual',
      startedAt,
      status: 'running',
      dataStartTime: window.startTime,
      dataEndTime: window.endTime,
      safetyDays: input.safetyDays,
      fullSync: Boolean(input.fullSync),
    })

    crmLog('tenant-blacklist', 'sync start', {
      jobRunId,
      ...window,
      fullSync: input.fullSync,
    })

    try {
      const { records, platformCount } = await fetchAllBlacklistPages({
        startTime: window.startTime,
        endTime: window.endTime,
      })

      const platformTenantIds = records.map((r) => r.correlation_id)
      const localMap = await resolveLocalTenantMap(platformTenantIds)
      const syncedAt = new Date()
      let upsertedCount = 0

      for (const record of records) {
        if (record.type !== TENANT_BLACKLIST_TYPE) continue
        const local = localMap.get(record.correlation_id)
        await upsertBlacklistRecord(record, local?.id ?? null, syncedAt)
        upsertedCount += 1
      }

      const finishedAt = new Date()

      await db
        .update(tenantBlacklistSyncJobRun)
        .set({
          finishedAt,
          status: 'success',
          platformCount,
          fetchedCount: records.length,
          upsertedCount,
        })
        .where(eq(tenantBlacklistSyncJobRun.id, jobRunId))

      await db
        .update(tenantBlacklistSyncState)
        .set({
          lastPullEndDate: window.endDate,
          defaultSafetyDays: input.safetyDays,
          lastJobId: jobRunId,
          updatedAt: new Date(),
        })
        .where(eq(tenantBlacklistSyncState.id, SYNC_STATE_ID))

      crmLog('tenant-blacklist', 'sync success', {
        jobRunId,
        platformCount,
        fetchedCount: records.length,
        upsertedCount,
      })

      return {
        jobRunId,
        fetchedCount: records.length,
        upsertedCount,
        platformCount,
        dataStartTime: window.startTime,
        dataEndTime: window.endTime,
        endDate: window.endDate,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '同步失败'
      crmError('tenant-blacklist', 'sync failed', e, { jobRunId })

      await db
        .update(tenantBlacklistSyncJobRun)
        .set({
          finishedAt: new Date(),
          status: 'failed',
          errorSummary: message.slice(0, 2000),
        })
        .where(eq(tenantBlacklistSyncJobRun.id, jobRunId))

      throw e
    }
  },
}
