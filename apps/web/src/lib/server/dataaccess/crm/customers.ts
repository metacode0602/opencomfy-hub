import { db } from '@/lib/db'
import type { Customer, CustomerExpectedScale } from '@/lib/data/types'
import { customerContactsDataAccess } from '@/lib/server/dataaccess/crm/customer-contacts'
import {
  mapCustomerRow,
  toIsoDateTime,
} from '@/lib/server/mappers/crm'
import {
  billingTenant,
  consumptionUsageDaily,
  crmProject,
  customer,
  recharge,
  userStaff,
} from '@workspace/db/schema'
function newId() {
  return crypto.randomUUID()
}
import {
  buildCustomerTableIdFilter,
  filterCustomerGetById,
  loadVisibleCustomerIds,
  type CrmDataScope,
} from '@/lib/server/auth/crm-data-scope'
import { and, count, desc, eq, ilike, or, sum, type SQL } from 'drizzle-orm'

export type CustomerListFilters = {
  search?: string
  type?: 'B' | 'C' | 'all'
  status?: string
}

export type CustomerUpsertInput = {
  name: string
  shortName?: string
  type: 'B' | 'C'
  status?: 'active' | 'inactive' | 'suspended'
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  industry: string
  address: string
  certCode?: string
  salesManagerId?: string
  expectedScale?: CustomerExpectedScale | null
}

const rechargeByTenant = db
  .select({
    tenantId: recharge.tenantId,
    totalRecharge: sum(recharge.amount).as('total_recharge'),
  })
  .from(recharge)
  .where(eq(recharge.status, 'completed'))
  .groupBy(recharge.tenantId)
  .as('recharge_by_tenant')

const consumptionByTenant = db
  .select({
    tenantId: consumptionUsageDaily.tenantId,
    totalConsumption: sum(consumptionUsageDaily.amount).as('total_consumption'),
  })
  .from(consumptionUsageDaily)
  .groupBy(consumptionUsageDaily.tenantId)
  .as('consumption_by_tenant')

const tenantMetricsByCustomer = db
  .select({
    customerId: billingTenant.customerId,
    balance: sum(billingTenant.balance).as('balance'),
    totalRecharge: sum(rechargeByTenant.totalRecharge).as('total_recharge'),
    totalConsumption: sum(consumptionByTenant.totalConsumption).as('total_consumption'),
  })
  .from(billingTenant)
  .leftJoin(rechargeByTenant, eq(billingTenant.id, rechargeByTenant.tenantId))
  .leftJoin(consumptionByTenant, eq(billingTenant.id, consumptionByTenant.tenantId))
  .groupBy(billingTenant.customerId)
  .as('tenant_metrics_by_customer')

const projectCountByCustomer = db
  .select({
    customerId: crmProject.customerId,
    projectCount: count().as('project_count'),
  })
  .from(crmProject)
  .groupBy(crmProject.customerId)
  .as('project_count_by_customer')

const defaultTenantByCustomer = db
  .select({
    customerId: billingTenant.customerId,
    platformRegisteredAt: billingTenant.platformRegisteredAt,
  })
  .from(billingTenant)
  .where(eq(billingTenant.isDefault, true))
  .as('default_tenant_by_customer')

function buildCustomerListConditions(filters: CustomerListFilters = {}) {
  const conditions: SQL[] = []
  if (filters.type && filters.type !== 'all') {
    conditions.push(eq(customer.type, filters.type))
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(customer.status, filters.status))
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`
    conditions.push(
      or(
        ilike(customer.name, q),
        ilike(customer.contactPerson, q),
        ilike(customer.certCode, q),
      )!,
    )
  }
  return conditions
}

function toMetricNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function queryCustomersWithMetrics(
  extraConditions: SQL[] = [],
): Promise<Customer[]> {
  const conditions = extraConditions.length ? and(...extraConditions) : undefined

  const rows = await db
    .select({
      customer: customer,
      salesManagerName: userStaff.displayName,
      projectCount: projectCountByCustomer.projectCount,
      balance: tenantMetricsByCustomer.balance,
      totalRecharge: tenantMetricsByCustomer.totalRecharge,
      totalConsumption: tenantMetricsByCustomer.totalConsumption,
      platformRegisteredAt: defaultTenantByCustomer.platformRegisteredAt,
    })
    .from(customer)
    .leftJoin(userStaff, eq(customer.salesManagerId, userStaff.id))
    .leftJoin(projectCountByCustomer, eq(customer.id, projectCountByCustomer.customerId))
    .leftJoin(tenantMetricsByCustomer, eq(customer.id, tenantMetricsByCustomer.customerId))
    .leftJoin(defaultTenantByCustomer, eq(customer.id, defaultTenantByCustomer.customerId))
    .where(conditions)
    .orderBy(desc(customer.createdAt))

  return rows.map((row) =>
    mapCustomerRow(row.customer, {
      projectCount: toMetricNumber(row.projectCount),
      totalRecharge: toMetricNumber(row.totalRecharge),
      totalConsumption: toMetricNumber(row.totalConsumption),
      balance: toMetricNumber(row.balance),
      salesManagerName: row.salesManagerName ?? undefined,
      platformRegisteredAt: row.platformRegisteredAt
        ? toIsoDateTime(row.platformRegisteredAt)
        : undefined,
    }),
  )
}

export const customersDataAccess = {
  async list(filters: CustomerListFilters = {}, scope?: CrmDataScope): Promise<Customer[]> {
    const conditions = buildCustomerListConditions(filters)
    const visibleCustomerIds = scope ? await loadVisibleCustomerIds(scope) : null
    const scopeFilter = buildCustomerTableIdFilter(visibleCustomerIds)
    if (scopeFilter) conditions.push(scopeFilter)
    if (visibleCustomerIds && visibleCustomerIds.length === 0) return []
    return queryCustomersWithMetrics(conditions)
  },

  async getById(id: string, scope?: CrmDataScope): Promise<Customer | null> {
    return filterCustomerGetById(scope ?? { type: 'all' }, id, async () => {
      const rows = await queryCustomersWithMetrics([eq(customer.id, id)])
      return rows[0] ?? null
    })
  },

  async create(input: CustomerUpsertInput): Promise<Customer> {
    const id = newId()
    const tenantId = newId()
    const displayName = input.shortName?.trim() || input.name.trim()

    await db.transaction(async (tx) => {
      await tx.insert(customer).values({
        id,
        name: input.name.trim(),
        type: input.type,
        status: input.status ?? 'active',
        contactPerson: input.contactPerson?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        industry: input.industry,
        address: input.address.trim(),
        certCode: input.certCode?.trim() || null,
        salesManagerId: input.salesManagerId || null,
        expectedScale: input.expectedScale ?? null,
        shortName: input.shortName?.trim() || null,
      })
      await tx.insert(billingTenant).values({
        id: tenantId,
        customerId: id,
        name: displayName,
        isDefault: true,
        status: input.status ?? 'active',
        balance: '0',
      })
      await customerContactsDataAccess.syncPrimaryFromLegacyFields(tx, id, input)
    })

    const created = await this.getById(id)
    if (!created) throw new Error('创建客户失败')
    return created
  },

  async update(id: string, input: CustomerUpsertInput): Promise<Customer> {
    await db.transaction(async (tx) => {
      await tx
        .update(customer)
        .set({
          name: input.name.trim(),
          type: input.type,
          status: input.status ?? 'active',
          contactPerson: input.contactPerson?.trim() || null,
          contactPhone: input.contactPhone?.trim() || null,
          contactEmail: input.contactEmail?.trim() || null,
          industry: input.industry,
          address: input.address.trim(),
          certCode: input.certCode?.trim() || null,
          salesManagerId: input.salesManagerId || null,
          expectedScale: input.expectedScale ?? null,
          shortName: input.shortName?.trim() || null,
        })
        .where(eq(customer.id, id))
      await customerContactsDataAccess.syncPrimaryFromLegacyFields(tx, id, input)
    })

    const updated = await this.getById(id)
    if (!updated) throw new Error('客户不存在')
    return updated
  },
}
