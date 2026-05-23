import { db } from '@/lib/db'
import { assertPlatformTenantIdCount } from '@/lib/crm/platform-tenant-import-utils'
import {
  fetchPlatformTenantsByIds,
  parsePlatformOverdueAt,
  parsePlatformRegisteredAt,
  platformCoinToYuan,
  resolveTenantName,
  SuanliOpenApiError,
} from '@/lib/server/integrations/suanli-tenant-api'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import type {
  PlatformImportCommitItem,
  PlatformImportCommitResult,
  PlatformImportImportedTenant,
  PlatformImportPreviewResult,
  PlatformTenantApiRecord,
  PlatformTenantPreviewItem,
} from '@/lib/types/platform-tenant-import'
import { billingTenant, customer } from '@workspace/db/schema'
import { eq, inArray } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function moneyString(yuan: number): string {
  return yuan.toFixed(4)
}

function mapRecordToPreviewPlatform(record: PlatformTenantApiRecord) {
  return {
    tenantName: resolveTenantName(record),
    adminPhone: record.admin_phone ?? undefined,
    coin: platformCoinToYuan(record.coin),
    limitCoin:
      record.limit_coin != null ? platformCoinToYuan(record.limit_coin) : undefined,
    companyName: record.company_name ?? undefined,
    contactUser: record.contact_user ?? undefined,
    contactPhone: record.contact_phone ?? undefined,
    createTime: record.create_time,
    tenantType: record.tenant_type ?? undefined,
  }
}

function mapRecordToTenantFields(record: PlatformTenantApiRecord) {
  return {
    name: resolveTenantName(record),
    phone: record.admin_phone?.trim() || null,
    balance: moneyString(platformCoinToYuan(record.coin)),
    credit_limit:
      record.limit_coin != null
        ? moneyString(platformCoinToYuan(record.limit_coin))
        : null,
    overdue_at: parsePlatformOverdueAt(record.insufficient_balance),
    platformRegisteredAt: parsePlatformRegisteredAt(record.create_time),
  }
}

async function loadLocalTenantsByPlatformIds(platformIds: string[]) {
  if (platformIds.length === 0) {
    return new Map<
      string,
      { tenantId: string; customerId: string; customerName: string }
    >()
  }

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      platformTenantId: billingTenant.platformTenantId,
      customerId: billingTenant.customerId,
      customerName: customer.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.platformTenantId, platformIds))

  const map = new Map<
    string,
    { tenantId: string; customerId: string; customerName: string }
  >()
  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, {
      tenantId: row.tenantId,
      customerId: row.customerId,
      customerName: row.customerName,
    })
  }
  return map
}

export const platformTenantImportDataAccess = {
  async preview(platformTenantIds: string[]): Promise<PlatformImportPreviewResult> {
    assertPlatformTenantIdCount(platformTenantIds)

    const traceId = crypto.randomUUID().slice(0, 8)
    crmLog('platform-import', 'preview start', {
      traceId,
      count: platformTenantIds.length,
    })

    let platformMap: Map<string, PlatformTenantApiRecord>
    try {
      platformMap = await fetchPlatformTenantsByIds(platformTenantIds)
    } catch (e) {
      crmError('platform-import', 'preview api failed', e, { traceId })
      if (e instanceof SuanliOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台租户失败')
    }

    const localMap = await loadLocalTenantsByPlatformIds(platformTenantIds)
    const items: PlatformTenantPreviewItem[] = []
    const missingPlatformIds: string[] = []

    for (const id of platformTenantIds) {
      const api = platformMap.get(id)
      if (!api) {
        missingPlatformIds.push(id)
        items.push({
          platformTenantId: id,
          platform: { tenantName: '—', coin: 0 },
          missingOnPlatform: true,
        })
        continue
      }
      const local = localMap.get(id)
      items.push({
        platformTenantId: id,
        platform: mapRecordToPreviewPlatform(api),
        local,
      })
    }

    crmLog('platform-import', 'preview done', {
      traceId,
      total: items.length,
      missing: missingPlatformIds.length,
      existing: items.filter((i) => i.local).length,
    })

    return { items, missingPlatformIds }
  },

  async commit(
    assignments: PlatformImportCommitItem[],
  ): Promise<PlatformImportCommitResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    const assignmentMap = new Map(
      assignments.map((a) => [a.platformTenantId, a.customer]),
    )

    const updateOnlyIds = assignments
      .filter((a) => !a.customer)
      .map((a) => a.platformTenantId)
    const newTenantIds = assignments
      .filter((a) => a.customer)
      .map((a) => a.platformTenantId)

    const allIds = [...new Set([...updateOnlyIds, ...newTenantIds])]
    if (allIds.length === 0) {
      return {
        createdTenants: 0,
        updatedTenants: 0,
        createdCustomers: 0,
        importedTenants: [],
        errors: [],
      }
    }

    crmLog('platform-import', 'commit start', {
      traceId,
      total: allIds.length,
      newAssignments: newTenantIds.length,
    })

    let platformMap: Map<string, PlatformTenantApiRecord>
    try {
      platformMap = await fetchPlatformTenantsByIds(allIds)
    } catch (e) {
      crmError('platform-import', 'commit api failed', e, { traceId })
      if (e instanceof SuanliOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台租户失败')
    }

    const localMap = await loadLocalTenantsByPlatformIds(allIds)

    let createdTenants = 0
    let updatedTenants = 0
    let createdCustomers = 0
    const errors: PlatformImportCommitResult['errors'] = []
    const importedTenants: PlatformImportImportedTenant[] = []

    for (const platformTenantId of allIds) {
      try {
        const api = platformMap.get(platformTenantId)
        if (!api) {
          errors.push({
            platformTenantId,
            message: '平台未返回该租户，请重新预览',
          })
          continue
        }

        const local = localMap.get(platformTenantId)
        const fields = mapRecordToTenantFields(api)

        if (local) {
          await db
            .update(billingTenant)
            .set({
              name: fields.name,
              phone: fields.phone,
              balance: fields.balance,
              credit_limit: fields.credit_limit,
              overdue_at: fields.overdue_at,
              platformRegisteredAt: fields.platformRegisteredAt,
            })
            .where(eq(billingTenant.id, local.tenantId))
          updatedTenants++
          importedTenants.push({
            platformTenantId,
            tenantId: local.tenantId,
            tenantName: fields.name,
          })
          continue
        }

        const customerAssignment = assignmentMap.get(platformTenantId)
        if (!customerAssignment) {
          errors.push({
            platformTenantId,
            message: '缺少客户关联配置',
          })
          continue
        }

        await db.transaction(async (tx) => {
          let customerId: string

          if (customerAssignment.mode === 'existing') {
            const cust = await tx.query.customer.findFirst({
              where: eq(customer.id, customerAssignment.customerId),
              columns: { id: true },
            })
            if (!cust) {
              throw new Error('所选客户不存在')
            }
            customerId = cust.id
          } else {
            const name = customerAssignment.name.trim()
            if (!name) {
              throw new Error('客户名称不能为空')
            }
            customerId = newId()
            await tx.insert(customer).values({
              id: customerId,
              name,
              accountName: name,
              type: customerAssignment.type,
              status: 'active',
              contactPerson: customerAssignment.contactPerson?.trim() ?? '',
              contactPhone: customerAssignment.contactPhone?.trim() ?? '',
              contactEmail: '',
              industry: '',
              address: '',
            })
            createdCustomers++
          }

          const hasTenants = await tx.query.billingTenant.findFirst({
            where: eq(billingTenant.customerId, customerId),
            columns: { id: true },
          })

          const tenantId = newId()
          await tx.insert(billingTenant).values({
            id: tenantId,
            customerId,
            name: fields.name,
            platformTenantId,
            phone: fields.phone,
            isDefault: !hasTenants,
            status: 'active',
            balance: fields.balance,
            overdue_at: fields.overdue_at,
            credit_limit: fields.credit_limit,
            platformRegisteredAt: fields.platformRegisteredAt,
          })
          createdTenants++
          importedTenants.push({
            platformTenantId,
            tenantId,
            tenantName: fields.name,
          })
        })
      } catch (e) {
        crmWarn('platform-import', 'commit row failed', {
          traceId,
          platformTenantId,
          err: e instanceof Error ? e.message : String(e),
        })
        errors.push({
          platformTenantId,
          message: e instanceof Error ? e.message : '导入失败',
        })
      }
    }

    crmLog('platform-import', 'commit done', {
      traceId,
      createdTenants,
      updatedTenants,
      createdCustomers,
      errors: errors.length,
    })

    return {
      createdTenants,
      updatedTenants,
      createdCustomers,
      importedTenants,
      errors,
    }
  },
}
