import { db } from '@/lib/db'
import {
  billingPeriodCostPricingSnapshot,
  billingPeriodCostSourceLine,
  dataCenter,
  gpuCardType,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import {
  loadResolvedPricingMap,
  pricingRefKey,
  resolvedUnitCostToPricingSnapshotFields,
} from './cost-pricing-resolve'
import { financeLog } from './logger'
import { newId } from './operation-log'
import { listTenantBillWindows } from './tenant-bill-windows'

export type CostPricingSnapshotRow = typeof billingPeriodCostPricingSnapshot.$inferSelect

export async function persistCostPricingSnapshots(input: {
  billingPeriodId: string
  periodEnd: string
}): Promise<Map<string, CostPricingSnapshotRow>> {
  const { billingPeriodId: periodId, periodEnd } = input
  financeLog('compute-cost-pricing-snapshot', 'start', { periodId })

  const windows = await listTenantBillWindows(periodId)
  const sourceLines = await db
    .select({
      dataCenterId: billingPeriodCostSourceLine.dataCenterId,
      gpuCardTypeId: billingPeriodCostSourceLine.gpuCardTypeId,
      windowId: billingPeriodCostSourceLine.windowId,
    })
    .from(billingPeriodCostSourceLine)
    .where(eq(billingPeriodCostSourceLine.billingPeriodId, periodId))

  const dcNameById = new Map<string, { name: string; code: string }>()
  const cardNameById = new Map<string, { name: string; code: string }>()

  const dcRows = await db
    .select({ id: dataCenter.id, name: dataCenter.name, code: dataCenter.code })
    .from(dataCenter)
  for (const row of dcRows) {
    dcNameById.set(row.id, { name: row.name, code: row.code })
  }

  const cardRows = await db
    .select({ id: gpuCardType.id, name: gpuCardType.name, code: gpuCardType.code })
    .from(gpuCardType)
  for (const row of cardRows) {
    cardNameById.set(row.id, { name: row.name, code: row.code })
  }

  const needed = new Map<
    string,
    { windowId: string; windowEnd: string; dataCenterId: string; gpuCardTypeId: string }
  >()

  for (const window of windows) {
    for (const line of sourceLines) {
      const effectiveWindowId = line.windowId ?? window.id
      const effectiveWindow = windows.find((w) => w.id === effectiveWindowId) ?? window
      const asOfDate = line.windowId ? effectiveWindow.windowEnd : periodEnd
      const key = `${effectiveWindowId}::${line.dataCenterId}::${line.gpuCardTypeId}::${asOfDate}`
      if (!needed.has(key)) {
        needed.set(key, {
          windowId: effectiveWindowId,
          windowEnd: asOfDate,
          dataCenterId: line.dataCenterId,
          gpuCardTypeId: line.gpuCardTypeId,
        })
      }
    }
  }

  const { map: pricingMap } = await loadResolvedPricingMap({
    pairs: [...needed.values()].map((item) => ({
      dataCenterId: item.dataCenterId,
      gpuCardTypeId: item.gpuCardTypeId,
      asOfDate: item.windowEnd,
    })),
  })

  const inserts: (typeof billingPeriodCostPricingSnapshot.$inferInsert)[] = []
  for (const item of needed.values()) {
    const resolved = pricingMap.get(
      pricingRefKey(item.dataCenterId, item.gpuCardTypeId, item.windowEnd),
    )
    if (!resolved) continue

    const dc = dcNameById.get(item.dataCenterId)
    const card = cardNameById.get(item.gpuCardTypeId)
    inserts.push({
      id: newId(),
      billingPeriodId: periodId,
      windowId: item.windowId,
      dataCenterId: item.dataCenterId,
      dataCenterName: dc?.name ?? null,
      gpuCardTypeId: item.gpuCardTypeId,
      gpuCardTypeName: card?.name ?? null,
      ...resolvedUnitCostToPricingSnapshotFields(resolved),
    })
  }

  if (inserts.length > 0) {
    await db.insert(billingPeriodCostPricingSnapshot).values(inserts)
  }

  return loadPricingSnapshotsForPeriod(periodId)
}

export function findLatestPricingSnapshot(input: {
  snapshots: Map<string, CostPricingSnapshotRow>
  dataCenterId: string
  gpuCardTypeId: string
  windowIds: string[]
}): CostPricingSnapshotRow | null {
  for (const windowId of [...input.windowIds].reverse()) {
    const snap = input.snapshots.get(
      `${input.dataCenterId}::${input.gpuCardTypeId}::${windowId}`,
    )
    if (snap) return snap
  }
  for (const snap of input.snapshots.values()) {
    if (
      snap.dataCenterId === input.dataCenterId &&
      snap.gpuCardTypeId === input.gpuCardTypeId
    ) {
      return snap
    }
  }
  return null
}

export async function loadPricingSnapshotsForPeriod(
  periodId: string,
): Promise<Map<string, CostPricingSnapshotRow>> {
  const rows = await db
    .select()
    .from(billingPeriodCostPricingSnapshot)
    .where(eq(billingPeriodCostPricingSnapshot.billingPeriodId, periodId))

  financeLog('compute-cost-pricing-snapshot', 'done', { periodId, count: rows.length })

  const map = new Map<string, CostPricingSnapshotRow>()
  for (const row of rows) {
    map.set(`${row.dataCenterId}::${row.gpuCardTypeId}::${row.windowId}`, row)
  }
  return map
}
