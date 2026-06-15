import { db } from '@/lib/db'
import {
  PROJECT_STAFF_SCOPE_ROLES,
  type CrmDataScope,
} from '@/lib/server/auth/crm-data-scope'
import {
  accountManagerAssignment,
  billingTenant,
  consumptionUsageDaily,
  crmProject,
  customer,
  projectStaffAssignment,
  projectTenant,
  recharge,
  tenantBill,
} from '@workspace/db/schema'
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'

const STAFF_ROLES_SQL = sql.raw(
  `(${PROJECT_STAFF_SCOPE_ROLES.map((r) => `'${r}'`).join(', ')})`,
)

/** 当前 staff 可见项目（客户级 AM 继承 + 项目四人组） */
export function buildVisibleProjectSubquery(staffId: string) {
  return db
    .selectDistinct({
      projectId: crmProject.id,
      customerId: crmProject.customerId,
      primaryTenantId: crmProject.primaryTenantId,
    })
    .from(crmProject)
    .leftJoin(
      accountManagerAssignment,
      and(
        eq(accountManagerAssignment.customerId, crmProject.customerId),
        eq(accountManagerAssignment.userStaffId, staffId),
        isNull(accountManagerAssignment.effectiveTo),
      ),
    )
    .leftJoin(
      projectStaffAssignment,
      and(
        eq(projectStaffAssignment.projectId, crmProject.id),
        eq(projectStaffAssignment.userStaffId, staffId),
        isNull(projectStaffAssignment.effectiveTo),
        inArray(projectStaffAssignment.roleType, [...PROJECT_STAFF_SCOPE_ROLES]),
      ),
    )
    .where(
      or(
        isNotNull(accountManagerAssignment.customerId),
        isNotNull(projectStaffAssignment.projectId),
      ),
    )
    .as('visible_project')
}

/** scoped_tenant：可见项目关联 tenant + primary_tenant_id */
export function buildScopedTenantSubquery(staffId: string) {
  const vp = buildVisibleProjectSubquery(staffId)
  const linkedTenants = db
    .selectDistinct({ tenantId: projectTenant.tenantId })
    .from(projectTenant)
    .innerJoin(vp, eq(projectTenant.projectId, vp.projectId))

  const primaryTenants = db
    .selectDistinct({ tenantId: sql<string>`${crmProject.primaryTenantId}` })
    .from(crmProject)
    .innerJoin(vp, eq(crmProject.id, vp.projectId))
    .where(isNotNull(crmProject.primaryTenantId))

  return linkedTenants.union(primaryTenants).as('scoped_tenant')
}

export function customerVisibleSql(staffId: string): SQL {
  return sql`(
    EXISTS (
      SELECT 1 FROM ${accountManagerAssignment} ama
      WHERE ama.customer_id = ${customer.id}
        AND ama.user_staff_id = ${staffId}
        AND ama.effective_to IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM ${crmProject} p
      INNER JOIN ${projectStaffAssignment} psa
        ON psa.project_id = p.id
       AND psa.user_staff_id = ${staffId}
       AND psa.effective_to IS NULL
       AND psa.role_type IN ${STAFF_ROLES_SQL}
      WHERE p.customer_id = ${customer.id}
    )
  )`
}

export function projectVisibleSql(staffId: string): SQL {
  return sql`${crmProject.id} IN (
    SELECT vp.project_id FROM (
      SELECT DISTINCT p.id AS project_id
      FROM ${crmProject} p
      LEFT JOIN ${accountManagerAssignment} ama
        ON ama.customer_id = p.customer_id
       AND ama.user_staff_id = ${staffId}
       AND ama.effective_to IS NULL
      LEFT JOIN ${projectStaffAssignment} psa
        ON psa.project_id = p.id
       AND psa.user_staff_id = ${staffId}
       AND psa.effective_to IS NULL
       AND psa.role_type IN ${STAFF_ROLES_SQL}
      WHERE ama.customer_id IS NOT NULL OR psa.project_id IS NOT NULL
    ) vp
  )`
}

export function tenantBillProjectVisibleSql(staffId: string): SQL {
  return sql`${tenantBill.projectId} IN (
    SELECT vp.project_id FROM (
      SELECT DISTINCT p.id AS project_id
      FROM ${crmProject} p
      LEFT JOIN ${accountManagerAssignment} ama
        ON ama.customer_id = p.customer_id
       AND ama.user_staff_id = ${staffId}
       AND ama.effective_to IS NULL
      LEFT JOIN ${projectStaffAssignment} psa
        ON psa.project_id = p.id
       AND psa.user_staff_id = ${staffId}
       AND psa.effective_to IS NULL
       AND psa.role_type IN ${STAFF_ROLES_SQL}
      WHERE ama.customer_id IS NOT NULL OR psa.project_id IS NOT NULL
    ) vp
  )`
}

export function contractVisibleSql(staffId: string): SQL {
  return sql`(
    EXISTS (
      SELECT 1 FROM ${crmProject} p
      LEFT JOIN ${accountManagerAssignment} ama
        ON ama.customer_id = p.customer_id
       AND ama.user_staff_id = ${staffId}
       AND ama.effective_to IS NULL
      LEFT JOIN ${projectStaffAssignment} psa
        ON psa.project_id = p.id
       AND psa.user_staff_id = ${staffId}
       AND psa.effective_to IS NULL
       AND psa.role_type IN ${STAFF_ROLES_SQL}
      WHERE p.id = ${sql.raw('contract.project_id')}
        AND (ama.customer_id IS NOT NULL OR psa.project_id IS NOT NULL)
    )
    OR EXISTS (
      SELECT 1 FROM ${accountManagerAssignment} ama
      WHERE ama.customer_id = ${sql.raw('contract.customer_id')}
        AND ama.user_staff_id = ${staffId}
        AND ama.effective_to IS NULL
    )
  )`
}

function scopedStaffId(scope: CrmDataScope | undefined): string | null {
  if (!scope || scope.type === 'all') return null
  if (scope.type === 'none') return null
  return scope.staffId
}

export function isScopeEmpty(scope: CrmDataScope | undefined): boolean {
  return scope?.type === 'none'
}

export async function sumConsumptionInRange(
  startDate: string,
  endDate: string,
  scope?: CrmDataScope,
): Promise<number> {
  if (isScopeEmpty(scope)) return 0

  const staffId = scopedStaffId(scope)
  const dateFilter = and(
    gte(consumptionUsageDaily.usageDate, startDate),
    lte(consumptionUsageDaily.usageDate, endDate),
  )

  if (!staffId) {
    const rows = await db
      .select({ value: sql<number>`COALESCE(SUM(${consumptionUsageDaily.amount}), 0)` })
      .from(consumptionUsageDaily)
      .where(dateFilter)
    return Number(rows[0]?.value ?? 0)
  }

  const st = buildScopedTenantSubquery(staffId)
  const rows = await db
    .select({ value: sql<number>`COALESCE(SUM(${consumptionUsageDaily.amount}), 0)` })
    .from(consumptionUsageDaily)
    .innerJoin(st, eq(consumptionUsageDaily.tenantId, st.tenantId))
    .where(dateFilter)
  return Number(rows[0]?.value ?? 0)
}

export async function sumRechargeInRange(
  startUtc: Date,
  endExclusiveUtc: Date,
  scope?: CrmDataScope,
): Promise<number> {
  if (isScopeEmpty(scope)) return 0

  const staffId = scopedStaffId(scope)
  const timeFilter = and(
    eq(recharge.status, 'paid'),
    isNotNull(recharge.completedAt),
    gte(recharge.completedAt, startUtc),
    lt(recharge.completedAt, endExclusiveUtc),
  )

  if (!staffId) {
    const rows = await db
      .select({ value: sql<number>`COALESCE(SUM(${recharge.amount}), 0)` })
      .from(recharge)
      .where(timeFilter)
    return Number(rows[0]?.value ?? 0)
  }

  const st = buildScopedTenantSubquery(staffId)
  const rows = await db
    .select({ value: sql<number>`COALESCE(SUM(${recharge.amount}), 0)` })
    .from(recharge)
    .innerJoin(st, eq(recharge.tenantId, st.tenantId))
    .where(timeFilter)
  return Number(rows[0]?.value ?? 0)
}

export async function sumScopedBalance(scope?: CrmDataScope): Promise<number> {
  if (isScopeEmpty(scope)) return 0

  const staffId = scopedStaffId(scope)
  if (!staffId) {
    const rows = await db
      .select({ value: sql<number>`COALESCE(SUM(${billingTenant.balance}), 0)` })
      .from(billingTenant)
    return Number(rows[0]?.value ?? 0)
  }

  const st = buildScopedTenantSubquery(staffId)
  const rows = await db
    .select({ value: sql<number>`COALESCE(SUM(${billingTenant.balance}), 0)` })
    .from(billingTenant)
    .innerJoin(st, eq(billingTenant.id, st.tenantId))
  return Number(rows[0]?.value ?? 0)
}
