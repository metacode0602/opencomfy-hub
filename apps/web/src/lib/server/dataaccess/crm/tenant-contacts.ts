import { db } from '@/lib/db'
import {
  mapContactRow,
  newContactId,
  normalizeContactInput,
} from '@/lib/server/dataaccess/shared/entity-contact-shared'
import type { EntityContactInput, TenantContact } from '@/lib/types/entity-contact'
import { billingTenant, tenantContact } from '@workspace/db/schema'
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function mapRow(row: typeof tenantContact.$inferSelect): TenantContact {
  return { ...mapContactRow(row), tenantId: row.tenantId }
}

async function assertTenantExists(tenantId: string) {
  const [row] = await db
    .select({ id: billingTenant.id })
    .from(billingTenant)
    .where(eq(billingTenant.id, tenantId))
    .limit(1)
  if (!row) throw new Error('计费租户不存在')
}

async function clearOtherPrimary(tx: DbTx, tenantId: string, exceptId?: string) {
  const conditions = [eq(tenantContact.tenantId, tenantId), eq(tenantContact.isPrimary, true)]
  if (exceptId) conditions.push(ne(tenantContact.id, exceptId))
  await tx.update(tenantContact).set({ isPrimary: false }).where(and(...conditions))
}

async function countContacts(tx: DbTx, tenantId: string) {
  const rows = await tx
    .select({ id: tenantContact.id })
    .from(tenantContact)
    .where(eq(tenantContact.tenantId, tenantId))
  return rows.length
}

export async function loadPrimaryTenantContactsByTenantIds(
  tenantIds: string[],
): Promise<Map<string, { name: string; phone: string }>> {
  const map = new Map<string, { name: string; phone: string }>()
  if (tenantIds.length === 0) return map

  const rows = await db
    .select({
      tenantId: tenantContact.tenantId,
      name: tenantContact.name,
      phone: tenantContact.phone,
    })
    .from(tenantContact)
    .where(and(inArray(tenantContact.tenantId, tenantIds), eq(tenantContact.isPrimary, true)))

  for (const row of rows) {
    map.set(row.tenantId, { name: row.name, phone: row.phone ?? '' })
  }
  return map
}

export const tenantContactsDataAccess = {
  async list(tenantId: string): Promise<TenantContact[]> {
    await assertTenantExists(tenantId)
    const rows = await db
      .select()
      .from(tenantContact)
      .where(eq(tenantContact.tenantId, tenantId))
      .orderBy(desc(tenantContact.isPrimary), asc(tenantContact.sortOrder), asc(tenantContact.createdAt))
    return rows.map(mapRow)
  },

  async create(input: { tenantId: string; data: EntityContactInput }): Promise<TenantContact> {
    await assertTenantExists(input.tenantId)
    const fields = normalizeContactInput(input.data)
    const isPrimary = input.data.isPrimary ?? false

    return db.transaction(async (tx) => {
      if (isPrimary) await clearOtherPrimary(tx, input.tenantId)

      const [maxSort] = await tx
        .select({ sortOrder: tenantContact.sortOrder })
        .from(tenantContact)
        .where(eq(tenantContact.tenantId, input.tenantId))
        .orderBy(desc(tenantContact.sortOrder))
        .limit(1)

      const now = new Date()
      const [row] = await tx
        .insert(tenantContact)
        .values({
          id: newContactId(),
          tenantId: input.tenantId,
          ...fields,
          isPrimary,
          sortOrder: (maxSort?.sortOrder ?? -1) + 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      if (!row) throw new Error('创建联系人失败')

      if (!isPrimary) {
        const total = await countContacts(tx, input.tenantId)
        if (total === 1) {
          await tx
            .update(tenantContact)
            .set({ isPrimary: true })
            .where(eq(tenantContact.id, row.id))
          const [updated] = await tx
            .select()
            .from(tenantContact)
            .where(eq(tenantContact.id, row.id))
            .limit(1)
          if (!updated) throw new Error('创建联系人失败')
          return mapRow(updated)
        }
      }

      return mapRow(row)
    })
  },

  async update(input: { id: string; data: EntityContactInput }): Promise<TenantContact> {
    const fields = normalizeContactInput(input.data)
    const isPrimary = input.data.isPrimary ?? false

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(tenantContact)
        .where(eq(tenantContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      if (isPrimary) await clearOtherPrimary(tx, existing.tenantId, input.id)

      const [row] = await tx
        .update(tenantContact)
        .set({
          ...fields,
          isPrimary: isPrimary || existing.isPrimary,
          updatedAt: new Date(),
        })
        .where(eq(tenantContact.id, input.id))
        .returning()

      if (!row) throw new Error('更新联系人失败')
      return mapRow(row)
    })
  },

  async delete(input: { id: string }): Promise<{ id: string }> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(tenantContact)
        .where(eq(tenantContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      const total = await countContacts(tx, existing.tenantId)
      if (total <= 1) {
        throw new Error('至少保留一条联系人，请先新增其他联系人或编辑现有联系人')
      }
      if (existing.isPrimary) {
        throw new Error('请先指定新的主联系人后再删除')
      }

      await tx.delete(tenantContact).where(eq(tenantContact.id, input.id))
      return { id: input.id }
    })
  },

  async setPrimary(input: { id: string }): Promise<TenantContact> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(tenantContact)
        .where(eq(tenantContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      await clearOtherPrimary(tx, existing.tenantId, input.id)
      const [row] = await tx
        .update(tenantContact)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(tenantContact.id, input.id))
        .returning()

      if (!row) throw new Error('设置主联系人失败')
      return mapRow(row)
    })
  },
}
