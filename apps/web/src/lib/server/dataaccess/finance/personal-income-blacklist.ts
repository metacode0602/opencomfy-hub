import { db } from '@/lib/db'
import { billingTenant, platformTenantBlacklist } from '@workspace/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'

/** 当前封禁租户的平台 ID 集合（含 local_tenant 映射） */
export async function buildActiveBlacklistPlatformIdSet(): Promise<Set<string>> {
  const rows = await db
    .select({
      platformTenantId: platformTenantBlacklist.platformTenantId,
      localTenantId: platformTenantBlacklist.localTenantId,
    })
    .from(platformTenantBlacklist)
    .where(
      and(
        eq(platformTenantBlacklist.blacklistType, 'TenantBlack'),
        eq(platformTenantBlacklist.status, 'Open'),
        isNull(platformTenantBlacklist.removedAt),
      ),
    )

  const set = new Set<string>()
  const localIds: string[] = []

  for (const row of rows) {
    if (row.platformTenantId) set.add(row.platformTenantId.trim())
    if (row.localTenantId) localIds.push(row.localTenantId)
  }

  if (localIds.length > 0) {
    const tenants = await db
      .select({ platformTenantId: billingTenant.platformTenantId })
      .from(billingTenant)
      .where(inArray(billingTenant.id, localIds))
    for (const t of tenants) {
      if (t.platformTenantId) set.add(t.platformTenantId.trim())
    }
  }

  return set
}

export function isPlatformTenantBlacklisted(
  platformTenantId: string,
  blacklistIds: Set<string>,
): boolean {
  return blacklistIds.has(platformTenantId.trim())
}
