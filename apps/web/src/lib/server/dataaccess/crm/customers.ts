import { db } from '@/lib/db'
import type { Customer, CustomerExpectedScale } from '@/lib/data/types'
import {
  mapCustomerRow,
} from '@/lib/server/mappers/crm'
import { ensureCrmSeeded } from './ensure-seeded'
import {
  billingTenant,
  consumptionRecord,
  crmProject,
  customer,
  recharge,
  userStaff,
} from '@workspace/db/schema'
function newId() {
  return crypto.randomUUID()
}
import { and, count, eq, ilike, inArray, or, sql, sum } from 'drizzle-orm'

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
  contactPerson: string
  contactPhone: string
  contactEmail: string
  industry: string
  address: string
  certCode?: string
  salesManagerId?: string
  expectedScale?: CustomerExpectedScale | null
}

async function loadCustomerMetrics(customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, { projectCount: number; totalRecharge: number; totalConsumption: number; balance: number }>()

  const tenants = await db
    .select({ id: billingTenant.id, customerId: billingTenant.customerId, balance: billingTenant.balance })
    .from(billingTenant)
    .where(inArray(billingTenant.customerId, customerIds))

  const tenantIds = tenants.map((t) => t.id)
  const tenantByCustomer = new Map<string, string[]>()
  for (const t of tenants) {
    const list = tenantByCustomer.get(t.customerId) ?? []
    list.push(t.id)
    tenantByCustomer.set(t.customerId, list)
  }

  const projectCounts = await db
    .select({ customerId: crmProject.customerId, value: count() })
    .from(crmProject)
    .where(inArray(crmProject.customerId, customerIds))
    .groupBy(crmProject.customerId)

  const rechargeSums =
    tenantIds.length > 0
      ? await db
          .select({ tenantId: recharge.tenantId, value: sum(recharge.amount) })
          .from(recharge)
          .where(and(inArray(recharge.tenantId, tenantIds), eq(recharge.status, 'completed')))
          .groupBy(recharge.tenantId)
      : []

  const consumptionSums =
    tenantIds.length > 0
      ? await db
          .select({ tenantId: consumptionRecord.tenantId, value: sum(consumptionRecord.amount) })
          .from(consumptionRecord)
          .where(inArray(consumptionRecord.tenantId, tenantIds))
          .groupBy(consumptionRecord.tenantId)
      : []

  const projectCountMap = new Map(projectCounts.map((r) => [r.customerId, Number(r.value)]))
  const rechargeMap = new Map(rechargeSums.map((r) => [r.tenantId!, Number(r.value ?? 0)]))
  const consumptionMap = new Map(consumptionSums.map((r) => [r.tenantId!, Number(r.value ?? 0)]))

  const result = new Map<string, { projectCount: number; totalRecharge: number; totalConsumption: number; balance: number }>()
  for (const id of customerIds) {
    const tids = tenantByCustomer.get(id) ?? []
    let balance = 0
    let totalRecharge = 0
    let totalConsumption = 0
    for (const tid of tids) {
      const tenantRow = tenants.find((t) => t.id === tid)
      balance += Number(tenantRow?.balance ?? 0)
      totalRecharge += rechargeMap.get(tid) ?? 0
      totalConsumption += consumptionMap.get(tid) ?? 0
    }
    result.set(id, {
      projectCount: projectCountMap.get(id) ?? 0,
      totalRecharge,
      totalConsumption,
      balance,
    })
  }
  return result
}

async function enrichCustomer(row: typeof customer.$inferSelect, salesManagerName?: string): Promise<Customer> {
  const metrics = await loadCustomerMetrics([row.id])
  const m = metrics.get(row.id)!
  return mapCustomerRow(row, { ...m, salesManagerName })
}

export const customersDataAccess = {
  async list(filters: CustomerListFilters = {}): Promise<Customer[]> {
    await ensureCrmSeeded()

    const conditions = []
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

    const rows = await db
      .select()
      .from(customer)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${customer.createdAt} desc`)

    const ids = rows.map((r) => r.id)
    const metrics = await loadCustomerMetrics(ids)

    const salesIds = [...new Set(rows.map((r) => r.salesManagerId).filter(Boolean))] as string[]
    const salesRows =
      salesIds.length > 0
        ? await db.select().from(userStaff).where(inArray(userStaff.id, salesIds))
        : []
    const salesNameMap = new Map(salesRows.map((s) => [s.id, s.displayName]))

    return rows.map((row) =>
      mapCustomerRow(row, {
        ...(metrics.get(row.id) ?? { projectCount: 0, totalRecharge: 0, totalConsumption: 0, balance: 0 }),
        salesManagerName: row.salesManagerId ? salesNameMap.get(row.salesManagerId) : undefined,
      }),
    )
  },

  async getById(id: string): Promise<Customer | null> {
    await ensureCrmSeeded()
    const row = await db.query.customer.findFirst({ where: eq(customer.id, id) })
    if (!row) return null

    let salesManagerName: string | undefined
    if (row.salesManagerId) {
      const sm = await db.query.userStaff.findFirst({ where: eq(userStaff.id, row.salesManagerId) })
      salesManagerName = sm?.displayName
    }
    return enrichCustomer(row, salesManagerName)
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
        contactPerson: input.contactPerson.trim(),
        contactPhone: input.contactPhone.trim(),
        contactEmail: input.contactEmail.trim(),
        industry: input.industry,
        address: input.address.trim(),
        certCode: input.certCode?.trim() || null,
        salesManagerId: input.salesManagerId || null,
        expectedScale: input.expectedScale ?? null,
        accountName: input.shortName?.trim() || null,
      })
      await tx.insert(billingTenant).values({
        id: tenantId,
        customerId: id,
        name: displayName,
        isDefault: true,
        status: input.status ?? 'active',
        balance: '0',
      })
    })

    const created = await this.getById(id)
    if (!created) throw new Error('创建客户失败')
    return created
  },

  async update(id: string, input: CustomerUpsertInput): Promise<Customer> {
    await db
      .update(customer)
      .set({
        name: input.name.trim(),
        type: input.type,
        status: input.status ?? 'active',
        contactPerson: input.contactPerson.trim(),
        contactPhone: input.contactPhone.trim(),
        contactEmail: input.contactEmail.trim(),
        industry: input.industry,
        address: input.address.trim(),
        certCode: input.certCode?.trim() || null,
        salesManagerId: input.salesManagerId || null,
        expectedScale: input.expectedScale ?? null,
        accountName: input.shortName?.trim() || null,
      })
      .where(eq(customer.id, id))

    const updated = await this.getById(id)
    if (!updated) throw new Error('客户不存在')
    return updated
  },
}
