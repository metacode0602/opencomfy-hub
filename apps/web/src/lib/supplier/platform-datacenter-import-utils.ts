export const PLATFORM_DATACENTER_IMPORT_MAX_TENANT_IDS = 50

/** 解析用户输入的租户 ID（半角逗号分隔、去重、仅数字） */
export function parsePlatformTenantIds(raw: string): string[] {
  const parts = raw
    .split(',')
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
  if (ids.length > PLATFORM_DATACENTER_IMPORT_MAX_TENANT_IDS) {
    throw new Error(`单次最多 ${PLATFORM_DATACENTER_IMPORT_MAX_TENANT_IDS} 个租户 ID，请分批导入`)
  }
}
