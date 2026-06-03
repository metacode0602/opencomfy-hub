import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { runWithProvisioningContext } from '@/lib/auth-provisioning'
import {
  resolveUserRoleFromStaffRoles,
  staffRolesRequireLogin,
} from '@/lib/crm/staff-constants'
import { websiteConfig } from '@/lib/config/website'
import { normalizePhone } from '@/lib/utils/phone'
import { assertPasswordPolicy } from '@workspace/auth'
import { account, user, userStaff } from '@workspace/db/schema'
import { hashPassword } from 'better-auth/crypto'
import { and, eq, ilike, isNotNull, isNull, ne, notInArray, or } from 'drizzle-orm'

export type LinkedAuthUser = {
  id: string
  name: string
  email: string
  phone_number: string | null
  must_change_password: boolean
}

export function getStaffDefaultPassword(): string {
  const password = process.env.STAFF_DEFAULT_PASSWORD?.trim()
  if (!password) {
    throw new Error('未配置 STAFF_DEFAULT_PASSWORD 环境变量')
  }
  assertPasswordPolicy(password)
  return password
}

export function resolveStaffLoginEmail(input: { email?: string | null; mobile: string }): string {
  const email = input.email?.trim().toLowerCase()
  if (email) return email

  const mobile = normalizePhone(input.mobile)
  if (!mobile) {
    throw new Error('创建登录账号需要填写邮箱或手机号')
  }
  return `${mobile}@${websiteConfig.auth.emailSuffix}`
}

async function assertAuthUserLinkable(authUserId: string, staffId?: string) {
  const authUser = await db.query.user.findFirst({
    where: eq(user.id, authUserId),
    columns: { id: true },
  })
  if (!authUser) {
    throw new Error('登录账号不存在')
  }

  const linked = await db.query.userStaff.findFirst({
    where: and(eq(userStaff.authUserId, authUserId), staffId ? ne(userStaff.id, staffId) : undefined),
    columns: { id: true, displayName: true },
  })
  if (linked) {
    throw new Error(`该登录账号已关联员工「${linked.displayName}」`)
  }
}

async function ensureAuthUserDefaultPassword(authUserId: string): Promise<void> {
  const password = getStaffDefaultPassword()
  const hash = await hashPassword(password)
  const cred = await db.query.account.findFirst({
    where: and(eq(account.userId, authUserId), eq(account.providerId, 'credential')),
    columns: { id: true },
  })
  if (cred) {
    await db.update(account).set({ password: hash }).where(eq(account.id, cred.id))
    return
  }
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId: authUserId,
    accountId: authUserId,
    providerId: 'credential',
    password: hash,
  })
}

/** 为已存在的登录账号补全开通状态（provisioned_by、角色、邮箱等） */
export async function applyAuthUserLoginGrant(
  authUserId: string,
  operatorUserId: string,
  patch: {
    displayName: string
    email: string
    mobile: string
    roles: string[]
    resetDefaultPassword?: boolean
  },
): Promise<void> {
  const email = patch.email.trim().toLowerCase()
  const current = await db.query.user.findFirst({
    where: eq(user.id, authUserId),
    columns: {
      id: true,
      provisionedBy: true,
      mustChangePassword: true,
    },
  })
  if (!current) {
    throw new Error('登录账号不存在')
  }

  const conflict = await db.query.user.findFirst({
    where: and(eq(user.email, email), ne(user.id, authUserId)),
    columns: { id: true },
  })
  if (conflict) {
    throw new Error('该邮箱已被其他登录账号使用')
  }

  const newlyProvisioned = !current.provisionedBy
  await db
    .update(user)
    .set({
      name: patch.displayName.trim(),
      email,
      emailVerified: true,
      phoneNumber: patch.mobile.trim(),
      phoneNumberVerified: normalizePhone(patch.mobile).length > 0,
      role: resolveUserRoleFromStaffRoles(patch.roles),
      ...(newlyProvisioned
        ? {
            provisionedBy: operatorUserId,
            provisionedAt: new Date(),
            mustChangePassword: true,
          }
        : {}),
    })
    .where(eq(user.id, authUserId))

  if (patch.resetDefaultPassword || newlyProvisioned) {
    await ensureAuthUserDefaultPassword(authUserId)
  }
}

/**
 * 员工勾选应用角色时：创建/关联登录账号、写入 provisioned_by、同步邮箱与角色。
 */
export async function ensureStaffLoginAccess(
  staffId: string,
  input: {
    displayName: string
    mobile: string
    email?: string | null
    roles?: string[]
  },
  operatorUserId: string,
): Promise<void> {
  if (!staffRolesRequireLogin(input.roles)) return

  const email = input.email?.trim().toLowerCase()
  if (!email) {
    throw new Error('开通登录权限需要填写邮箱')
  }

  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { authUserId: true },
  })
  if (!staff) {
    throw new Error('员工不存在')
  }

  const grant = {
    displayName: input.displayName,
    email,
    mobile: input.mobile,
    roles: input.roles ?? [],
  }

  if (staff.authUserId) {
    await applyAuthUserLoginGrant(staff.authUserId, operatorUserId, grant)
    return
  }

  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: { id: true, provisionedBy: true },
  })

  if (existing) {
    await assertAuthUserLinkable(existing.id, staffId)
    await linkStaffAuthUser(staffId, existing.id)
    const linkedId = (
      await db.query.userStaff.findFirst({
        where: eq(userStaff.id, staffId),
        columns: { authUserId: true },
      })
    )?.authUserId
    await applyAuthUserLoginGrant(linkedId ?? existing.id, operatorUserId, {
      ...grant,
      resetDefaultPassword: !existing.provisionedBy,
    })
    return
  }

  const authUserId = await createAuthUserForStaff(
    {
      displayName: input.displayName,
      email,
      mobile: input.mobile,
      roles: input.roles,
    },
    operatorUserId,
  )
  await linkStaffAuthUser(staffId, authUserId)
}

export async function provisionUserAsAdmin(
  input: {
    email: string
    password: string
    name: string
    mobile?: string
    roles?: string[]
  },
  operatorUserId: string,
): Promise<string> {
  if (!operatorUserId?.trim()) {
    throw new Error('缺少操作员信息，无法开通登录账号')
  }

  const email = input.email.trim().toLowerCase()
  assertPasswordPolicy(input.password, { email, name: input.name })

  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: { id: true },
  })
  if (existing) {
    throw new Error('该登录邮箱已存在')
  }

  await runWithProvisioningContext(
    { operatorUserId, mobile: input.mobile, roles: input.roles },
    async () => {
      await auth.api.signUpEmail({
        body: {
          email,
          password: input.password,
          name: input.name.trim(),
        },
      })
    },
  )

  const created = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: { id: true },
  })
  if (!created) {
    throw new Error('创建登录账号失败')
  }

  const mobile = input.mobile?.trim()
  const roles = input.roles ?? []
  await db
    .update(user)
    .set({
      provisionedBy: operatorUserId,
      provisionedAt: new Date(),
      mustChangePassword: true,
      phoneNumber: mobile || null,
      phoneNumberVerified: mobile ? normalizePhone(mobile).length > 0 : false,
      emailVerified: true,
      role: roles.length > 0 ? resolveUserRoleFromStaffRoles(roles) : 'user',
    })
    .where(eq(user.id, created.id))

  return created.id
}

export async function createAuthUserForStaff(
  input: {
    displayName: string
    email?: string | null
    mobile: string
    roles?: string[]
  },
  operatorUserId: string,
): Promise<string> {
  const email = resolveStaffLoginEmail(input)
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: { id: true },
  })
  if (existing) {
    throw new Error('该登录邮箱已存在，请保存员工记录以自动关联并开通')
  }

  return provisionUserAsAdmin(
    {
      email,
      password: getStaffDefaultPassword(),
      name: input.displayName.trim(),
      mobile: input.mobile,
      roles: input.roles,
    },
    operatorUserId,
  )
}

export async function autoLinkStaffForAuthUser(authUser: {
  id: string
  email?: string | null
  phoneNumber?: string | null
}): Promise<string | null> {
  const linked = await db.query.userStaff.findFirst({
    where: and(eq(userStaff.authUserId, authUser.id), eq(userStaff.status, 'active')),
    columns: { id: true },
  })
  if (linked) return linked.id

  const email = authUser.email?.trim().toLowerCase()
  if (email) {
    const emailMatches = await db
      .select({ id: userStaff.id })
      .from(userStaff)
      .where(
        and(
          eq(userStaff.status, 'active'),
          isNull(userStaff.authUserId),
          eq(userStaff.email, email),
        ),
      )
    if (emailMatches.length === 1) {
      await db
        .update(userStaff)
        .set({ authUserId: authUser.id })
        .where(eq(userStaff.id, emailMatches[0]!.id))
      return emailMatches[0]!.id
    }
  }

  const phone = authUser.phoneNumber ? normalizePhone(authUser.phoneNumber) : ''
  if (phone) {
    const mobileMatches = await db
      .select({ id: userStaff.id, mobile: userStaff.mobile })
      .from(userStaff)
      .where(and(eq(userStaff.status, 'active'), isNull(userStaff.authUserId)))

    const matched = mobileMatches.filter((row) => normalizePhone(row.mobile) === phone)
    if (matched.length === 1) {
      await db
        .update(userStaff)
        .set({ authUserId: authUser.id })
        .where(eq(userStaff.id, matched[0]!.id))
      return matched[0]!.id
    }
  }

  return null
}

export async function linkStaffAuthUser(staffId: string, authUserId: string): Promise<void> {
  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { id: true },
  })
  if (!staff) throw new Error('员工不存在')

  await assertAuthUserLinkable(authUserId, staffId)
  await db.update(userStaff).set({ authUserId }).where(eq(userStaff.id, staffId))
}

export async function unlinkStaffAuthUser(staffId: string): Promise<void> {
  await db.update(userStaff).set({ authUserId: null }).where(eq(userStaff.id, staffId))
}

export async function getLinkedAuthUser(authUserId: string | null): Promise<LinkedAuthUser | null> {
  if (!authUserId) return null
  const row = await db.query.user.findFirst({
    where: eq(user.id, authUserId),
    columns: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      mustChangePassword: true,
    },
  })
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone_number: row.phoneNumber,
    must_change_password: row.mustChangePassword,
  }
}

export async function searchLinkableAuthUsers(query: string, limit = 20): Promise<LinkedAuthUser[]> {
  const q = query.trim()
  if (!q) return []

  const pattern = `%${q}%`
  const linkedRows = await db
    .select({ authUserId: userStaff.authUserId })
    .from(userStaff)
    .where(isNotNull(userStaff.authUserId))
  const linkedIds = linkedRows
    .map((row) => row.authUserId)
    .filter((id): id is string => Boolean(id))

  const conditions = [
    or(ilike(user.email, pattern), ilike(user.name, pattern), ilike(user.phoneNumber, pattern))!,
  ]
  if (linkedIds.length > 0) {
    conditions.push(notInArray(user.id, linkedIds))
  }

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      mustChangePassword: user.mustChangePassword,
    })
    .from(user)
    .where(and(...conditions))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone_number: row.phoneNumber,
    must_change_password: row.mustChangePassword,
  }))
}

export async function clearMustChangePassword(userId: string): Promise<void> {
  await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, userId))
}

export async function syncStaffAuthContact(staffId: string, input: {
  displayName: string
  email?: string | null
  mobile: string
}): Promise<void> {
  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { authUserId: true },
  })
  if (!staff?.authUserId) return

  await db
    .update(user)
    .set({
      name: input.displayName.trim(),
      phoneNumber: input.mobile.trim(),
      phoneNumberVerified: normalizePhone(input.mobile).length > 0,
    })
    .where(eq(user.id, staff.authUserId))

  const email = input.email?.trim().toLowerCase()
  if (email) {
    const conflict = await db.query.user.findFirst({
      where: and(eq(user.email, email), ne(user.id, staff.authUserId)),
      columns: { id: true },
    })
    if (conflict) {
      throw new Error('该邮箱已被其他登录账号使用')
    }
    await db
      .update(user)
      .set({ email, emailVerified: true })
      .where(eq(user.id, staff.authUserId))
  }
}


export async function unlinkStaffBeforeDelete(staffId: string): Promise<void> {
  await unlinkStaffAuthUser(staffId)
}
