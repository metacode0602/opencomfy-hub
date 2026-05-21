export const PLATFORM_DATACENTER_IMPORT_MAX_IDS = 50

/** 解析用户输入的平台机房 ID（去重、仅数字） */
export function parsePlatformDatacenterIds(raw: string): string[] {
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

export function assertPlatformDatacenterIdCount(ids: string[]): void {
  if (ids.length === 0) {
    throw new Error('请至少输入一个有效的平台机房 ID（纯数字）')
  }
  if (ids.length > PLATFORM_DATACENTER_IMPORT_MAX_IDS) {
    throw new Error(`单次最多 ${PLATFORM_DATACENTER_IMPORT_MAX_IDS} 个机房 ID，请分批导入`)
  }
}
