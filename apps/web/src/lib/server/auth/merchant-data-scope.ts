import { db } from '@/lib/db'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import type { AppRole } from '@/lib/auth/app-role'
import { normalizeAppRole } from '@/lib/auth/app-role'
import { merchant, merchantAccountManagerAssignment } from '@workspace/db/schema'
import { TRPCError } from '@trpc/server'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

export type MerchantDataScope =
  | { type: 'all' }
  | {
      type: 'am_assigned'
      staffId: string
      cache: MerchantVisibilityCache
    }
  | { type: 'none' }

type MerchantVisibilityCache = {
  visibleMerchantIds?: string[]
}

type AuthUserLike = {
  id: string
  role?: string | null
  email?: string | null
  phoneNumber?: string | null
}

export function scopeAllowsAll(scope: MerchantDataScope): boolean {
  return scope.type === 'all'
}

export async function resolveMerchantDataScope(user: AuthUserLike): Promise<MerchantDataScope> {
  const role = normalizeAppRole(user.role ?? undefined)
  if (!role) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '账号角色无效' })
  }

  if (role === 'admin') {
    return { type: 'all' }
  }

  if (role === 'member') {
    return { type: 'none' }
  }

  const staffId = await staffDataAccess.resolveStaffIdForAuthUser(user)
  if (!staffId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '账号未绑定员工档案，请联系管理员',
    })
  }

  return { type: 'am_assigned', staffId, cache: {} }
}

export async function loadAmMerchantIds(staffId: string): Promise<string[]> {
  const rows = await db
    .select({ merchantId: merchantAccountManagerAssignment.merchantId })
    .from(merchantAccountManagerAssignment)
    .innerJoin(merchant, eq(merchantAccountManagerAssignment.merchantId, merchant.id))
    .where(
      and(
        eq(merchantAccountManagerAssignment.userStaffId, staffId),
        isNull(merchantAccountManagerAssignment.effectiveTo),
        eq(merchant.isDefault, false),
      ),
    )
  return [...new Set(rows.map((r) => r.merchantId))]
}

async function ensureVisibilityCache(scope: MerchantDataScope): Promise<MerchantVisibilityCache | null> {
  if (scope.type === 'all') return null
  if (scope.type === 'none') {
    return { visibleMerchantIds: [] }
  }

  const cache = scope.cache
  if (!cache.visibleMerchantIds) {
    cache.visibleMerchantIds = await loadAmMerchantIds(scope.staffId)
  }
  return cache
}

export async function loadVisibleMerchantIds(scope: MerchantDataScope): Promise<string[] | null> {
  if (scope.type === 'all') return null
  const cache = await ensureVisibilityCache(scope)
  return cache?.visibleMerchantIds ?? []
}

export function buildMerchantTableIdFilter(merchantIds: string[] | null): SQL | undefined {
  if (merchantIds === null) return undefined
  if (merchantIds.length === 0) return inArray(merchant.id, ['__none__'])
  return inArray(merchant.id, merchantIds)
}

async function isMerchantInScope(scope: MerchantDataScope, merchantId: string): Promise<boolean> {
  const ids = await loadVisibleMerchantIds(scope)
  if (ids === null) return true
  return ids.includes(merchantId)
}

export async function assertMerchantInScope(scope: MerchantDataScope, merchantId: string): Promise<void> {
  if (scope.type === 'all') return
  if (!(await isMerchantInScope(scope, merchantId))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '商户不存在' })
  }
}

export async function filterMerchantGetById<T>(
  scope: MerchantDataScope,
  merchantId: string,
  loader: () => Promise<T | null>,
): Promise<T | null> {
  if (scope.type === 'all') return loader()
  if (!(await isMerchantInScope(scope, merchantId))) return null
  return loader()
}
