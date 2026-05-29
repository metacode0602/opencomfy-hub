import {
  currentHourBucket,
  formatDayLabel,
  formatHourLabel,
  formatShanghaiDate,
  monthDateRange,
  previousDayBucket,
  snapshotRowId,
} from '@/lib/crm/balance-snapshot-utils'
import { db } from '@/lib/db'
import type {
  BalanceSnapshotGranularity,
  BalanceSnapshotJobRunDto,
  BalanceSnapshotJobStatus,
  BalanceSnapshotRunResult,
  BalanceSnapshotSource,
  BalanceSnapshotTrigger,
  ProjectBalanceSnapshotSeries,
} from '@/lib/types/balance-snapshot'
import {
  balanceSnapshotJobItem,
  balanceSnapshotJobRun,
  billingTenant,
  crmProject,
  tenantBalanceSnapshot,
} from '@workspace/db/schema'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import {
  fetchPlatformTenantsByIds,
  platformCoinToYuan,
} from '@/lib/server/integrations/suanli-tenant-api'
import { formatSuanliOpenApiError } from '@/lib/server/integrations/suanli-api-errors'
import { getBalanceSnapshotConfig } from './balance-snapshot-config'
import { getBillingSyncProjectStatuses } from './billing-sync-config'
import { crmError, crmLog, crmWarn } from './logger'
import { projectsDataAccess } from './projects'

const BALANCE_SNAPSHOT_LOCK_KEY = 89451236790

function newId(): string {
  return crypto.randomUUID()
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

function toIso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null
}

function mapJobRun(row: typeof balanceSnapshotJobRun.$inferSelect): BalanceSnapshotJobRunDto {
  return {
    id: row.id,
    trigger: row.trigger as BalanceSnapshotJobRunDto['trigger'],
    granularity: row.granularity as BalanceSnapshotJobRunDto['granularity'],
    startedAt: row.startedAt.toISOString(),
    finishedAt: toIso(row.finishedAt),
    status: row.status as BalanceSnapshotJobRunDto['status'],
    tenantCount: row.tenantCount,
    successCount: row.successCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    errorSummary: row.errorSummary,
  }
}

async function tryAcquireLock(): Promise<boolean> {
  const result = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${BALANCE_SNAPSHOT_LOCK_KEY}) AS acquired`,
  )
  return Boolean(result.rows[0]?.acquired)
}

async function releaseLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${BALANCE_SNAPSHOT_LOCK_KEY})`)
}

type SnapshotTarget = {
  id: string
  customerId: string
  platformTenantId: string
  name: string
  balance: string
}

async function listSnapshotTargets(): Promise<SnapshotTarget[]> {
  const statuses = getBillingSyncProjectStatuses()
  const projects = await db
    .select({ id: crmProject.id })
    .from(crmProject)
    .where(inArray(crmProject.status, statuses))

  const tenantIdSet = new Set<string>()
  for (const project of projects) {
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(project.id)
    for (const tenantId of tenantIds) {
      tenantIdSet.add(tenantId)
    }
  }

  if (tenantIdSet.size === 0) return []

  const rows = await db
    .select({
      id: billingTenant.id,
      customerId: billingTenant.customerId,
      platformTenantId: billingTenant.platformTenantId,
      name: billingTenant.name,
      balance: billingTenant.balance,
    })
    .from(billingTenant)
    .where(
      and(
        inArray(billingTenant.id, [...tenantIdSet]),
        sql`${billingTenant.platformTenantId} is not null`,
        sql`${billingTenant.platformTenantId} <> ''`,
      ),
    )

  return rows
    .filter((row) => row.platformTenantId)
    .map((row) => ({
      id: row.id,
      customerId: row.customerId,
      platformTenantId: row.platformTenantId!,
      name: row.name,
      balance: String(row.balance),
    }))
}

async function upsertSnapshotForTenant(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    tenant: SnapshotTarget
    platformCoin: number | null | undefined
    platformLimitCoin: number | null | undefined
    granularity: BalanceSnapshotGranularity
    bucketStart: Date
    bucketDate: string
    capturedAt: Date
    source: BalanceSnapshotSource
    jobRunId?: string
  },
): Promise<'success' | 'skipped'> {
  if (input.platformCoin == null) return 'skipped'

  const balance = platformCoinToYuan(input.platformCoin).toFixed(4)
  const creditLimit =
    input.platformLimitCoin != null
      ? platformCoinToYuan(input.platformLimitCoin).toFixed(4)
      : null
  const rowId = snapshotRowId(
    input.granularity,
    input.tenant.id,
    input.bucketStart,
    input.bucketDate,
  )

  const existing = await tx.query.tenantBalanceSnapshot.findFirst({
    where: and(
      eq(tenantBalanceSnapshot.tenantId, input.tenant.id),
      eq(tenantBalanceSnapshot.granularity, input.granularity),
      eq(tenantBalanceSnapshot.bucketStart, input.bucketStart),
    ),
    columns: { id: true },
  })

  const payload = {
    customerId: input.tenant.customerId,
    tenantId: input.tenant.id,
    granularity: input.granularity,
    bucketStart: input.bucketStart,
    bucketDate: input.bucketDate,
    balance,
    creditLimit,
    source: input.source,
    platformTenantId: input.tenant.platformTenantId,
    platformCoinRaw: input.platformCoin != null ? String(input.platformCoin) : null,
    capturedAt: input.capturedAt,
    jobRunId: input.jobRunId ?? null,
  }

  if (existing) {
    await tx
      .update(tenantBalanceSnapshot)
      .set(payload)
      .where(eq(tenantBalanceSnapshot.id, existing.id))
  } else {
    await tx.insert(tenantBalanceSnapshot).values({ id: rowId, ...payload })
  }

  await tx
    .update(billingTenant)
    .set({
      balance,
      credit_limit: creditLimit,
    })
    .where(eq(billingTenant.id, input.tenant.id))

  return 'success'
}

async function captureBalanceSnapshots(input: {
  granularity: BalanceSnapshotGranularity
  trigger: BalanceSnapshotTrigger
  source?: BalanceSnapshotSource
  bucketStart?: Date
  bucketDate?: string
}): Promise<BalanceSnapshotRunResult> {
  const capturedAt = new Date()
  const bucket =
    input.granularity === 'hour'
      ? input.bucketStart && input.bucketDate
        ? { bucketStart: input.bucketStart, bucketDate: input.bucketDate }
        : currentHourBucket(capturedAt)
      : input.bucketStart && input.bucketDate
        ? { bucketStart: input.bucketStart, bucketDate: input.bucketDate }
        : previousDayBucket(capturedAt)

  const source = input.source ?? (input.trigger === 'manual' ? 'admin_trigger' : 'platform_sync')
  const jobRunId = newId()
  const targets = await listSnapshotTargets()

  await db.insert(balanceSnapshotJobRun).values({
    id: jobRunId,
    trigger: input.trigger,
    granularity: input.granularity,
    startedAt: capturedAt,
    finishedAt: null,
    status: 'running',
    tenantCount: targets.length,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errorSummary: null,
  })

  let successCount = 0
  let failedCount = 0
  let skippedCount = 0
  const errors: string[] = []

  const platformIds = targets.map((t) => t.platformTenantId)
  let platformMap: Awaited<ReturnType<typeof fetchPlatformTenantsByIds>>
  try {
    platformMap = await fetchPlatformTenantsByIds(platformIds)
  } catch (e) {
    const message = formatSuanliOpenApiError(e)
    await db
      .update(balanceSnapshotJobRun)
      .set({
        finishedAt: new Date(),
        status: 'failed',
        failedCount: 0,
        skippedCount: targets.length,
        errorSummary: message,
      })
      .where(eq(balanceSnapshotJobRun.id, jobRunId))
    crmWarn('balance-snapshot', 'platform fetch failed', { jobRunId, err: message })
    return {
      jobRunId,
      status: 'failed',
      tenantCount: targets.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: targets.length,
      errorSummary: message,
    }
  }

  for (const tenant of targets) {
    const platformRecord = platformMap.get(tenant.platformTenantId)
    try {
      const status = await db.transaction(async (tx) => {
        const result = await upsertSnapshotForTenant(tx, {
          tenant,
          platformCoin: platformRecord?.coin,
          platformLimitCoin: platformRecord?.limit_coin ?? null,
          granularity: input.granularity,
          bucketStart: bucket.bucketStart,
          bucketDate: bucket.bucketDate,
          capturedAt,
          source,
          jobRunId,
        })
        return result
      })

      await db.insert(balanceSnapshotJobItem).values({
        id: newId(),
        jobRunId,
        tenantId: tenant.id,
        status,
        granularity: input.granularity,
        bucketStart: bucket.bucketStart,
        error: status === 'skipped' ? '平台未返回 coin' : null,
      })

      if (status === 'success') successCount += 1
      else skippedCount += 1
    } catch (e) {
      failedCount += 1
      const message = e instanceof Error ? e.message : '写入失败'
      errors.push(`${tenant.name}: ${message}`)
      await db.insert(balanceSnapshotJobItem).values({
        id: newId(),
        jobRunId,
        tenantId: tenant.id,
        status: 'failed',
        granularity: input.granularity,
        bucketStart: bucket.bucketStart,
        error: message,
      })
      crmWarn('balance-snapshot', 'tenant capture failed', {
        tenantId: tenant.id,
        err: message,
      })
    }
  }

  const status: BalanceSnapshotJobStatus =
    failedCount > 0 ? (successCount > 0 ? 'partial' : 'failed') : 'success'

  await db
    .update(balanceSnapshotJobRun)
    .set({
      finishedAt: new Date(),
      status,
      successCount,
      failedCount,
      skippedCount,
      errorSummary: errors.length > 0 ? errors.slice(0, 5).join('；') : null,
    })
    .where(eq(balanceSnapshotJobRun.id, jobRunId))

  crmLog('balance-snapshot', 'capture finished', {
    jobRunId,
    granularity: input.granularity,
    status,
    successCount,
    failedCount,
    skippedCount,
  })

  return {
    jobRunId,
    status,
    tenantCount: targets.length,
    successCount,
    failedCount,
    skippedCount,
    errorSummary: errors.length > 0 ? errors.slice(0, 5).join('；') : null,
  }
}

export const balanceSnapshotDataAccess = {
  getConfig: getBalanceSnapshotConfig,

  async listRuns(input?: { limit?: number; offset?: number }): Promise<{
    runs: BalanceSnapshotJobRunDto[]
    total: number
  }> {
    const limit = input?.limit ?? 30
    const offset = input?.offset ?? 0
    const [runs, countRow] = await Promise.all([
      db
        .select()
        .from(balanceSnapshotJobRun)
        .orderBy(desc(balanceSnapshotJobRun.startedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(balanceSnapshotJobRun),
    ])
    return {
      runs: runs.map(mapJobRun),
      total: countRow[0]?.count ?? 0,
    }
  },

  async getRunById(id: string): Promise<BalanceSnapshotJobRunDto | null> {
    const row = await db.query.balanceSnapshotJobRun.findFirst({
      where: eq(balanceSnapshotJobRun.id, id),
    })
    return row ? mapJobRun(row) : null
  },

  async runNow(input?: {
    granularity?: BalanceSnapshotGranularity | 'all'
  }): Promise<BalanceSnapshotRunResult[]> {
    const granularity = input?.granularity ?? 'all'
    const acquired = await tryAcquireLock()
    if (!acquired) {
      throw new Error('余额快照任务正在运行中，请稍后再试')
    }

    try {
      const results: BalanceSnapshotRunResult[] = []
      if (granularity === 'hour' || granularity === 'all') {
        results.push(
          await captureBalanceSnapshots({
            granularity: 'hour',
            trigger: 'manual',
            source: 'admin_trigger',
          }),
        )
      }
      if (granularity === 'day' || granularity === 'all') {
        results.push(
          await captureBalanceSnapshots({
            granularity: 'day',
            trigger: 'manual',
            source: 'admin_trigger',
          }),
        )
      }
      return results
    } finally {
      await releaseLock()
    }
  },

  async runScheduled(granularity: BalanceSnapshotGranularity): Promise<BalanceSnapshotRunResult | null> {
    const acquired = await tryAcquireLock()
    if (!acquired) {
      crmWarn('balance-snapshot', 'scheduled run skipped (lock held)')
      return null
    }

    try {
      return await captureBalanceSnapshots({
        granularity,
        trigger: 'scheduled',
        source: 'platform_sync',
      })
    } catch (e) {
      crmError('balance-snapshot', 'scheduled run failed', e)
      return null
    } finally {
      await releaseLock()
    }
  },

  async writeManualSnapshot(input: {
    tenantId: string
    customerId: string
    platformTenantId?: string | null
    balance: string
    creditLimit?: string | null
    source: BalanceSnapshotSource
  }): Promise<void> {
    const capturedAt = new Date()
    const hourBucket = currentHourBucket(capturedAt)
    const dayBucket = {
      bucketStart: shanghaiDateTimeToUtcFromDate(hourBucket.bucketDate),
      bucketDate: hourBucket.bucketDate,
    }

    const coinRaw = Number(input.balance) * 1_000_000

    await db.transaction(async (tx) => {
      for (const [granularity, bucket] of [
        ['hour', hourBucket],
        ['day', dayBucket],
      ] as const) {
        const rowId = snapshotRowId(
          granularity,
          input.tenantId,
          bucket.bucketStart,
          bucket.bucketDate,
        )
        const existing = await tx.query.tenantBalanceSnapshot.findFirst({
          where: and(
            eq(tenantBalanceSnapshot.tenantId, input.tenantId),
            eq(tenantBalanceSnapshot.granularity, granularity),
            eq(tenantBalanceSnapshot.bucketStart, bucket.bucketStart),
          ),
          columns: { id: true },
        })
        const payload = {
          customerId: input.customerId,
          tenantId: input.tenantId,
          granularity,
          bucketStart: bucket.bucketStart,
          bucketDate: bucket.bucketDate,
          balance: input.balance,
          creditLimit: input.creditLimit ?? null,
          source: input.source,
          platformTenantId: input.platformTenantId ?? null,
          platformCoinRaw: String(coinRaw),
          capturedAt,
          jobRunId: null,
        }
        if (existing) {
          await tx
            .update(tenantBalanceSnapshot)
            .set(payload)
            .where(eq(tenantBalanceSnapshot.id, existing.id))
        } else {
          await tx.insert(tenantBalanceSnapshot).values({ id: rowId, ...payload })
        }
      }
    })
  },

  async listForProject(
    projectId: string,
    input: {
      granularity: BalanceSnapshotGranularity
      usageMonth?: string
      usageDate?: string
    },
  ): Promise<ProjectBalanceSnapshotSeries> {
    const tenantRows = await projectsDataAccess.listBillingTenantsForProject(projectId)
    const tenantIds = tenantRows.map((t) => t.id)

    if (tenantIds.length === 0) {
      return {
        granularity: input.granularity,
        usageMonth: input.usageMonth,
        usageDate: input.usageDate,
        tenants: [],
        points: [],
      }
    }

    const balanceRows = await db
      .select({ id: billingTenant.id, balance: billingTenant.balance })
      .from(billingTenant)
      .where(inArray(billingTenant.id, tenantIds))

    const tenants = tenantRows.map((t) => ({
      id: t.id,
      name: t.name,
      platformTenantId: t.platformTenantId,
      currentBalance: toNumber(balanceRows.find((r) => r.id === t.id)?.balance),
    }))

    const conditions = [
      inArray(tenantBalanceSnapshot.tenantId, tenantIds),
      eq(tenantBalanceSnapshot.granularity, input.granularity),
    ]

    if (input.granularity === 'day') {
      const usageMonth = input.usageMonth ?? formatShanghaiDate(new Date()).slice(0, 7)
      const { from, to } = monthDateRange(usageMonth)
      conditions.push(gte(tenantBalanceSnapshot.bucketDate, from))
      conditions.push(lte(tenantBalanceSnapshot.bucketDate, to))
    } else {
      const usageDate = input.usageDate ?? formatShanghaiDate(new Date())
      conditions.push(eq(tenantBalanceSnapshot.bucketDate, usageDate))
    }

    const snapshots = await db
      .select({
        tenantId: tenantBalanceSnapshot.tenantId,
        bucketStart: tenantBalanceSnapshot.bucketStart,
        bucketDate: tenantBalanceSnapshot.bucketDate,
        balance: tenantBalanceSnapshot.balance,
      })
      .from(tenantBalanceSnapshot)
      .where(and(...conditions))
      .orderBy(asc(tenantBalanceSnapshot.bucketStart))

    const pointMap = new Map<string, ProjectBalanceSnapshotSeries['points'][number]>()

    for (const row of snapshots) {
      const bucketStart = row.bucketStart.toISOString()
      if (!pointMap.has(bucketStart)) {
        pointMap.set(bucketStart, {
          bucketStart,
          label:
            input.granularity === 'hour'
              ? formatHourLabel(bucketStart)
              : formatDayLabel(String(row.bucketDate).slice(0, 10)),
          values: {},
        })
      }
      pointMap.get(bucketStart)!.values[row.tenantId] = toNumber(row.balance)
    }

    return {
      granularity: input.granularity,
      usageMonth:
        input.granularity === 'day'
          ? (input.usageMonth ?? formatShanghaiDate(new Date()).slice(0, 7))
          : undefined,
      usageDate:
        input.granularity === 'hour'
          ? (input.usageDate ?? formatShanghaiDate(new Date()))
          : undefined,
      tenants,
      points: [...pointMap.values()],
    }
  },
}

function shanghaiDateTimeToUtcFromDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+08:00`)
}

export async function runScheduledHourlyBalanceSnapshot(): Promise<void> {
  await balanceSnapshotDataAccess.runScheduled('hour')
}

export async function runScheduledDailyBalanceSnapshot(): Promise<void> {
  await balanceSnapshotDataAccess.runScheduled('day')
}
