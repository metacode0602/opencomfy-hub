import { parsePlatformTenantIds } from '@/lib/crm/platform-tenant-import-utils'

export const TENANT_RECHARGE_BALANCE_QUERY_MAX_IDS = 200

export function parseTenantRechargeBalanceQueryIds(raw: string): string[] {
  return parsePlatformTenantIds(raw)
}

export function assertTenantRechargeBalanceQueryIdCount(ids: string[]): void {
  if (ids.length === 0) {
    throw new Error('请至少输入一个有效的平台租户 ID（纯数字）')
  }
  if (ids.length > TENANT_RECHARGE_BALANCE_QUERY_MAX_IDS) {
    throw new Error(`单次最多 ${TENANT_RECHARGE_BALANCE_QUERY_MAX_IDS} 个租户 ID，请分批查询`)
  }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
