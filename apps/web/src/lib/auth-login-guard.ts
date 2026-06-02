import { db } from '@/lib/db'
import { user } from '@workspace/db/schema'
import { eq, or } from 'drizzle-orm'
import { normalizePhone } from '@/lib/utils/phone'

export type LoginIdentifier =
  | { type: 'email'; email: string }
  | { type: 'phone'; phoneNumber: string }

export async function findUserForLogin(identifier: LoginIdentifier) {
  if (identifier.type === 'email') {
    return db.query.user.findFirst({
      where: eq(user.email, identifier.email.trim().toLowerCase()),
    })
  }

  const normalized = normalizePhone(identifier.phoneNumber)
  if (!normalized) return null

  const row = await db.query.user.findFirst({
    where: or(eq(user.phoneNumber, identifier.phoneNumber), eq(user.phoneNumber, normalized)),
  })
  return row ?? null
}

export function assertUserMayLogin(
  row: {
    provisionedBy: string | null
    banned: boolean | null
    phoneNumberVerified?: boolean
    phoneNumber?: string | null
  } | null | undefined,
  options?: { requireVerifiedPhone?: boolean },
): void {
  if (!row) {
    throw new Error('账号未开通，请联系管理员')
  }
  if (row.banned) {
    throw new Error('账号已禁用，请联系管理员')
  }
  if (!row.provisionedBy) {
    throw new Error('账号未开通，请联系管理员')
  }
  if (options?.requireVerifiedPhone) {
    if (!row.phoneNumber?.trim() || !row.phoneNumberVerified) {
      throw new Error('手机号未绑定或未验证')
    }
  }
}

export async function assertLoginAllowed(
  identifier: LoginIdentifier,
  options?: { requireVerifiedPhone?: boolean },
): Promise<void> {
  const row = await findUserForLogin(identifier)
  if (!row) {
    assertUserMayLogin(null, options)
    return
  }
  assertUserMayLogin(
    {
      provisionedBy: row.provisionedBy ?? null,
      banned: row.banned ?? null,
      phoneNumberVerified: row.phoneNumberVerified,
      phoneNumber: row.phoneNumber,
    },
    options,
  )
}

export async function findProvisionedUserByEmail(email: string) {
  const row = await db.query.user.findFirst({
    where: eq(user.email, email.trim().toLowerCase()),
    columns: {
      id: true,
      email: true,
      provisionedBy: true,
      banned: true,
    },
  })
  if (!row?.provisionedBy || row.banned) return null
  return row
}
