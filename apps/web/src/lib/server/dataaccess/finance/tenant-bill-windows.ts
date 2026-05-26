import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodImportBatch,
  billingPeriodTenantBillWindow,
} from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'
import {
  detectPlatformListPriceWindows,
  type PlatformListPriceWindow,
} from './platform-list-price'
import { financeWarn } from './logger'
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

function windowRangeKey(windowStart: string, windowEnd: string): string {
  return `${windowStart}::${windowEnd}`
}

async function hasParsedTenantBillImports(periodId: string): Promise<boolean> {
  const row = await db.query.billingPeriodImportBatch.findFirst({
    where: and(
      eq(billingPeriodImportBatch.billingPeriodId, periodId),
      eq(billingPeriodImportBatch.fileType, 'tenant_bill'),
      eq(billingPeriodImportBatch.parseStatus, 'ok'),
    ),
  })
  return Boolean(row)
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

  const tenantBillImported = await hasParsedTenantBillImports(periodId)

  // 已有 tenant_bill 导入时禁止 delete 窗口（batch.window_id FK 为 ON DELETE CASCADE，会删掉已上传账单）
  if (tenantBillImported && existing.length > 0) {
    const existingKeys = new Set(
      existing.map((w) => windowRangeKey(w.windowStart, w.windowEnd)),
    )
    const missing = detected.windows.filter(
      (w) => !existingKeys.has(windowRangeKey(w.windowStart, w.windowEnd)),
    )
    if (missing.length > 0) {
      await db.insert(billingPeriodTenantBillWindow).values(
        missing.map((w) => ({
          id: newId(),
          billingPeriodId: periodId,
          windowStart: w.windowStart,
          windowEnd: w.windowEnd,
          sortOrder: w.sortOrder,
        })),
      )
      return listTenantBillWindows(periodId)
    }
    if (!sameShape) {
      financeWarn('tenant-bill-windows', 'skip reshape: tenant bills already imported', {
        periodId,
        existing: existing.length,
        detected: detected.windows.length,
      })
    }
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
