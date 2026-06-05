import { parsePlatformTenantIds } from '@/lib/crm/platform-tenant-import-utils'

export const TENANT_PROJECT_QUERY_MAX_IDS = 2000

export function parseTenantProjectQueryIds(raw: string): string[] {
  return parsePlatformTenantIds(raw)
}

export function assertTenantProjectQueryIdCount(ids: string[]): void {
  if (ids.length === 0) {
    throw new Error('请至少输入一个有效的平台租户 ID（纯数字）')
  }
  if (ids.length > TENANT_PROJECT_QUERY_MAX_IDS) {
    throw new Error(`单次最多 ${TENANT_PROJECT_QUERY_MAX_IDS} 个租户 ID，请分批查询`)
  }
}
