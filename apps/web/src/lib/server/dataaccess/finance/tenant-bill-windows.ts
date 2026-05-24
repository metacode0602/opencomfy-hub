import { db } from '@/lib/db'
import { billingPeriod, billingPeriodTenantBillWindow } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import {
  detectPlatformListPriceWindows,
  type PlatformListPriceWindow,
} from './platform-list-price'
import { newId } from './operation-log'

export type TenantBillWindowDto = PlatformListPriceWindow & {
  id: string
  billingPeriodId: string
}

function mapWindow(
  row: typeof billingPeriodTenantBillWindow.$inferSelect,
): TenantBillWindowDto {
  return {
    id: row.id,
    billingPeriodId: row.billingPeriodId,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    sortOrder: row.sortOrder,
  }
}

export async function listTenantBillWindows(
  periodId: string,
): Promise<TenantBillWindowDto[]> {
  const rows = await db.query.billingPeriodTenantBillWindow.findMany({
    where: eq(billingPeriodTenantBillWindow.billingPeriodId, periodId),
    orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.windowStart)],
  })
  return rows.map(mapWindow)
}

export async function syncTenantBillWindowsForPeriod(
  periodId: string,
): Promise<TenantBillWindowDto[]> {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
  })
  if (!period) return []

  const detected = await detectPlatformListPriceWindows({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  })

  const existing = await listTenantBillWindows(periodId)
  const sameShape =
    existing.length === detected.windows.length &&
    existing.every(
      (w, i) =>
        w.windowStart === detected.windows[i]?.windowStart &&
        w.windowEnd === detected.windows[i]?.windowEnd,
    )

  if (sameShape && existing.length > 0) {
    return existing
  }

  await db
    .delete(billingPeriodTenantBillWindow)
    .where(eq(billingPeriodTenantBillWindow.billingPeriodId, periodId))

  if (detected.windows.length === 0) {
    return []
  }

  const inserts = detected.windows.map((w) => ({
    id: newId(),
    billingPeriodId: periodId,
    windowStart: w.windowStart,
    windowEnd: w.windowEnd,
    sortOrder: w.sortOrder,
  }))

  await db.insert(billingPeriodTenantBillWindow).values(inserts)
  return listTenantBillWindows(periodId)
}

export function formatWindowLabel(windowStart: string, windowEnd: string): string {
  return `${windowStart} ~ ${windowEnd}`
}
