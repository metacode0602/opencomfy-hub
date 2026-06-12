import { db } from '@/lib/db'
import { monthDateRange } from '@/lib/crm/balance-snapshot-utils'
import {
  assertTenantRechargeBalanceQueryIdCount,
  parseTenantRechargeBalanceQueryIds,
} from '@/lib/crm/tenant-recharge-balance-query-utils'
import { crmLog } from '@/lib/server/dataaccess/crm/logger'
import type { ProjectTagOption } from '@/lib/server/dataaccess/crm/project-tags'
import type {
  TenantRechargeBalanceQueryResult,
  TenantRechargeBalanceQueryRow,
} from '@/lib/types/tenant-recharge-balance-query'
import { summarizeTenantRechargeBalanceRows } from '@/lib/types/tenant-recharge-balance-query'
import {
  billingTenant,
  crmProject,
  customer,
  projectTag,
  projectTagAssignment,
  projectTenant,
  recharge,
} from '@workspace/db/schema'
import { and, asc, eq, gte, inArray, isNotNull, lt, min, sum } from 'drizzle-orm'

type LocalTenant = {
  tenantId: string
  tenantName: string
  customerName: string
  balance: number
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function monthUtcRange(usageMonth: string): { start: Date; end: Date } {
  const { from, to } = monthDateRange(usageMonth)
  const [y, m, d] = to.split('-').map(Number)
  const end = new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999))
  return {
    start: new Date(`${from}T00:00:00+08:00`),
    end,
  }
}

async function loadLocalTenantsByPlatformIds(platformIds: string[]) {
  if (platformIds.length === 0) return new Map<string, LocalTenant>()

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      tenantName: billingTenant.name,
      customerName: customer.name,
      balance: billingTenant.balance,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.platformTenantId, platformIds))

  const map = new Map<string, LocalTenant>()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      customerName: row.customerName,
      balance: toNumber(row.balance),
    })
  }
  return map
}

function toIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined
  return d.toISOString()
}

async function loadMonthlyRechargeByTenantIds(tenantIds: string[], usageMonth: string) {
  if (tenantIds.length === 0) return new Map<string, number>()

  const { start, end } = monthUtcRange(usageMonth)
  const rows = await db
    .select({
      tenantId: recharge.tenantId,
      total: sum(recharge.amount),
    })
    .from(recharge)
    .where(
      and(
        inArray(recharge.tenantId, tenantIds),
        isNotNull(recharge.completedAt),
        gte(recharge.completedAt, start),
        lt(recharge.completedAt, new Date(end.getTime() + 1)),
      ),
    )
    .groupBy(recharge.tenantId)

  return new Map(rows.map((row) => [row.tenantId, toNumber(row.total)]))
}

async function loadFirstRechargeAtByTenantIds(tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map<string, string>()

  const rows = await db
    .select({
      tenantId: recharge.tenantId,
      firstRechargeAt: min(recharge.completedAt),
    })
    .from(recharge)
    .where(and(inArray(recharge.tenantId, tenantIds), isNotNull(recharge.completedAt)))
    .groupBy(recharge.tenantId)

  return new Map(
    rows
      .map((row) => [row.tenantId, toIso(row.firstRechargeAt)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  )
}

async function loadProjectTagsByTenantIds(
  tenantIds: string[],
): Promise<Map<string, TenantRechargeBalanceQueryRow['projectTags']>> {
  const result = new Map<string, TenantRechargeBalanceQueryRow['projectTags']>()
  if (tenantIds.length === 0) return result

  const [primaryProjects, linkedProjects] = await Promise.all([
    db
      .select({
        tenantId: crmProject.primaryTenantId,
        projectId: crmProject.id,
      })
      .from(crmProject)
      .where(inArray(crmProject.primaryTenantId, tenantIds)),
    db
      .select({
        tenantId: projectTenant.tenantId,
        projectId: projectTenant.projectId,
      })
      .from(projectTenant)
      .where(inArray(projectTenant.tenantId, tenantIds)),
  ])

  const tenantToProjects = new Map<string, Set<string>>()
  for (const row of [...primaryProjects, ...linkedProjects]) {
    if (!row.tenantId) continue
    const set = tenantToProjects.get(row.tenantId) ?? new Set<string>()
    set.add(row.projectId)
    tenantToProjects.set(row.tenantId, set)
  }

  const allProjectIds = [
    ...new Set([...tenantToProjects.values()].flatMap((projectIds) => [...projectIds])),
  ]

  const projectToTags = new Map<string, ProjectTagOption[]>()
  if (allProjectIds.length > 0) {
    const tagRows = await db
      .select({
        projectId: projectTagAssignment.projectId,
        id: projectTag.id,
        name: projectTag.name,
        sortOrder: projectTag.sortOrder,
      })
      .from(projectTagAssignment)
      .innerJoin(projectTag, eq(projectTagAssignment.tagId, projectTag.id))
      .where(inArray(projectTagAssignment.projectId, allProjectIds))
      .orderBy(asc(projectTag.sortOrder), asc(projectTag.name))

    for (const row of tagRows) {
      const list = projectToTags.get(row.projectId) ?? []
      if (!list.some((tag) => tag.id === row.id)) {
        list.push({ id: row.id, name: row.name })
      }
      projectToTags.set(row.projectId, list)
    }
  }

  for (const tenantId of tenantIds) {
    const projectIds = tenantToProjects.get(tenantId)
    if (!projectIds || projectIds.size === 0) {
      result.set(tenantId, [])
      continue
    }

    const tagById = new Map<string, ProjectTagOption>()
    for (const projectId of projectIds) {
      for (const tag of projectToTags.get(projectId) ?? []) {
        tagById.set(tag.id, tag)
      }
    }

    result.set(
      tenantId,
      [...tagById.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    )
  }

  return result
}

export const tenantRechargeBalanceQueryDataAccess = {
  async query(rawTenantIds: string, usageMonth: string): Promise<TenantRechargeBalanceQueryResult> {
    const platformTenantIds = parseTenantRechargeBalanceQueryIds(rawTenantIds)
    assertTenantRechargeBalanceQueryIdCount(platformTenantIds)

    const traceId = crypto.randomUUID().slice(0, 8)
    crmLog('tenant-recharge-balance-query', 'query start', {
      traceId,
      count: platformTenantIds.length,
      usageMonth,
    })

    const localMap = await loadLocalTenantsByPlatformIds(platformTenantIds)
    const tenantIds = [...localMap.values()].map((local) => local.tenantId)

    const [rechargeMap, firstRechargeMap, tagsMap] = await Promise.all([
      loadMonthlyRechargeByTenantIds(tenantIds, usageMonth),
      loadFirstRechargeAtByTenantIds(tenantIds),
      loadProjectTagsByTenantIds(tenantIds),
    ])

    const rows: TenantRechargeBalanceQueryRow[] = platformTenantIds.map((platformTenantId) => {
      const local = localMap.get(platformTenantId)
      if (!local) {
        return {
          platformTenantId,
          found: false,
          projectTags: [],
          monthlyRechargeTotal: 0,
          currentBalance: 0,
        }
      }

      return {
        platformTenantId,
        found: true,
        tenantName: local.tenantName,
        customerName: local.customerName,
        projectTags: tagsMap.get(local.tenantId) ?? [],
        monthlyRechargeTotal: rechargeMap.get(local.tenantId) ?? 0,
        currentBalance: local.balance,
        firstRechargeAt: firstRechargeMap.get(local.tenantId),
      }
    })

    const summary = summarizeTenantRechargeBalanceRows(rows)

    crmLog('tenant-recharge-balance-query', 'query done', {
      traceId,
      ...summary,
    })

    return {
      usageMonth,
      rows,
      summary,
    }
  },
}
