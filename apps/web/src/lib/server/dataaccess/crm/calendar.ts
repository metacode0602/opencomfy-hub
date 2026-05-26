import { db } from '@/lib/db'
import type { AccountActivity, ActivityTypeDefinition } from '@/lib/types/crm'
import { accountActivity, activityTypeDefinition, customer } from '@workspace/db/schema'
import { and, desc, eq, gte, lte } from 'drizzle-orm'

export const calendarDataAccess = {
  async listActivityTypes(): Promise<ActivityTypeDefinition[]> {
    const rows = await db.select().from(activityTypeDefinition)
    return rows.map((r) => ({
      id: r.id,
      type_code: r.typeCode,
      display_name: r.displayName,
      category: r.category,
      is_platform_projection: r.isPlatformProjection,
      sort_order: r.sortOrder,
    }))
  },

  async listActivities(filters?: { from?: string; to?: string }): Promise<
    (AccountActivity & { customerName?: string })[]
  > {
    const conditions = []
    if (filters?.from) {
      conditions.push(gte(accountActivity.occurredAt, new Date(filters.from)))
    }
    if (filters?.to) {
      conditions.push(lte(accountActivity.occurredAt, new Date(filters.to)))
    }

    const rows = await db
      .select({
        activity: accountActivity,
        customerName: customer.name,
      })
      .from(accountActivity)
      .leftJoin(customer, eq(accountActivity.customerId, customer.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(accountActivity.occurredAt))

    return rows.map(({ activity: a, customerName }) => ({
      id: a.id,
      customer_id: a.customerId,
      tenant_id: a.tenantId,
      activity_type_id: a.activityTypeId,
      occurred_at: a.occurredAt.toISOString(),
      ref_domain: a.refDomain,
      ref_id: a.refId,
      idempotency_key: a.idempotencyKey,
      actor_user_id: a.actorUserId,
      title_snapshot: a.titleSnapshot,
      summary_snapshot: a.summarySnapshot,
      payload: a.payload as AccountActivity['payload'],
      visibility: a.visibility,
      customerName: customerName ?? undefined,
    }))
  },
}
