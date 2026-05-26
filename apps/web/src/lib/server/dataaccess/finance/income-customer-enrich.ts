import { db } from '@/lib/db'
import { billingTenant, customer } from '@workspace/db/schema'
import { eq, inArray } from 'drizzle-orm'

/** 经 tenant.customer_id 解析客户全称（展示真值优先于 income 行内缓存） */
export async function customerFullNamesByTenantIds(
  tenantIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(tenantIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const rows = await db
    .select({
      tenantId: billingTenant.id,
      customerName: customer.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(billingTenant.customerId, customer.id))
    .where(inArray(billingTenant.id, unique))

  return new Map(rows.map((r) => [r.tenantId, r.customerName]))
}
