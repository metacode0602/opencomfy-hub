import {
  computeBillingSyncWindow,
  validateBillingDateRange,
} from '@/lib/crm/tenant-billing-import-utils'
import { db } from '@/lib/db'
import type {
  BillingSyncConfigDto,
  BillingSyncJobItemDto,
  BillingSyncJobRunDetailDto,
  BillingSyncJobRunDto,
  BillingSyncJobStatus,
  BillingSyncRunResult,
  BillingSyncTrigger,
} from '@/lib/types/billing-scheduled-sync'
import {
  billingSyncJobItem,
  billingSyncJobRun,
  billingTenant,
  crmProject,
} from '@workspace/db/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  getBillingSyncConfig,
  getBillingSyncInitialStartDate,
  getBillingSyncProjectStatuses,
  getBillingSyncSafetyDays,
} from './billing-sync-config'
import { crmError, crmLog, crmWarn } from './logger'
import { projectsDataAccess } from './projects'
import { tenantBillingImportDataAccess } from './tenant-billing-import'

const BILLING_SYNC_LOCK_KEY = 89451236789

function newId(): string {
  return crypto.randomUUID()
}

function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function toIso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null
}

function mapJobRun(row: typeof billingSyncJobRun.$inferSelect): BillingSyncJobRunDto {
  return {
    id: row.id,
    trigger: row.trigger as BillingSyncTrigger,
    startedAt: row.startedAt.toISOString(),
    finishedAt: toIso(row.finishedAt),
    status: row.status as BillingSyncJobRunDto['status'],
    syncEndDate: formatDateOnly(row.syncEndDate)!,
    safetyDays: row.safetyDays,
    projectCount: row.projectCount,
    tenantCount: row.tenantCount,
    successCount: row.successCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    errorSummary: row.errorSummary,
  }
}

async function tryAcquireLock(): Promise<boolean> {
  const result = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${BILLING_SYNC_LOCK_KEY}) AS acquired`,
  )
  const row = result.rows[0]
  return Boolean(row?.acquired)
}

async function releaseLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${BILLING_SYNC_LOCK_KEY})`)
}

type TenantSyncTarget = {
  tenantId: string
  projectId: string
}

async function collectTenantTargets(projectIds?: string[]): Promise<{
  projectCount: number
  targets: TenantSyncTarget[]
}> {
  const statuses = getBillingSyncProjectStatuses()
  const conditions = [inArray(crmProject.status, statuses)]
  if (projectIds?.length) {
    conditions.push(inArray(crmProject.id, projectIds))
  }

  const projects = await db
    .select({ id: crmProject.id })
    .from(crmProject)
    .where(and(...conditions))

  const tenantById = new Map<string, TenantSyncTarget>()
  for (const project of projects) {
    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(project.id)
    for (const tenantId of tenantIds) {
      if (!tenantById.has(tenantId)) {
        tenantById.set(tenantId, { tenantId, projectId: project.id })
      }
    }
  }

  return {
    projectCount: projects.length,
    targets: [...tenantById.values()],
  }
}

function resolveJobStatus(counts: {
  successCount: number
  failedCount: number
  skippedCount: number
  tenantCount: number
}): BillingSyncJobStatus {
  if (counts.tenantCount === 0) return 'skipped'
  if (counts.failedCount === 0) return 'success'
  if (counts.successCount === 0) return 'failed'
  return 'partial'
}

export async function runScheduledBillingSync(options?: {
  trigger?: BillingSyncTrigger
  projectIds?: string[]
}): Promise<BillingSyncRunResult> {
  const trigger = options?.trigger ?? 'scheduled'
  const acquiredLock = await tryAcquireLock()
  if (!acquiredLock) {
    crmWarn('billing-scheduled-sync', 'skip: advisory lock held')
    return { acquiredLock: false, message: '已有同步任务正在运行' }
  }

  const safetyDays = getBillingSyncSafetyDays()
  const initialStartDate = getBillingSyncInitialStartDate()
  const { endDate: syncEndDate } = computeBillingSyncWindow({
    cursorEndDate: null,
    safetyDays,
    initialStartDate,
  })

  const jobRunId = newId()
  const startedAt = new Date()

  try {
    await db.insert(billingSyncJobRun).values({
      id: jobRunId,
      trigger,
      startedAt,
      status: 'running',
      syncEndDate,
      safetyDays,
    })

    const { projectCount, targets } = await collectTenantTargets(options?.projectIds)
    const tenantIds = targets.map((t) => t.tenantId)

    if (tenantIds.length === 0) {
      const finishedAt = new Date()
      await db
        .update(billingSyncJobRun)
        .set({
          finishedAt,
          status: 'skipped',
          projectCount,
          tenantCount: 0,
          errorSummary: '未找到可同步租户',
        })
        .where(eq(billingSyncJobRun.id, jobRunId))

      crmLog('billing-scheduled-sync', 'completed with no tenants', { jobRunId })
      return { acquiredLock: true, jobRunId, status: 'skipped' }
    }

    const tenantRows = await db
      .select({
        id: billingTenant.id,
        name: billingTenant.name,
        platformTenantId: billingTenant.platformTenantId,
        billingSyncCursorEndDate: billingTenant.billingSyncCursorEndDate,
      })
      .from(billingTenant)
      .where(inArray(billingTenant.id, tenantIds))

    const tenantById = new Map(tenantRows.map((row) => [row.id, row]))
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const target of targets) {
      const tenant = tenantById.get(target.tenantId)
      if (!tenant) continue

      const cursorEndDate = formatDateOnly(tenant.billingSyncCursorEndDate)
      const window = computeBillingSyncWindow({
        cursorEndDate,
        safetyDays,
        initialStartDate,
      })

      const itemStartedAt = new Date()
      await db
        .update(billingTenant)
        .set({ billingSyncLastStartedAt: itemStartedAt })
        .where(eq(billingTenant.id, tenant.id))

      if (!tenant.platformTenantId?.trim()) {
        skippedCount += 1
        const error = '未关联平台租户 ID'
        await db.insert(billingSyncJobItem).values({
          id: newId(),
          jobRunId,
          tenantId: tenant.id,
          projectId: target.projectId,
          startDate: window.startDate,
          endDate: window.endDate,
          status: 'skipped',
          error,
        })
        await db
          .update(billingTenant)
          .set({
            billingSyncLastFinishedAt: new Date(),
            billingSyncLastStatus: 'skipped',
            billingSyncLastError: error,
          })
          .where(eq(billingTenant.id, tenant.id))
        continue
      }

      if (window.skipped) {
        skippedCount += 1
        await db.insert(billingSyncJobItem).values({
          id: newId(),
          jobRunId,
          tenantId: tenant.id,
          projectId: target.projectId,
          startDate: window.startDate,
          endDate: window.endDate,
          status: 'skipped',
          summary: '同步窗口为空',
        })
        await db
          .update(billingTenant)
          .set({
            billingSyncLastFinishedAt: new Date(),
            billingSyncLastStatus: 'skipped',
            billingSyncLastError: null,
          })
          .where(eq(billingTenant.id, tenant.id))
        continue
      }

      validateBillingDateRange(window.startDate, window.endDate)

      const result = await tenantBillingImportDataAccess.directImport({
        tenantId: tenant.id,
        startDate: window.startDate,
        endDate: window.endDate,
      })

      const finishedAt = new Date()

      if (result.success) {
        successCount += 1
        await db.insert(billingSyncJobItem).values({
          id: newId(),
          jobRunId,
          tenantId: tenant.id,
          projectId: target.projectId,
          startDate: window.startDate,
          endDate: window.endDate,
          status: 'success',
          summary: result.summary,
        })
        await db
          .update(billingTenant)
          .set({
            billingSyncCursorEndDate: window.endDate,
            billingSyncLastFinishedAt: finishedAt,
            billingSyncLastStatus: 'success',
            billingSyncLastError: null,
          })
          .where(eq(billingTenant.id, tenant.id))
      } else {
        failedCount += 1
        const error = result.error ?? '账单导入失败'
        errors.push(`${tenant.name}: ${error}`)
        await db.insert(billingSyncJobItem).values({
          id: newId(),
          jobRunId,
          tenantId: tenant.id,
          projectId: target.projectId,
          startDate: window.startDate,
          endDate: window.endDate,
          status: 'failed',
          summary: result.summary,
          error,
        })
        await db
          .update(billingTenant)
          .set({
            billingSyncLastFinishedAt: finishedAt,
            billingSyncLastStatus: 'failed',
            billingSyncLastError: error,
          })
          .where(eq(billingTenant.id, tenant.id))
      }
    }

    const status = resolveJobStatus({
      successCount,
      failedCount,
      skippedCount,
      tenantCount: targets.length,
    })
    const finishedAt = new Date()
    const errorSummary = errors.length > 0 ? errors.slice(0, 20).join('；') : null

    await db
      .update(billingSyncJobRun)
      .set({
        finishedAt,
        status,
        projectCount,
        tenantCount: targets.length,
        successCount,
        failedCount,
        skippedCount,
        errorSummary,
      })
      .where(eq(billingSyncJobRun.id, jobRunId))

    crmLog('billing-scheduled-sync', 'completed', {
      jobRunId,
      status,
      successCount,
      failedCount,
      skippedCount,
    })

    return { acquiredLock: true, jobRunId, status }
  } catch (error) {
    crmError('billing-scheduled-sync', 'job failed', error, { jobRunId })
    const message = error instanceof Error ? error.message : '同步任务失败'
    await db
      .update(billingSyncJobRun)
      .set({
        finishedAt: new Date(),
        status: 'failed',
        errorSummary: message,
      })
      .where(eq(billingSyncJobRun.id, jobRunId))
    return { acquiredLock: true, jobRunId, status: 'failed', message }
  } finally {
    await releaseLock()
  }
}

export const billingScheduledSyncDataAccess = {
  getConfig(): BillingSyncConfigDto {
    return getBillingSyncConfig()
  },

  runNow(input?: { projectIds?: string[] }): Promise<BillingSyncRunResult> {
    return runScheduledBillingSync({ trigger: 'manual', projectIds: input?.projectIds })
  },

  async listRuns(input?: { limit?: number; offset?: number }): Promise<{
    runs: BillingSyncJobRunDto[]
    total: number
  }> {
    const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100)
    const offset = Math.max(input?.offset ?? 0, 0)

    const runs = await db
      .select()
      .from(billingSyncJobRun)
      .orderBy(desc(billingSyncJobRun.startedAt))
      .limit(limit)
      .offset(offset)

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(billingSyncJobRun)

    return {
      runs: runs.map(mapJobRun),
      total: countRows[0]?.count ?? 0,
    }
  },

  async getRunById(id: string): Promise<BillingSyncJobRunDetailDto | null> {
    const run = await db.query.billingSyncJobRun.findFirst({
      where: eq(billingSyncJobRun.id, id),
    })
    if (!run) return null

    const items = await db
      .select({
        id: billingSyncJobItem.id,
        jobRunId: billingSyncJobItem.jobRunId,
        tenantId: billingSyncJobItem.tenantId,
        tenantName: billingTenant.name,
        platformTenantId: billingTenant.platformTenantId,
        projectId: billingSyncJobItem.projectId,
        projectName: crmProject.name,
        startDate: billingSyncJobItem.startDate,
        endDate: billingSyncJobItem.endDate,
        status: billingSyncJobItem.status,
        summary: billingSyncJobItem.summary,
        error: billingSyncJobItem.error,
      })
      .from(billingSyncJobItem)
      .innerJoin(billingTenant, eq(billingSyncJobItem.tenantId, billingTenant.id))
      .leftJoin(crmProject, eq(billingSyncJobItem.projectId, crmProject.id))
      .where(eq(billingSyncJobItem.jobRunId, id))
      .orderBy(billingSyncJobItem.startDate)

    const mappedItems: BillingSyncJobItemDto[] = items.map((item) => ({
      id: item.id,
      jobRunId: item.jobRunId,
      tenantId: item.tenantId,
      tenantName: item.tenantName,
      platformTenantId: item.platformTenantId,
      projectId: item.projectId,
      projectName: item.projectName,
      startDate: formatDateOnly(item.startDate)!,
      endDate: formatDateOnly(item.endDate)!,
      status: item.status as BillingSyncJobItemDto['status'],
      summary: item.summary,
      error: item.error,
    }))

    return {
      ...mapJobRun(run),
      items: mappedItems,
    }
  },
}
