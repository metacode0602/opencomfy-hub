import { db } from '@/lib/db'
import {
  isInternalTenantExcludedFromPeriodIncome,
  type BillingPeriodDateRange,
  type InternalTenantExclusionInput,
} from '@/lib/finance/internal-tenant-income-exclusion'
import { billingPeriod, billingTenant } from '@workspace/db/schema'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { FinanceError } from './errors'

export type { BillingPeriodDateRange, InternalTenantExclusionInput }

export async function getBillingPeriodDateRange(
  periodId: string,
): Promise<BillingPeriodDateRange> {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
    columns: { periodStart: true, periodEnd: true },
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  return {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  }
}

function toExclusionInput(
  row: Pick<
    typeof billingTenant.$inferSelect,
    'type' | 'internalEffectiveFrom' | 'internalEffectiveTo'
  >,
): InternalTenantExclusionInput {
  return {
    type: row.type,
    internalEffectiveFrom: row.internalEffectiveFrom,
    internalEffectiveTo: row.internalEffectiveTo,
  }
}

export function filterPlatformIdsExcludingInternalTenants(input: {
  platformTenantIds: string[]
  period: BillingPeriodDateRange
  tenantsByPlatformId: Map<string, InternalTenantExclusionInput>
}): { included: string[]; excluded: string[] } {
  const included: string[] = []
  const excluded: string[] = []
  for (const platformId of input.platformTenantIds) {
    const tenant = input.tenantsByPlatformId.get(platformId)
    if (tenant && isInternalTenantExcludedFromPeriodIncome(tenant, input.period)) {
      excluded.push(platformId)
    } else {
      included.push(platformId)
    }
  }
  return { included, excluded }
}

export async function loadTenantsExclusionByPlatformIds(
  platformTenantIds: string[],
): Promise<Map<string, InternalTenantExclusionInput>> {
  const map = new Map<string, InternalTenantExclusionInput>()
  if (platformTenantIds.length === 0) return map

  const rows = await db
    .select({
      platformTenantId: billingTenant.platformTenantId,
      type: billingTenant.type,
      internalEffectiveFrom: billingTenant.internalEffectiveFrom,
      internalEffectiveTo: billingTenant.internalEffectiveTo,
    })
    .from(billingTenant)
    .where(inArray(billingTenant.platformTenantId, platformTenantIds))

  for (const row of rows) {
    if (!row.platformTenantId) continue
    map.set(row.platformTenantId, toExclusionInput(row))
  }
  return map
}

export async function filterPlatformIdsForPeriodIncome(input: {
  periodId: string
  platformTenantIds: string[]
}): Promise<{ included: string[]; excluded: string[]; period: BillingPeriodDateRange }> {
  const period = await getBillingPeriodDateRange(input.periodId)
  const tenantsByPlatformId = await loadTenantsExclusionByPlatformIds(input.platformTenantIds)
  const { included, excluded } = filterPlatformIdsExcludingInternalTenants({
    platformTenantIds: input.platformTenantIds,
    period,
    tenantsByPlatformId,
  })
  return { included, excluded, period }
}

export async function isLocalTenantExcludedForPeriodIncome(input: {
  tenantId: string
  period: BillingPeriodDateRange
}): Promise<boolean> {
  const row = await db.query.billingTenant.findFirst({
    where: eq(billingTenant.id, input.tenantId),
    columns: {
      type: true,
      internalEffectiveFrom: true,
      internalEffectiveTo: true,
    },
  })
  if (!row) return false
  return isInternalTenantExcludedFromPeriodIncome(toExclusionInput(row), input.period)
}

/** 账期内应从收入/个人收入/提成基数排除的平台租户 ID（CRM 已登记） */
export async function listExcludedInternalPlatformIdsForPeriod(
  periodId: string,
  platformTenantIds?: string[],
): Promise<string[]> {
  const period = await getBillingPeriodDateRange(periodId)

  const rows =
    platformTenantIds && platformTenantIds.length > 0
      ? await db
          .select({
            platformTenantId: billingTenant.platformTenantId,
            type: billingTenant.type,
            internalEffectiveFrom: billingTenant.internalEffectiveFrom,
            internalEffectiveTo: billingTenant.internalEffectiveTo,
          })
          .from(billingTenant)
          .where(inArray(billingTenant.platformTenantId, platformTenantIds))
      : await db
          .select({
            platformTenantId: billingTenant.platformTenantId,
            type: billingTenant.type,
            internalEffectiveFrom: billingTenant.internalEffectiveFrom,
            internalEffectiveTo: billingTenant.internalEffectiveTo,
          })
          .from(billingTenant)
          .where(
            and(eq(billingTenant.type, 'internal'), isNotNull(billingTenant.platformTenantId)),
          )

  const excluded: string[] = []
  for (const row of rows) {
    if (!row.platformTenantId) continue
    if (isInternalTenantExcludedFromPeriodIncome(toExclusionInput(row), period)) {
      excluded.push(row.platformTenantId)
    }
  }
  return excluded
}
