import { db } from '@/lib/db'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import type { AppRole } from '@/lib/auth/app-role'
import { normalizeAppRole } from '@/lib/auth/app-role'
import {
  accountManagerAssignment,
  billingTenant,
  crmProject,
  customer,
  projectStaffAssignment,
  projectTenant,
} from '@workspace/db/schema'
import { TRPCError } from '@trpc/server'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

export const PROJECT_STAFF_SCOPE_ROLES = [
  'pre_sales',
  'account_manager',
  'delivery_manager',
  'project_manager',
] as const

export type CrmDataScope =
  | { type: 'all' }
  | {
      type: 'am_assigned'
      staffId: string
      cache: CrmVisibilityCache
    }
  | { type: 'none' }

type CrmVisibilityCache = {
  amCustomerIds?: string[]
  staffProjectIds?: string[]
  visibleProjectIds?: string[]
  visibleCustomerIds?: string[]
  visibleTenantIds?: string[]
}

type AuthUserLike = {
  id: string
  role?: string | null
  email?: string | null
  phoneNumber?: string | null
}

export function scopeAllowsAll(scope: CrmDataScope): boolean {
  return scope.type === 'all'
}

export async function resolveCrmDataScope(user: AuthUserLike): Promise<CrmDataScope> {
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

export async function loadAmCustomerIds(staffId: string): Promise<string[]> {
  const rows = await db
    .select({ customerId: accountManagerAssignment.customerId })
    .from(accountManagerAssignment)
    .where(
      and(
        eq(accountManagerAssignment.userStaffId, staffId),
        isNull(accountManagerAssignment.effectiveTo),
      ),
    )
  return [...new Set(rows.map((r) => r.customerId))]
}

export async function loadStaffProjectIds(staffId: string): Promise<string[]> {
  const rows = await db
    .select({ projectId: projectStaffAssignment.projectId })
    .from(projectStaffAssignment)
    .where(
      and(
        eq(projectStaffAssignment.userStaffId, staffId),
        isNull(projectStaffAssignment.effectiveTo),
        inArray(projectStaffAssignment.roleType, [...PROJECT_STAFF_SCOPE_ROLES]),
      ),
    )
  return [...new Set(rows.map((r) => r.projectId))]
}

async function ensureVisibilityCache(scope: CrmDataScope): Promise<CrmVisibilityCache | null> {
  if (scope.type === 'all') return null
  if (scope.type === 'none') {
    return {
      amCustomerIds: [],
      staffProjectIds: [],
      visibleProjectIds: [],
      visibleCustomerIds: [],
      visibleTenantIds: [],
    }
  }

  const cache = scope.cache
  if (!cache.amCustomerIds) {
    cache.amCustomerIds = await loadAmCustomerIds(scope.staffId)
  }
  if (!cache.staffProjectIds) {
    cache.staffProjectIds = await loadStaffProjectIds(scope.staffId)
  }
  if (!cache.visibleProjectIds) {
    const inherited =
      cache.amCustomerIds.length > 0
        ? await db
            .select({ id: crmProject.id })
            .from(crmProject)
            .where(inArray(crmProject.customerId, cache.amCustomerIds))
        : []
    cache.visibleProjectIds = [
      ...new Set([...inherited.map((r) => r.id), ...cache.staffProjectIds]),
    ]
  }
  if (!cache.visibleCustomerIds) {
    const fromProjects =
      cache.staffProjectIds.length > 0
        ? await db
            .select({ customerId: crmProject.customerId })
            .from(crmProject)
            .where(inArray(crmProject.id, cache.staffProjectIds))
        : []
    cache.visibleCustomerIds = [
      ...new Set([...cache.amCustomerIds, ...fromProjects.map((r) => r.customerId)]),
    ]
  }
  if (!cache.visibleTenantIds) {
    if (cache.visibleProjectIds.length === 0) {
      cache.visibleTenantIds = []
    } else {
      const linkedRows = await db
        .select({ tenantId: projectTenant.tenantId })
        .from(projectTenant)
        .where(inArray(projectTenant.projectId, cache.visibleProjectIds))
      const primaryRows = await db
        .select({ tenantId: crmProject.primaryTenantId })
        .from(crmProject)
        .where(
          and(
            inArray(crmProject.id, cache.visibleProjectIds),
            isNotNull(crmProject.primaryTenantId),
          ),
        )
      cache.visibleTenantIds = [
        ...new Set([
          ...linkedRows.map((r) => r.tenantId),
          ...primaryRows.map((r) => r.tenantId).filter((id): id is string => Boolean(id)),
        ]),
      ]
    }
  }
  return cache
}

export async function loadVisibleProjectIds(scope: CrmDataScope): Promise<string[] | null> {
  if (scope.type === 'all') return null
  const cache = await ensureVisibilityCache(scope)
  return cache?.visibleProjectIds ?? []
}

export async function loadVisibleCustomerIds(scope: CrmDataScope): Promise<string[] | null> {
  if (scope.type === 'all') return null
  const cache = await ensureVisibilityCache(scope)
  return cache?.visibleCustomerIds ?? []
}

export async function loadVisibleTenantIds(scope: CrmDataScope): Promise<string[] | null> {
  if (scope.type === 'all') return null
  const cache = await ensureVisibilityCache(scope)
  return cache?.visibleTenantIds ?? []
}

export function buildCustomerTableIdFilter(customerIds: string[] | null): SQL | undefined {
  if (customerIds === null) return undefined
  if (customerIds.length === 0) return inArray(customer.id, ['__none__'])
  return inArray(customer.id, customerIds)
}

export function buildProjectCustomerIdFilter(customerIds: string[] | null): SQL | undefined {
  if (customerIds === null) return undefined
  if (customerIds.length === 0) return inArray(crmProject.customerId, ['__none__'])
  return inArray(crmProject.customerId, customerIds)
}

export function buildProjectIdFilter(scope: CrmDataScope, projectIds: string[] | null): SQL | undefined {
  if (projectIds === null) return undefined
  if (projectIds.length === 0) return inArray(crmProject.id, ['__none__'])
  return inArray(crmProject.id, projectIds)
}

export function buildTenantIdFilter(scope: CrmDataScope, tenantIds: string[] | null): SQL | undefined {
  if (tenantIds === null) return undefined
  if (tenantIds.length === 0) return inArray(billingTenant.id, ['__none__'])
  return inArray(billingTenant.id, tenantIds)
}

async function isCustomerInScope(scope: CrmDataScope, customerId: string): Promise<boolean> {
  const ids = await loadVisibleCustomerIds(scope)
  if (ids === null) return true
  return ids.includes(customerId)
}

async function isProjectInScope(scope: CrmDataScope, projectId: string): Promise<boolean> {
  const ids = await loadVisibleProjectIds(scope)
  if (ids === null) return true
  return ids.includes(projectId)
}

async function isTenantInScope(scope: CrmDataScope, tenantId: string): Promise<boolean> {
  const ids = await loadVisibleTenantIds(scope)
  if (ids === null) return true
  return ids.includes(tenantId)
}

export async function assertCustomerInScope(scope: CrmDataScope, customerId: string): Promise<void> {
  if (scope.type === 'all') return
  if (!(await isCustomerInScope(scope, customerId))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '客户不存在' })
  }
}

export async function assertProjectInScope(scope: CrmDataScope, projectId: string): Promise<void> {
  if (scope.type === 'all') return
  if (!(await isProjectInScope(scope, projectId))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '项目不存在' })
  }
}

export async function assertTenantInScope(scope: CrmDataScope, tenantId: string): Promise<void> {
  if (scope.type === 'all') return
  if (!(await isTenantInScope(scope, tenantId))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '计费租户不存在' })
  }
}

export async function filterCustomerGetById<T>(
  scope: CrmDataScope,
  customerId: string,
  loader: () => Promise<T | null>,
): Promise<T | null> {
  if (scope.type === 'all') return loader()
  if (!(await isCustomerInScope(scope, customerId))) return null
  return loader()
}

export async function filterProjectGetById<T>(
  scope: CrmDataScope,
  projectId: string,
  loader: () => Promise<T | null>,
): Promise<T | null> {
  if (scope.type === 'all') return loader()
  if (!(await isProjectInScope(scope, projectId))) return null
  return loader()
}

export async function filterTenantGetById<T>(
  scope: CrmDataScope,
  tenantId: string,
  loader: () => Promise<T | null>,
): Promise<T | null> {
  if (scope.type === 'all') return loader()
  if (!(await isTenantInScope(scope, tenantId))) return null
  return loader()
}
