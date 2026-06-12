export type TenantRechargeBalanceQueryProjectTag = {
  id: string
  name: string
}

export type TenantRechargeBalanceQueryRow = {
  platformTenantId: string
  tenantName?: string
  /** 客户全称 */
  customerName?: string
  projectTags: TenantRechargeBalanceQueryProjectTag[]
  /** 所选月份充值总额 */
  monthlyRechargeTotal: number
  /** 当前账户余额 */
  currentBalance: number
  /** 首次充值完成时间（ISO） */
  firstRechargeAt?: string
  found: boolean
}

export type TenantRechargeBalanceQueryResult = {
  usageMonth: string
  rows: TenantRechargeBalanceQueryRow[]
  summary: {
    total: number
    matched: number
    notFound: number
    monthlyRechargeGrandTotal: number
    currentBalanceGrandTotal: number
  }
}

export function summarizeTenantRechargeBalanceRows(
  rows: TenantRechargeBalanceQueryRow[],
): TenantRechargeBalanceQueryResult['summary'] {
  const matchedRows = rows.filter((row) => row.found)
  return {
    total: rows.length,
    matched: matchedRows.length,
    notFound: rows.length - matchedRows.length,
    monthlyRechargeGrandTotal: matchedRows.reduce((sum, row) => sum + row.monthlyRechargeTotal, 0),
    currentBalanceGrandTotal: matchedRows.reduce((sum, row) => sum + row.currentBalance, 0),
  }
}
