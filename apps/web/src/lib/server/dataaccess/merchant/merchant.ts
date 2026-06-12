import { db } from '@/lib/db'
import type { MerchantDataScope } from '@/lib/server/auth/merchant-data-scope'
import {
  buildMerchantTableIdFilter,
  filterMerchantGetById,
  loadVisibleMerchantIds,
} from '@/lib/server/auth/merchant-data-scope'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { merchantAccountManagerDataAccess } from '@/lib/server/dataaccess/merchant/merchant-account-manager'
import { merchantConsumptionDataAccess } from '@/lib/server/dataaccess/merchant/merchant-consumption'
import { merchantRegionDataAccess } from '@/lib/server/dataaccess/merchant/merchant-region'
import {
  mapMerchantListRow,
  mapMerchantRow,
} from '@/lib/server/mappers/merchant'
import type { Merchant, MerchantActivity, MerchantListRow } from '@/lib/types/merchant'
import {
  billingTenant,
  customer,
  merchant,
  merchantAccountManagerAssignment,
  merchantActivity,
  tenantMerchant,
  userStaff,
} from '@workspace/db/schema'
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

async function resolveStaff(user: {
  id: string
  email?: string | null
  name?: string | null
}) {
  const staffId = await staffDataAccess.resolveStaffIdForAuthUser(user)
  if (!staffId) throw new Error('当前账号未关联员工信息')
  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { id: true, displayName: true },
  })
  if (!staff) throw new Error('员工信息不存在')
  return { staffId, displayName: staff.displayName }
}

async function appendSystemActivity(input: {
  merchantId: string
  type: MerchantActivity['type']
  title: string
  description?: string
  authorName: string
  refDomain?: string
  refId?: string
}) {
  await db.insert(merchantActivity).values({
    id: newId(),
    merchantId: input.merchantId,
    type: input.type,
    title: input.title,
    description: input.description,
    authorName: input.authorName,
    authorRole: input.authorName === '系统' ? 'system' : 'staff',
    refDomain: input.refDomain,
    refId: input.refId,
    occurredAt: new Date(),
    createdAt: new Date(),
  })
}

export type MerchantUpdateInput = {
  name: string
  companyFullName: string
  unifiedSocialCreditCode: string
  merchantMark?: string
  accessMode: Merchant['accessMode']
  type: Merchant['type']
  status: Merchant['status']
  remark?: string
}

export const merchantDataAccess = {
  async list(
    scope: MerchantDataScope,
    params?: { search?: string; accountManagerStaffId?: string },
  ): Promise<MerchantListRow[]> {
    const visibleMerchantIds = await loadVisibleMerchantIds(scope)
    const q = params?.search?.trim()
    const amStaffId = params?.accountManagerStaffId?.trim()

    let amFilteredMerchantIds: string[] | null = null
    if (amStaffId) {
      const amRows = await db
        .select({ merchantId: merchantAccountManagerAssignment.merchantId })
        .from(merchantAccountManagerAssignment)
        .where(
          and(
            eq(merchantAccountManagerAssignment.userStaffId, amStaffId),
            eq(merchantAccountManagerAssignment.roleType, 'account_manager'),
            isNull(merchantAccountManagerAssignment.effectiveTo),
          ),
        )
      amFilteredMerchantIds = amRows.map((r) => r.merchantId)
    }

    let effectiveIds = visibleMerchantIds
    if (amFilteredMerchantIds !== null) {
      if (effectiveIds === null) {
        effectiveIds = amFilteredMerchantIds
      } else {
        effectiveIds = effectiveIds.filter((id) => amFilteredMerchantIds!.includes(id))
      }
    }

    const rows = await db
      .select()
      .from(merchant)
      .where(
        and(
          buildMerchantTableIdFilter(effectiveIds),
          q
            ? or(
                ilike(merchant.name, `%${q}%`),
                ilike(merchant.code, `%${q}%`),
                ilike(merchant.companyFullName, `%${q}%`),
                ilike(merchant.unifiedSocialCreditCode, `%${q}%`),
                sql`CAST(${merchant.platformMerchantId} AS TEXT) LIKE ${`%${q}%`}`,
              )
            : undefined,
        ),
      )
      .orderBy(desc(merchant.updatedAt))

    const merchantIds = rows.map((r) => r.id)
    const amMap = new Map<string, { staffId: string; staffName: string }>()
    if (merchantIds.length > 0) {
      const amRows = await db
        .select({
          merchantId: merchantAccountManagerAssignment.merchantId,
          staffId: merchantAccountManagerAssignment.userStaffId,
          staffName: userStaff.displayName,
        })
        .from(merchantAccountManagerAssignment)
        .innerJoin(userStaff, eq(merchantAccountManagerAssignment.userStaffId, userStaff.id))
        .where(
          and(
            inArray(merchantAccountManagerAssignment.merchantId, merchantIds),
            eq(merchantAccountManagerAssignment.roleType, 'account_manager'),
            isNull(merchantAccountManagerAssignment.effectiveTo),
          ),
        )
      for (const row of amRows) {
        amMap.set(row.merchantId, { staffId: row.staffId, staffName: row.staffName })
      }
    }

    const result: MerchantListRow[] = []
    for (const row of rows) {
      const [tenantStat] = await db
        .select({ count: count() })
        .from(tenantMerchant)
        .where(
          and(eq(tenantMerchant.merchantId, row.id), isNull(tenantMerchant.effectiveTo)),
        )
      const openRegionCount = await merchantRegionDataAccess.countOpenRegionsByMerchantId(row.id)
      const monthConsumption = await merchantConsumptionDataAccess.getMonthConsumption(row.id)
      const am = amMap.get(row.id)
      result.push(
        mapMerchantListRow(row, {
          tenantCount: tenantStat?.count ?? 0,
          openRegionCount,
          monthConsumption,
          accountManagerStaffId: am?.staffId ?? null,
          accountManagerName: am?.staffName ?? null,
        }),
      )
    }
    return result
  },

  async getById(scope: MerchantDataScope, id: string): Promise<Merchant | null> {
    return filterMerchantGetById(scope, id, async () => {
      const row = await db.query.merchant.findFirst({ where: eq(merchant.id, id) })
      return row ? mapMerchantRow(row) : null
    })
  },

  async getAccountManager(merchantId: string) {
    return merchantAccountManagerDataAccess.getCurrent(merchantId)
  },

  async update(
    id: string,
    input: MerchantUpdateInput,
    user: { id: string; email?: string | null; name?: string | null },
  ): Promise<Merchant> {
    const existing = await db.query.merchant.findFirst({ where: eq(merchant.id, id) })
    if (!existing) throw new Error('商户不存在')

    const author = await resolveStaff(user)
    const now = new Date()

    await db
      .update(merchant)
      .set({
        name: input.name,
        companyFullName: input.companyFullName,
        unifiedSocialCreditCode: input.unifiedSocialCreditCode.toUpperCase(),
        merchantMark: input.merchantMark ?? null,
        accessMode: input.accessMode,
        type: input.type,
        status: input.status,
        remark: input.remark ?? null,
        updatedAt: now,
      })
      .where(eq(merchant.id, id))

    const changed: string[] = []
    if (existing.name !== input.name) changed.push('展示简称')
    if (existing.accessMode !== input.accessMode) changed.push('接入模式')
    if (existing.status !== input.status) changed.push('状态')

    await appendSystemActivity({
      merchantId: id,
      type: 'info_updated',
      title: '更新商户基本信息',
      description: changed.length ? `变更字段：${changed.join('、')}` : '更新商户资料',
      authorName: author.displayName,
    })

    const updated = await db.query.merchant.findFirst({ where: eq(merchant.id, id) })
    if (!updated) throw new Error('更新失败')
    return mapMerchantRow(updated)
  },

  async listTenantsByMerchantId(merchantId: string) {
    const rows = await db
      .select({
        binding: tenantMerchant,
        tenantName: billingTenant.name,
        platformTenantId: billingTenant.platformTenantId,
        customerId: billingTenant.customerId,
        customerName: customer.name,
        tenantStatus: billingTenant.status,
      })
      .from(tenantMerchant)
      .innerJoin(billingTenant, eq(tenantMerchant.tenantId, billingTenant.id))
      .leftJoin(customer, eq(billingTenant.customerId, customer.id))
      .where(
        and(eq(tenantMerchant.merchantId, merchantId), isNull(tenantMerchant.effectiveTo)),
      )

    return rows.map((row) => ({
      id: row.binding.id,
      tenantId: row.binding.tenantId,
      merchantId: row.binding.merchantId,
      isPrimary: row.binding.isPrimary,
      bindingRole: row.binding.bindingRole as 'platform_primary' | 'commercial' | 'historical',
      effectiveFrom: String(row.binding.effectiveFrom),
      effectiveTo: row.binding.effectiveTo ? String(row.binding.effectiveTo) : null,
      remark: row.binding.remark ?? undefined,
      tenantName: row.tenantName ?? row.binding.tenantId,
      platformTenantId: row.platformTenantId ?? '—',
      customerId: row.customerId ?? '—',
      customerName: row.customerName ?? '—',
      tenantStatus: (row.tenantStatus ?? 'active') as 'active' | 'inactive' | 'suspended',
    }))
  },
}
