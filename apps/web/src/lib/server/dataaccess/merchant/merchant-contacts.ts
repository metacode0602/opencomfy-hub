import { db } from '@/lib/db'
import {
  mapContactRow,
  newContactId,
  normalizeContactInput,
} from '@/lib/server/dataaccess/shared/entity-contact-shared'
import type { EntityContactInput, MerchantContact } from '@/lib/types/entity-contact'
import { merchant, merchantContact } from '@workspace/db/schema'
import { and, asc, desc, eq, ne } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function mapRow(row: typeof merchantContact.$inferSelect): MerchantContact {
  return { ...mapContactRow(row), merchantId: row.merchantId }
}

async function assertMerchantExists(merchantId: string) {
  const [row] = await db
    .select({ id: merchant.id })
    .from(merchant)
    .where(eq(merchant.id, merchantId))
    .limit(1)
  if (!row) throw new Error('商户不存在')
}

async function mirrorPrimaryToMerchant(tx: DbTx, merchantId: string) {
  const [primary] = await tx
    .select()
    .from(merchantContact)
    .where(and(eq(merchantContact.merchantId, merchantId), eq(merchantContact.isPrimary, true)))
    .limit(1)

  await tx
    .update(merchant)
    .set({
      contactUser: primary?.name ?? null,
      contactPhone: primary?.phone ?? null,
    })
    .where(eq(merchant.id, merchantId))
}

async function clearOtherPrimary(tx: DbTx, merchantId: string, exceptId?: string) {
  const conditions = [
    eq(merchantContact.merchantId, merchantId),
    eq(merchantContact.isPrimary, true),
  ]
  if (exceptId) conditions.push(ne(merchantContact.id, exceptId))
  await tx.update(merchantContact).set({ isPrimary: false }).where(and(...conditions))
}

async function countContacts(tx: DbTx, merchantId: string) {
  const rows = await tx
    .select({ id: merchantContact.id })
    .from(merchantContact)
    .where(eq(merchantContact.merchantId, merchantId))
  return rows.length
}

export const merchantContactsDataAccess = {
  async list(merchantId: string): Promise<MerchantContact[]> {
    await assertMerchantExists(merchantId)
    const rows = await db
      .select()
      .from(merchantContact)
      .where(eq(merchantContact.merchantId, merchantId))
      .orderBy(desc(merchantContact.isPrimary), asc(merchantContact.sortOrder), asc(merchantContact.createdAt))
    return rows.map(mapRow)
  },

  async create(input: {
    merchantId: string
    data: EntityContactInput
  }): Promise<MerchantContact> {
    await assertMerchantExists(input.merchantId)
    const fields = normalizeContactInput(input.data)
    const isPrimary = input.data.isPrimary ?? false

    return db.transaction(async (tx) => {
      if (isPrimary) await clearOtherPrimary(tx, input.merchantId)

      const [maxSort] = await tx
        .select({ sortOrder: merchantContact.sortOrder })
        .from(merchantContact)
        .where(eq(merchantContact.merchantId, input.merchantId))
        .orderBy(desc(merchantContact.sortOrder))
        .limit(1)

      const now = new Date()
      const [row] = await tx
        .insert(merchantContact)
        .values({
          id: newContactId(),
          merchantId: input.merchantId,
          ...fields,
          isPrimary,
          sortOrder: (maxSort?.sortOrder ?? -1) + 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      if (!row) throw new Error('创建联系人失败')

      if (isPrimary || (await countContacts(tx, input.merchantId)) === 1) {
        if (!row.isPrimary) {
          await tx
            .update(merchantContact)
            .set({ isPrimary: true })
            .where(eq(merchantContact.id, row.id))
        }
        await mirrorPrimaryToMerchant(tx, input.merchantId)
        const [updated] = await tx
          .select()
          .from(merchantContact)
          .where(eq(merchantContact.id, row.id))
          .limit(1)
        if (!updated) throw new Error('创建联系人失败')
        return mapRow(updated)
      }

      return mapRow(row)
    })
  },

  async update(input: { id: string; data: EntityContactInput }): Promise<MerchantContact> {
    const fields = normalizeContactInput(input.data)
    const isPrimary = input.data.isPrimary ?? false

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(merchantContact)
        .where(eq(merchantContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      if (isPrimary) await clearOtherPrimary(tx, existing.merchantId, input.id)

      const [row] = await tx
        .update(merchantContact)
        .set({
          ...fields,
          isPrimary: isPrimary || existing.isPrimary,
          updatedAt: new Date(),
        })
        .where(eq(merchantContact.id, input.id))
        .returning()

      if (!row) throw new Error('更新联系人失败')
      if (row.isPrimary) await mirrorPrimaryToMerchant(tx, existing.merchantId)
      return mapRow(row)
    })
  },

  async delete(input: { id: string }): Promise<{ id: string }> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(merchantContact)
        .where(eq(merchantContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      const total = await countContacts(tx, existing.merchantId)
      if (total <= 1) {
        throw new Error('至少保留一条联系人，请先新增其他联系人或编辑现有联系人')
      }
      if (existing.isPrimary) {
        throw new Error('请先指定新的主联系人后再删除')
      }

      await tx.delete(merchantContact).where(eq(merchantContact.id, input.id))
      return { id: input.id }
    })
  },

  async setPrimary(input: { id: string }): Promise<MerchantContact> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(merchantContact)
        .where(eq(merchantContact.id, input.id))
        .limit(1)
      if (!existing) throw new Error('联系人不存在')

      await clearOtherPrimary(tx, existing.merchantId, input.id)
      const [row] = await tx
        .update(merchantContact)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(merchantContact.id, input.id))
        .returning()

      if (!row) throw new Error('设置主联系人失败')
      await mirrorPrimaryToMerchant(tx, existing.merchantId)
      return mapRow(row)
    })
  },

  async upsertPrimaryFromPlatform(
    tx: DbTx,
    merchantId: string,
    name: string | null,
    phone: string | null,
  ) {
    const trimmedName = name?.trim() || null
    const trimmedPhone = phone?.trim() || null
    if (!trimmedName && !trimmedPhone) return

    const contactName = trimmedName || '—'
    const [existingPrimary] = await tx
      .select()
      .from(merchantContact)
      .where(and(eq(merchantContact.merchantId, merchantId), eq(merchantContact.isPrimary, true)))
      .limit(1)

    if (existingPrimary) {
      await tx
        .update(merchantContact)
        .set({
          name: contactName,
          phone: trimmedPhone,
          updatedAt: new Date(),
        })
        .where(eq(merchantContact.id, existingPrimary.id))
    } else {
      await tx.insert(merchantContact).values({
        id: newContactId(),
        merchantId,
        name: contactName,
        phone: trimmedPhone,
        email: null,
        wechatId: null,
        title: null,
        remark: null,
        isPrimary: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    await tx
      .update(merchant)
      .set({
        contactUser: contactName,
        contactPhone: trimmedPhone,
      })
      .where(eq(merchant.id, merchantId))
  },
}
