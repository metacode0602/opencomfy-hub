/** 内部租户在账期收入/提成基数中的排除口径（自然日） */

export type InternalTenantExclusionInput = {
  type: string
  internalEffectiveFrom?: string | null
  internalEffectiveTo?: string | null
}

export type BillingPeriodDateRange = {
  periodStart: string
  periodEnd: string
}

/** type=internal 且未填起止日期 → 全历史排除 */
export function isInternalTenantExcludedFromPeriodIncome(
  tenant: InternalTenantExclusionInput,
  period: BillingPeriodDateRange,
): boolean {
  if (tenant.type !== 'internal') return false

  const from = tenant.internalEffectiveFrom?.trim() || null
  const to = tenant.internalEffectiveTo?.trim() || null
  if (!from && !to) return true

  const { periodStart, periodEnd } = period
  const rangeStart = from ?? '0001-01-01'
  const rangeEnd = to ?? '9999-12-31'
  return rangeStart <= periodEnd && rangeEnd >= periodStart
}
