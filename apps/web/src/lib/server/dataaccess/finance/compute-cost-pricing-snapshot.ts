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
import type { ComputeCostMode } from './compute-cost-mode'

export type CostPricingSnapshotRow = typeof billingPeriodCostPricingSnapshot.$inferSelect

function readLinePricingAsOf(
  line: {
    kind: string
    windowId: string | null
    sourceMeta: unknown
  },
  periodEnd: string,
  windows: { id: string; windowEnd: string }[],
  mode: ComputeCostMode,
): string {
  const meta = line.sourceMeta as { pricing_as_of?: string } | null
  if (line.kind === 'baremetal' && meta?.pricing_as_of) {
    return meta.pricing_as_of
  }
  if (line.windowId) {
    if (mode === 'regenerate') return periodEnd
    return windows.find((w) => w.id === line.windowId)?.windowEnd ?? periodEnd
  }
  return periodEnd
}

export async function persistCostPricingSnapshots(input: {
  billingPeriodId: string
  periodEnd: string
  mode?: ComputeCostMode
}): Promise<Map<string, CostPricingSnapshotRow>> {
  const { billingPeriodId: periodId, periodEnd, mode = 'create' } = input
  financeLog('compute-cost-pricing-snapshot', 'start', { periodId })

  const windows = await listTenantBillWindows(periodId)
  const sourceLines = await db
    .select({
      kind: billingPeriodCostSourceLine.kind,
      dataCenterId: billingPeriodCostSourceLine.dataCenterId,
      gpuCardTypeId: billingPeriodCostSourceLine.gpuCardTypeId,
      windowId: billingPeriodCostSourceLine.windowId,
      sourceMeta: billingPeriodCostSourceLine.sourceMeta,
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

  const pricingPairs = new Map<
    string,
    { dataCenterId: string; gpuCardTypeId: string; asOfDate: string }
  >()
  const snapshotGroups = new Map<
    string,
    {
      windowId: string
      dataCenterId: string
      gpuCardTypeId: string
      asOfDates: string[]
    }
  >()

  const defaultWindowId = windows[0]?.id
  if (!defaultWindowId) {
    financeLog('compute-cost-pricing-snapshot', 'done', { periodId, count: 0 })
    return loadPricingSnapshotsForPeriod(periodId)
  }

  for (const line of sourceLines) {
    const effectiveWindowId = line.windowId ?? defaultWindowId
    const asOfDate = readLinePricingAsOf(line, periodEnd, windows, mode)

    const pairKey = pricingRefKey(line.dataCenterId, line.gpuCardTypeId, asOfDate)
    if (!pricingPairs.has(pairKey)) {
      pricingPairs.set(pairKey, {
        dataCenterId: line.dataCenterId,
        gpuCardTypeId: line.gpuCardTypeId,
        asOfDate,
      })
    }

    const snapshotUk = `${effectiveWindowId}::${line.dataCenterId}::${line.gpuCardTypeId}`
    const group = snapshotGroups.get(snapshotUk)
    if (group) {
      group.asOfDates.push(asOfDate)
    } else {
      snapshotGroups.set(snapshotUk, {
        windowId: effectiveWindowId,
        dataCenterId: line.dataCenterId,
        gpuCardTypeId: line.gpuCardTypeId,
        asOfDates: [asOfDate],
      })
    }
  }

  const { map: pricingMap } = await loadResolvedPricingMap({
    pairs: [...pricingPairs.values()],
  })

  function pickSnapshotAsOf(asOfDates: string[]): string {
    if (asOfDates.includes(periodEnd)) return periodEnd
    return [...asOfDates].sort().at(-1) ?? periodEnd
  }

  const inserts: (typeof billingPeriodCostPricingSnapshot.$inferInsert)[] = []
  for (const group of snapshotGroups.values()) {
    const asOfDate = pickSnapshotAsOf(group.asOfDates)
    const resolved = pricingMap.get(
      pricingRefKey(group.dataCenterId, group.gpuCardTypeId, asOfDate),
    )
    if (!resolved) continue

    const dc = dcNameById.get(group.dataCenterId)
    const card = cardNameById.get(group.gpuCardTypeId)
    inserts.push({
      id: newId(),
      billingPeriodId: periodId,
      windowId: group.windowId,
      dataCenterId: group.dataCenterId,
      dataCenterName: dc?.name ?? null,
      gpuCardTypeId: group.gpuCardTypeId,
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
