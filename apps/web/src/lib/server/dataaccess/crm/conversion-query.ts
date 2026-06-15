import { db } from '@/lib/db'
import {
  assertPlatformTenantIdCount,
  parsePlatformTenantIds,
} from '@/lib/crm/platform-tenant-import-utils'
import { crmError, crmLog } from '@/lib/server/dataaccess/crm/logger'
import type { PlatformTenantApiRecord } from '@/lib/types/platform-tenant-import'
import type {
  ConversionCommitResult,
  ConversionQueryResult,
  ConversionQueryRow,
} from '@/lib/types/conversion-query'
import {
  fetchPlatformTenantsByIds,
  platformCoinToYuan,
  resolveTenantName,
  SuanliOpenApiError,
} from '@/lib/server/integrations/suanli-tenant-api'
import {
  billingTenant,
  conversionRecord,
  crmProject,
  customer,
  recharge,
} from '@workspace/db/schema'
import { and, count, eq, inArray, sum } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

async function loadLocalTenantsByPlatformIds(platformIds: string[]) {
  if (platformIds.length === 0) {
    return new Map<
      string,
      {
        tenantId: string
        customerId: string
        customerName: string
        balance: number
        conversionDate?: string
      }
    >()
  }

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      customerId: billingTenant.customerId,
      customerName: customer.name,
      balance: billingTenant.balance,
      conversionDate: customer.conversionDate,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.platformTenantId, platformIds))

  const map = new Map<
    string,
    {
      tenantId: string
      customerId: string
      customerName: string
      balance: number
      conversionDate?: string
    }
  >()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      customerId: row.customerId,
      customerName: row.customerName,
      balance: toNumber(row.balance),
      conversionDate: row.conversionDate ?? undefined,
    })
  }
  return map
}

async function loadProjectsByTenantIds(tenantIds: string[]) {
  if (tenantIds.length === 0) {
    return new Map<
      string,
      { projectId: string; projectName: string; stage: string; customerId: string }
    >()
  }

  const rows = await db
    .select({
      projectId: crmProject.id,
      projectName: crmProject.name,
      stage: crmProject.stage,
      primaryTenantId: crmProject.primaryTenantId,
      customerId: crmProject.customerId,
    })
    .from(crmProject)
    .where(inArray(crmProject.primaryTenantId, tenantIds))

  const map = new Map<
    string,
    { projectId: string; projectName: string; stage: string; customerId: string }
  >()
  for (const row of rows) {
    if (!row.primaryTenantId || map.has(row.primaryTenantId)) continue
    map.set(row.primaryTenantId, {
      projectId: row.projectId,
      projectName: row.projectName,
      stage: row.stage,
      customerId: row.customerId,
    })
  }
  return map
}

async function loadRechargeStatsByTenantIds(tenantIds: string[]) {
  if (tenantIds.length === 0) {
    return new Map<string, { rechargeCount: number; rechargeTotal: number }>()
  }

  const rows = await db
    .select({
      tenantId: recharge.tenantId,
      rechargeCount: count(),
      rechargeTotal: sum(recharge.amount),
    })
    .from(recharge)
    .where(and(inArray(recharge.tenantId, tenantIds), eq(recharge.status, 'paid')))
    .groupBy(recharge.tenantId)

  const map = new Map<string, { rechargeCount: number; rechargeTotal: number }>()
  for (const row of rows) {
    map.set(row.tenantId, {
      rechargeCount: Number(row.rechargeCount),
      rechargeTotal: toNumber(row.rechargeTotal),
    })
  }
  return map
}

function buildQueryRow(
  platformTenantId: string,
  platform: PlatformTenantApiRecord | undefined,
  local:
    | {
        tenantId: string
        customerId: string
        customerName: string
        balance: number
        conversionDate?: string
      }
    | undefined,
  project:
    | { projectId: string; projectName: string; stage: string; customerId: string }
    | undefined,
  rechargeStats: { rechargeCount: number; rechargeTotal: number } | undefined,
): ConversionQueryRow {
  const errors: string[] = []

  if (!platform) {
    errors.push('平台未找到该租户')
  }

  const tenantName = platform
    ? resolveTenantName(platform)
    : local?.customerName ?? `租户-${platformTenantId}`

  let balance = 0
  let balanceSource: ConversionQueryRow['balanceSource'] = 'none'
  if (local) {
    balance = local.balance
    balanceSource = 'local'
  } else if (platform?.coin != null) {
    balance = platformCoinToYuan(platform.coin)
    balanceSource = 'platform'
  }

  const projectStage = project?.stage as ConversionQueryRow['projectStage']
  const isConverted = projectStage === 'converted'

  if (!local) {
    errors.push('本地未导入该租户')
  }
  if (!project) {
    errors.push('未找到关联项目')
  }

  return {
    platformTenantId,
    tenantName,
    companyName: platform?.company_name?.trim() || undefined,
    contactPhone: platform?.contact_phone?.trim() || platform?.admin_phone?.trim() || undefined,
    localTenantId: local?.tenantId,
    customerId: local?.customerId ?? project?.customerId,
    customerName: local?.customerName,
    projectId: project?.projectId,
    projectName: project?.projectName,
    projectStage,
    isConverted,
    balance,
    balanceSource,
    rechargeCount: rechargeStats?.rechargeCount ?? 0,
    rechargeTotal: rechargeStats?.rechargeTotal ?? 0,
    customerConversionDate: local?.conversionDate,
    errors,
  }
}

export const conversionQueryDataAccess = {
  async query(rawTenantIds: string): Promise<ConversionQueryResult> {
    const platformTenantIds = parsePlatformTenantIds(rawTenantIds)
    assertPlatformTenantIdCount(platformTenantIds)

    const traceId = crypto.randomUUID().slice(0, 8)
    crmLog('conversion-query', 'query start', { traceId, count: platformTenantIds.length })

    let platformMap: Map<string, PlatformTenantApiRecord>
    try {
      platformMap = await fetchPlatformTenantsByIds(platformTenantIds)
    } catch (e) {
      crmError('conversion-query', 'query api failed', e, { traceId })
      if (e instanceof SuanliOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台租户失败')
    }

    const localMap = await loadLocalTenantsByPlatformIds(platformTenantIds)
    const tenantIds = [...localMap.values()].map((l) => l.tenantId)
    const [projectMap, rechargeMap] = await Promise.all([
      loadProjectsByTenantIds(tenantIds),
      loadRechargeStatsByTenantIds(tenantIds),
    ])

    const rows = platformTenantIds.map((id) => {
      const local = localMap.get(id)
      const project = local ? projectMap.get(local.tenantId) : undefined
      const rechargeStats = local ? rechargeMap.get(local.tenantId) : undefined
      return buildQueryRow(id, platformMap.get(id), local, project, rechargeStats)
    })

    const withProject = rows.filter((r) => r.projectId).length
    const converted = rows.filter((r) => r.isConverted).length
    const convertible = rows.filter((r) => r.projectId && !r.isConverted).length

    crmLog('conversion-query', 'query done', {
      traceId,
      total: rows.length,
      withProject,
      converted,
      convertible,
    })

    return {
      rows,
      summary: {
        total: rows.length,
        withProject,
        converted,
        convertible,
      },
    }
  },

  async commit(input: {
    projectIds: string[]
    conversionDate: string
  }): Promise<ConversionCommitResult> {
    const uniqueProjectIds = [...new Set(input.projectIds.filter(Boolean))]
    if (uniqueProjectIds.length === 0) {
      throw new Error('请至少选择一个可转正的项目')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.conversionDate)) {
      throw new Error('转正日期格式无效')
    }

    const traceId = crypto.randomUUID().slice(0, 8)
    crmLog('conversion-query', 'commit start', {
      traceId,
      count: uniqueProjectIds.length,
      conversionDate: input.conversionDate,
    })

    const projects = await db
      .select({
        id: crmProject.id,
        stage: crmProject.stage,
        customerId: crmProject.customerId,
      })
      .from(crmProject)
      .where(inArray(crmProject.id, uniqueProjectIds))

    const projectById = new Map(projects.map((p) => [p.id, p]))
    let converted = 0
    const errors: ConversionCommitResult['errors'] = []
    const now = new Date()

    for (const projectId of uniqueProjectIds) {
      const project = projectById.get(projectId)
      if (!project) {
        errors.push({ projectId, message: '项目不存在' })
        continue
      }
      if (project.stage === 'converted') {
        errors.push({ projectId, message: '项目已转正' })
        continue
      }

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(crmProject)
            .set({ stage: 'converted' })
            .where(eq(crmProject.id, projectId))

          await tx
            .update(customer)
            .set({ conversionDate: input.conversionDate })
            .where(eq(customer.id, project.customerId))

          await tx.insert(conversionRecord).values({
            id: newId(),
            customerId: project.customerId,
            conversionDate: input.conversionDate,
            triggerType: 'manual',
            computedAt: now,
          })
        })
        converted++
      } catch (e) {
        errors.push({
          projectId,
          message: e instanceof Error ? e.message : '转正失败',
        })
      }
    }

    crmLog('conversion-query', 'commit done', { traceId, converted, errors: errors.length })

    return { converted, errors }
  },
}
