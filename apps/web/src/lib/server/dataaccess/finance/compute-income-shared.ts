import type { billingPeriodRawCustomerConsumption } from '@workspace/db/schema'
import { FinanceError } from './errors'

export type ComputeIncomeResult = {
  incomeCount: number
  reconciliationIssues: string[]
}

export type TenantAggBase = {
  tenantPlatformId: string
  customerType: string
  total: number
  voucher: number
  balance: number
  sourceRawIds: string[]
  rowCount: number
}

export function parseIncomeNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

/** 同一 tenant_platform_id 不得混用 B/C */
export function validateCustomerTypeConsistency(
  customerRows: (typeof billingPeriodRawCustomerConsumption.$inferSelect)[],
): void {
  const typesByTenant = new Map<string, Set<string>>()
  for (const row of customerRows) {
    const set = typesByTenant.get(row.tenantPlatformId) ?? new Set<string>()
    set.add(row.customerType)
    typesByTenant.set(row.tenantPlatformId, set)
  }
  const conflicts: string[] = []
  for (const [platformId, types] of typesByTenant) {
    if (types.size > 1) {
      conflicts.push(`${platformId}(${[...types].join('/')})`)
    }
  }
  if (conflicts.length > 0) {
    const sample = conflicts.slice(0, 5).join('、')
    throw new FinanceError(
      'PRECONDITION_FAILED',
      `${conflicts.length} 个租户的客户类型不一致（B/C 混用），请修正 Excel：${sample}`,
    )
  }
}

export function buildTenantAggMap(
  customerRows: (typeof billingPeriodRawCustomerConsumption.$inferSelect)[],
): Map<string, TenantAggBase> {
  const map = new Map<string, TenantAggBase>()
  for (const row of customerRows) {
    const cur = map.get(row.tenantPlatformId) ?? {
      tenantPlatformId: row.tenantPlatformId,
      customerType: row.customerType,
      total: 0,
      voucher: 0,
      balance: 0,
      sourceRawIds: [] as string[],
      rowCount: 0,
    }
    cur.total += parseIncomeNum(row.totalConsumption)
    cur.voucher += parseIncomeNum(row.voucherConsumption)
    cur.balance += parseIncomeNum(row.balanceConsumption)
    cur.sourceRawIds.push(row.id)
    cur.rowCount += 1
    map.set(row.tenantPlatformId, cur)
  }
  return map
}

export function appendRefGapIssues(
  issues: string[],
  tenantAggMap: Map<string, TenantAggBase>,
  bareByTenant: Map<string, number>,
  bBalanceByTenant: Map<string, number>,
): void {
  for (const [platformId, agg] of tenantAggMap) {
    const cBalance = agg.balance
    const bBalance = bBalanceByTenant.get(platformId) ?? 0
    const mBare = bareByTenant.get(platformId) ?? 0
    issues.push(
      `ref_gap tenant=${platformId}: ${(cBalance - bBalance - mBare).toFixed(4)}`,
    )
  }
}
