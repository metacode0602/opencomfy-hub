import { db } from '@/lib/db'
import {
  legacyContactToInput,
  mapContactRow,
  newContactId,
  normalizeContactInput,
} from '@/lib/server/dataaccess/shared/entity-contact-shared'
import type { CustomerContact, EntityContactInput } from '@/lib/types/entity-contact'
import { customer, customerContact } from '@workspace/db/schema'
import { and, asc, desc, eq, ne } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function mapRow(
  row: typeof customerContact.$inferSelect,
): CustomerContact {
  return { ...mapContactRow(row), customerId: row.customerId }
}

async function assertCustomerExists(customerId: string) {
  const [row] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1)
  if (!row) throw new Error('客户不存在')
}

async function mirrorPrimaryToCustomer(
  tx: DbTx,
  customerId: string,
) {
  const [primary] = await tx
    .select()
    .from(customerContact)
    .where(and(eq(customerContact.customerId, customerId), eq(customerContact.isPrimary, true)))
    .limit(1)

  await tx
    .update(customer)
    .set({
      contactPerson: primary?.name ?? null,
      contactPhone: primary?.phone ?? null,
      contactEmail: primary?.email ?? null,
    })
    .where(eq(customer.id, customerId))
}

async function clearOtherPrimary(
  tx: DbTx,
  customerId: string,
  exceptId?: string,
) {
  const conditions = [
    eq(customerContact.customerId, customerId),
    eq(customerContact.isPrimary, true),
  ]
  if (exceptId) conditions.push(ne(customerContact.id, exceptId))
  await tx
    .update(customerContact)
    .set({ isPrimary: false })
    .where(and(...conditions))
}

async function countContacts(tx: DbTx, customerId: string) {
  const rows = await tx
    .select({ id: customerContact.id })
    .from(customerContact)
    .where(eq(customerContact.customerId, customerId))
  return rows.length
}

export const customerContactsDataAccess = {
  async list(customerId: string): Promise<CustomerContact[]> {
    await assertCustomerExists(customerId)
    const rows = await db
      .select()
      .from(customerContact)
      .where(eq(customerContact.customerId, customerId))
      .orderBy(desc(customerContact.isPrimary), asc(customerContact.sortOrder), asc(customerContact.createdAt))
    return rows.map(mapRow)
  },

  async create(input: {
    customerId: string
    data: EntityContactInput
  }): Promise<CustomerContact> {
    await assertCustomerExists(input.customerId)
    const fields = normalizeContactInput(input.data)
    const isPrimary = input.data.isPrimary ?? false

    return db.transaction(async (tx) => {
      if (isPrimary) {
        await clearOtherPrimary(tx, input.customerId)
      }

      const [maxSort] = await tx
        .select({ sortOrder: customerContact.sortOrder })
        .from(customerContact)
        .where(eq(customerContact.customerId, input.customerId))
        .orderBy(desc(customerContact.sortOrder))
        .limit(1)

      const now = new Date()
      const [row] = await tx
        .insert(customerContact)
        .values({
          id: newContactId(),
          customerId: input.customerId,
          ...fields,
          isPrimary,
          sortOrder: (maxSort?.sortOrder ?? -1) + 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      if (!row) throw new Error('创建联系人失败')

      if (isPrimary) {
        await mirrorPrimaryToCustomer(tx, input.customerId)
      } else {
        const total = await countContacts(tx, input.customerId)
        if (total === 1) {
          await tx
            .update(customerContact)
            .set({ isPrimary: true })
            .where(eq(customerContact.id, row.id))
          await mirrorPrimaryToCustomer(tx, input.customerId)
          const [updated] = await tx
            .select()
            .from(customerContact)
            .where(eq(customerContact.id, row.id))
            .limit(1)
          if (!updated) throw new Error('创建联系人失败')
          return mapRow(updated)
        }
      }

      return mapRow(row)
    })
  },

  async update(input: {
    id: string
    data: EntityContactInput
  }): Promise<CustomerContact> {
    const fields = normalizeContactInput(input.data)
    const isPrimary = input.data.isPrimary ?? false

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(customerContact)
        .where(eq(customerContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      if (isPrimary) {
        await clearOtherPrimary(tx, existing.customerId, input.id)
      }

      const [row] = await tx
        .update(customerContact)
        .set({
          ...fields,
          isPrimary: isPrimary || existing.isPrimary,
          updatedAt: new Date(),
        })
        .where(eq(customerContact.id, input.id))
        .returning()

      if (!row) throw new Error('更新联系人失败')

      if (row.isPrimary) {
        await mirrorPrimaryToCustomer(tx, existing.customerId)
      }

      return mapRow(row)
    })
  },

  async delete(input: { id: string }): Promise<{ id: string }> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(customerContact)
        .where(eq(customerContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      const total = await countContacts(tx, existing.customerId)
      if (total <= 1) {
        throw new Error('至少保留一条联系人，请先新增其他联系人或编辑现有联系人')
      }
      if (existing.isPrimary) {
        throw new Error('请先指定新的主联系人后再删除')
      }

      await tx.delete(customerContact).where(eq(customerContact.id, input.id))
      return { id: input.id }
    })
  },

  async setPrimary(input: { id: string }): Promise<CustomerContact> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(customerContact)
        .where(eq(customerContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      await clearOtherPrimary(tx, existing.customerId, input.id)
      const [row] = await tx
        .update(customerContact)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(customerContact.id, input.id))
        .returning()

      if (!row) throw new Error('设置主联系人失败')
      await mirrorPrimaryToCustomer(tx, existing.customerId)
      return mapRow(row)
    })
  },

  async syncPrimaryFromLegacyFields(
    tx: DbTx,
    customerId: string,
    legacy: {
      contactPerson?: string
      contactPhone?: string
      contactEmail?: string
    },
  ) {
    const payload = legacyContactToInput(legacy)
    if (!payload) {
      await tx
        .delete(customerContact)
        .where(and(eq(customerContact.customerId, customerId), eq(customerContact.isPrimary, true)))
      await mirrorPrimaryToCustomer(tx, customerId)
      return
    }

    const normalized = normalizeContactInput(payload)
    const [existingPrimary] = await tx
      .select()
      .from(customerContact)
      .where(and(eq(customerContact.customerId, customerId), eq(customerContact.isPrimary, true)))
      .limit(1)

    if (existingPrimary) {
      await tx
        .update(customerContact)
        .set({
          ...normalized,
          isPrimary: true,
          updatedAt: new Date(),
        })
        .where(eq(customerContact.id, existingPrimary.id))
    } else {
      await tx.insert(customerContact).values({
        id: newContactId(),
        customerId,
        ...normalized,
        isPrimary: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    await mirrorPrimaryToCustomer(tx, customerId)
  },
}
