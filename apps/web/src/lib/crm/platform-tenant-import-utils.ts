import type {
  PlatformImportCommitItem,
  PlatformTenantPreviewItem,
} from '@/lib/types/platform-tenant-import'

export const PLATFORM_TENANT_IMPORT_MAX_IDS = 50

/** 解析用户输入的平台租户 ID（去重、仅数字） */
export function parsePlatformTenantIds(raw: string): string[] {
  const parts = raw
    .split(/[,，\s\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const ids: string[] = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) continue
    if (seen.has(p)) continue
    seen.add(p)
    ids.push(p)
  }
  return ids
}

export function assertPlatformTenantIdCount(ids: string[]): void {
  if (ids.length === 0) {
    throw new Error('请至少输入一个有效的平台租户 ID（纯数字）')
  }
  if (ids.length > PLATFORM_TENANT_IMPORT_MAX_IDS) {
    throw new Error(`单次最多 ${PLATFORM_TENANT_IMPORT_MAX_IDS} 个租户 ID，请分批导入`)
  }
}

export function defaultCreateCustomerFromPlatform(
  item: PlatformTenantPreviewItem,
): PlatformImportCommitItem['customer'] & { mode: 'create' } {
  const p = item.platform
  const name =
    p.companyName?.trim() ||
    p.adminPhone?.trim() ||
    p.tenantName?.trim() ||
    `租户-${item.platformTenantId}`
  return {
    mode: 'create',
    name,
    type: p.companyName ? 'B' : 'C',
    contactPerson: p.contactUser?.trim() ?? '',
    contactPhone: p.contactPhone?.trim() || p.adminPhone?.trim() || '',
  }
}
