import type { EntityContact, EntityContactInput } from '@/lib/types/entity-contact'

export function newContactId() {
  return crypto.randomUUID()
}

export function normalizeContactInput(input: EntityContactInput) {
  const name = input.name.trim()
  const phone = input.phone?.trim() || null
  const email = input.email?.trim() || null
  const wechatId = input.wechatId?.trim() || null
  const title = input.title?.trim() || null
  const remark = input.remark?.trim() || null
  assertAtLeastOneChannel(phone, email, wechatId)
  return { name, phone, email, wechatId, title, remark }
}

export function assertAtLeastOneChannel(
  phone: string | null,
  email: string | null,
  wechatId: string | null,
) {
  if (!phone && !email && !wechatId) {
    throw new Error('请至少填写手机号、邮箱或微信号中的一项')
  }
}

export function mapContactRow(row: {
  id: string
  name: string
  phone: string | null
  email: string | null
  wechatId: string | null
  title: string | null
  isPrimary: boolean
  sortOrder: number
  remark: string | null
  createdAt: Date
  updatedAt: Date
}): EntityContact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? '',
    wechatId: row.wechatId ?? '',
    title: row.title ?? '',
    isPrimary: row.isPrimary,
    sortOrder: row.sortOrder,
    remark: row.remark ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function hasLegacyContactInput(input: {
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
}) {
  return Boolean(
    input.contactPerson?.trim() ||
      input.contactPhone?.trim() ||
      input.contactEmail?.trim(),
  )
}

export function legacyContactToInput(input: {
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
}): EntityContactInput | null {
  if (!hasLegacyContactInput(input)) return null
  return {
    name: input.contactPerson?.trim() || '—',
    phone: input.contactPhone?.trim() || '',
    email: input.contactEmail?.trim() || '',
    isPrimary: true,
  }
}
