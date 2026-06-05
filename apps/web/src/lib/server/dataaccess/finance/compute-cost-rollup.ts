import { db } from '@/lib/db'
import {
  computeGiftedDurationCostExclTaxForPricing,
  computeSoldDurationCostExclTax,
  resolveTierCostContext,
  type ResolvedPricingFields,
} from '@/lib/finance/cost-pricing-utils'
import {
  COST_TAX_DIVISOR,
  computeGrossProfit,
  toHoursString,
} from '@/lib/finance/cost-row-utils'
import { parseMoney, toMoneyString } from '@/lib/finance/income-row-utils'
import {
  billingPeriodCostSourceLine,
  billingTenant,
  dataCenter,
  gpuCardType,
  platformCostMonthly,
} from '@workspace/db/schema'
import { eq, inArray } from 'drizzle-orm'
import {
  findLatestPricingSnapshot,
  type CostPricingSnapshotRow,
} from './compute-cost-pricing-snapshot'
import type { ComputeCostMode } from './compute-cost-mode'
import {
  loadResolvedPricingMap,
  pricingRefKey,
} from './cost-pricing-resolve'
import type { ResolvedUnitCost } from './tenant-bill-pricing'
import { financeLog } from './logger'
import { newId } from './operation-log'
import { listTenantBillWindows } from './tenant-bill-windows'

type RollupGroup = {
  staffId: string
  staffName: string
  dataCenterId: string
  dataCenterName: string
  dataCenterRegion: string
  gpuCardTypeId: string
  gpuCardTypeCode: string
  totalConsumption: number
  voucherConsumption: number
  balanceConsumption: number
  totalCardHours: number
  voucherCardHours: number
  balanceCardHours: number
  sourceLineIds: string[]
  windowIds: string[]
  confirmedRevenue: number
  soldCost: number
  giftedCost: number
  grossProfit: number
  pricingSnapshotId: string | null
  dealUnitPricePerHour: number | null
  listPricePerHour: number | null
  dealToListRatio: number | null
  matchedTierOrder: number | null
  revenueSharePercentApplied: number | null
  supplierUnitCostId: string | null
}

function readSourceLinePricingAsOf(
  line: typeof billingPeriodCostSourceLine.$inferSelect,
  periodEnd: string,
  windows: { id: string; windowEnd: string }[],
  usePeriodEndPricing: boolean,
): string {
  const meta = line.sourceMeta as { pricing_as_of?: string } | null
  if (line.kind === 'baremetal' && meta?.pricing_as_of) {
    return meta.pricing_as_of
  }
  if (line.windowId) {
    if (usePeriodEndPricing) return periodEnd
    return windows.find((w) => w.id === line.windowId)?.windowEnd ?? periodEnd
  }
  return periodEnd
}

function resolvedToPricingFields(resolved: ResolvedUnitCost): ResolvedPricingFields {
  return {
    pricingMode: resolved.pricingMode,
    unitPricePerHour:
      resolved.unitPricePerHour ?? resolved.listPricePerHour ?? null,
    revenueSharePercent: resolved.revenueSharePercent,
    listPricePerHour: resolved.listPricePerHour,
    pricingTiers: resolved.pricingTiers,
  }
}

function computeLineFinancials(
  pricing: ResolvedPricingFields,
  metrics: {
    balanceConsumption: number
    balanceCardHours: number
    voucherCardHours: number
  },
): {
  confirmed: number
  sold: number
  gifted: number
  gross: number
  tierCtx: ReturnType<typeof resolveTierCostContext>
} {
  const tierCtx = resolveTierCostContext(pricing, metrics)
  const confirmed = metrics.balanceConsumption / COST_TAX_DIVISOR
  const sold = computeSoldDurationCostExclTax(pricing, metrics, tierCtx)
  const gifted = computeGiftedDurationCostExclTaxForPricing(pricing, metrics, tierCtx)
  const gross = computeGrossProfit(confirmed, sold, gifted)
  return { confirmed, sold, gifted, gross, tierCtx }
}

function pricingFieldString(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null
  return toMoneyString(value)
}

function rollupKey(staffId: string, dataCenterId: string, gpuCardTypeId: string): string {
  return `${staffId}::${dataCenterId}::${gpuCardTypeId}`
}

type CostMonthlyInsert = typeof platformCostMonthly.$inferInsert

function sumRecordField(
  records: CostMonthlyInsert[],
  field: keyof Pick<
    CostMonthlyInsert,
    | 'totalConsumption'
    | 'voucherConsumption'
    | 'balanceConsumption'
    | 'totalCardHours'
    | 'balanceCardHours'
    | 'voucherCardHours'
    | 'confirmedRevenueExclTax'
    | 'soldDurationCostExclTax'
    | 'giftedDurationCostExclTax'
    | 'grossProfit'
  >,
  asHours = false,
): string {
  const total = records.reduce((acc, row) => {
    const raw = row[field]
    if (raw == null || raw === '') return acc
    return acc + (asHours ? Number(raw) : parseMoney(String(raw)))
  }, 0)
  return asHours ? toHoursString(total) : toMoneyString(total)
}

function buildStaffSumRows(
  periodId: string,
  recordRows: CostMonthlyInsert[],
): CostMonthlyInsert[] {
  const byStaff = new Map<string, CostMonthlyInsert[]>()
  for (const row of recordRows) {
    if (!row.staffId) continue
    const list = byStaff.get(row.staffId) ?? []
    list.push(row)
    byStaff.set(row.staffId, list)
  }

  const sumRows: CostMonthlyInsert[] = []
  for (const [staffId, records] of byStaff) {
    const staffName =
      records[0]?.staffName ?? records[0]?.accountManager ?? staffId
    sumRows.push({
      id: newId(),
      billingPeriodId: periodId,
      type: 'sum',
      staffId,
      staffName,
      accountManager: staffName,
      dataCenterId: null,
      gpuCardTypeId: null,
      supplierUnitCostId: null,
      pricingSnapshotId: null,
      idcName: null,
      idcCode: null,
      cardType: null,
      totalConsumption: sumRecordField(records, 'totalConsumption'),
      voucherConsumption: sumRecordField(records, 'voucherConsumption'),
      balanceConsumption: sumRecordField(records, 'balanceConsumption'),
      totalCardHours: sumRecordField(records, 'totalCardHours', true),
      balanceCardHours: sumRecordField(records, 'balanceCardHours', true),
      voucherCardHours: sumRecordField(records, 'voucherCardHours', true),
      confirmedRevenueExclTax: sumRecordField(records, 'confirmedRevenueExclTax'),
      soldDurationCostExclTax: sumRecordField(records, 'soldDurationCostExclTax'),
      giftedDurationCostExclTax: sumRecordField(records, 'giftedDurationCostExclTax'),
      grossProfit: sumRecordField(records, 'grossProfit'),
      sourceLineIds: null,
    })
  }

  return sumRows
}

export async function rollupSourceLinesToPlatformMonthly(input: {
  billingPeriodId: string
  snapshots: Map<string, CostPricingSnapshotRow>
  issues: string[]
  periodEnd: string
  mode?: ComputeCostMode
  usePeriodEndPricing?: boolean
}): Promise<{
  costCount: number
  projectCost: number
  internalUserCost: number
}> {
  const {
    billingPeriodId: periodId,
    snapshots,
    issues,
    periodEnd,
    mode = 'create',
    usePeriodEndPricing = mode === 'regenerate',
  } = input

  const lines = await db
    .select()
    .from(billingPeriodCostSourceLine)
    .where(eq(billingPeriodCostSourceLine.billingPeriodId, periodId))

  if (lines.length === 0) {
    return { costCount: 0, projectCost: 0, internalUserCost: 0 }
  }

  const tenantIds = [
    ...new Set(lines.map((l) => l.tenantId).filter((id): id is string => Boolean(id))),
  ]
  const tenantTypeById = new Map<string, string>()
  if (tenantIds.length > 0) {
    const tenantRows = await db
      .select({ id: billingTenant.id, type: billingTenant.type })
      .from(billingTenant)
      .where(inArray(billingTenant.id, tenantIds))
    for (const row of tenantRows) {
      tenantTypeById.set(row.id, row.type)
    }
  }

  let projectCostAcc = 0
  let internalUserCostAcc = 0

  const windows = await listTenantBillWindows(periodId)
  const windowIds = windows.map((w) => w.id)

  const pricingPairs = lines.map((line) => ({
    dataCenterId: line.dataCenterId,
    gpuCardTypeId: line.gpuCardTypeId,
    asOfDate: readSourceLinePricingAsOf(line, periodEnd, windows, usePeriodEndPricing),
  }))
  const { map: pricingMap } = await loadResolvedPricingMap({ pairs: pricingPairs })

  const dcRegions = new Map<string, string>()
  const cardCodes = new Map<string, string>()
  const dcRows = await db
    .select({
      id: dataCenter.id,
      containerInstanceRegion: dataCenter.containerInstanceRegion,
    })
    .from(dataCenter)
  for (const row of dcRows) {
    dcRegions.set(row.id, row.containerInstanceRegion?.trim() ?? '')
  }
  const cardRows = await db
    .select({ id: gpuCardType.id, code: gpuCardType.code })
    .from(gpuCardType)
  for (const row of cardRows) cardCodes.set(row.id, row.code)

  const bucket = new Map<string, RollupGroup>()

  for (const line of lines) {
    if (!line.staffId) continue
    const lineMetrics = {
      balanceConsumption: parseMoney(line.balanceConsumption),
      balanceCardHours: Number(line.balanceCardHours ?? 0),
      voucherCardHours: Number(line.voucherCardHours ?? 0),
    }
    const asOf = readSourceLinePricingAsOf(line, periodEnd, windows, usePeriodEndPricing)
    const resolved = pricingMap.get(
      pricingRefKey(line.dataCenterId, line.gpuCardTypeId, asOf),
    )
    if (!resolved) {
      issues.push(
        `缺成本定价 staff=${line.staffId} dc=${line.dataCenterId} card=${line.gpuCardTypeId} asOf=${asOf}`,
      )
      continue
    }

    const pricing = resolvedToPricingFields(resolved)
    const { confirmed, sold, gifted, gross, tierCtx } = computeLineFinancials(
      pricing,
      lineMetrics,
    )
    const lineCost = sold + gifted
    if (line.tenantId && tenantTypeById.get(line.tenantId) === 'internal') {
      internalUserCostAcc += lineCost
    } else {
      projectCostAcc += lineCost
    }
    const snap = findLatestPricingSnapshot({
      snapshots,
      dataCenterId: line.dataCenterId,
      gpuCardTypeId: line.gpuCardTypeId,
      windowIds: line.windowId ? [line.windowId] : windowIds,
    })

    const key = rollupKey(line.staffId, line.dataCenterId, line.gpuCardTypeId)
    const existing = bucket.get(key)
    if (!existing) {
      bucket.set(key, {
        staffId: line.staffId,
        staffName: line.staffName ?? line.staffId,
        dataCenterId: line.dataCenterId,
        dataCenterName: line.dataCenterName ?? '',
        dataCenterRegion: dcRegions.get(line.dataCenterId) ?? '',
        gpuCardTypeId: line.gpuCardTypeId,
        gpuCardTypeCode: cardCodes.get(line.gpuCardTypeId) ?? '',
        totalConsumption: parseMoney(line.totalConsumption),
        voucherConsumption: parseMoney(line.voucherConsumption),
        balanceConsumption: lineMetrics.balanceConsumption,
        totalCardHours: Number(line.totalCardHours ?? 0),
        voucherCardHours: lineMetrics.voucherCardHours,
        balanceCardHours: lineMetrics.balanceCardHours,
        sourceLineIds: [line.id],
        windowIds: line.windowId ? [line.windowId] : [],
        confirmedRevenue: confirmed,
        soldCost: sold,
        giftedCost: gifted,
        grossProfit: gross,
        pricingSnapshotId: snap?.id ?? null,
        dealUnitPricePerHour: tierCtx.dealUnitPricePerHour,
        listPricePerHour: pricing.listPricePerHour,
        dealToListRatio: tierCtx.dealToListRatio,
        matchedTierOrder: tierCtx.matchedTierOrder,
        revenueSharePercentApplied: tierCtx.revenueSharePercentApplied,
        supplierUnitCostId: resolved.supplierUnitCostId,
      })
      continue
    }

    existing.totalConsumption += parseMoney(line.totalConsumption)
    existing.voucherConsumption += parseMoney(line.voucherConsumption)
    existing.balanceConsumption += lineMetrics.balanceConsumption
    existing.totalCardHours += Number(line.totalCardHours ?? 0)
    existing.voucherCardHours += lineMetrics.voucherCardHours
    existing.balanceCardHours += lineMetrics.balanceCardHours
    existing.sourceLineIds.push(line.id)
    existing.confirmedRevenue += confirmed
    existing.soldCost += sold
    existing.giftedCost += gifted
    existing.grossProfit += gross
    if (line.windowId && !existing.windowIds.includes(line.windowId)) {
      existing.windowIds.push(line.windowId)
    }
  }

  const recordRows: (typeof platformCostMonthly.$inferInsert)[] = []

  for (const group of bucket.values()) {
    recordRows.push({
      id: newId(),
      billingPeriodId: periodId,
      type: 'record',
      staffId: group.staffId,
      staffName: group.staffName,
      accountManager: group.staffName,
      dataCenterId: group.dataCenterId,
      gpuCardTypeId: group.gpuCardTypeId,
      supplierUnitCostId: group.supplierUnitCostId,
      pricingSnapshotId: group.pricingSnapshotId,
      idcName: group.dataCenterName,
      idcCode: group.dataCenterRegion || null,
      cardType: group.gpuCardTypeCode,
      totalConsumption: toMoneyString(group.totalConsumption),
      voucherConsumption: toMoneyString(group.voucherConsumption),
      balanceConsumption: toMoneyString(group.balanceConsumption),
      totalCardHours: toHoursString(group.totalCardHours),
      balanceCardHours: toHoursString(group.balanceCardHours),
      voucherCardHours: toHoursString(group.voucherCardHours),
      confirmedRevenueExclTax: toMoneyString(group.confirmedRevenue),
      soldDurationCostExclTax: toMoneyString(group.soldCost),
      giftedDurationCostExclTax: toMoneyString(group.giftedCost),
      grossProfit: toMoneyString(group.grossProfit),
      dealUnitPricePerHour: pricingFieldString(group.dealUnitPricePerHour),
      listPricePerHour: pricingFieldString(group.listPricePerHour),
      dealToListRatio:
        group.dealToListRatio != null ? group.dealToListRatio.toFixed(6) : null,
      matchedTierOrder: group.matchedTierOrder,
      revenueSharePercentApplied:
        group.revenueSharePercentApplied != null
          ? group.revenueSharePercentApplied.toFixed(4)
          : null,
      sourceLineIds: group.sourceLineIds,
    })
  }

  if (recordRows.length === 0) {
    return {
      costCount: 0,
      projectCost: projectCostAcc,
      internalUserCost: internalUserCostAcc,
    }
  }

  const staffSumRows = buildStaffSumRows(periodId, recordRows)

  const sumRow: CostMonthlyInsert = {
    id: newId(),
    billingPeriodId: periodId,
    type: 'sum',
    staffId: null,
    staffName: '合计',
    accountManager: '合计',
    dataCenterId: null,
    gpuCardTypeId: null,
    supplierUnitCostId: null,
    pricingSnapshotId: null,
    idcName: null,
    idcCode: null,
    cardType: null,
    totalConsumption: toMoneyString(
      recordRows.reduce((a, r) => a + parseMoney(r.totalConsumption), 0),
    ),
    voucherConsumption: toMoneyString(
      recordRows.reduce((a, r) => a + parseMoney(r.voucherConsumption), 0),
    ),
    balanceConsumption: toMoneyString(
      recordRows.reduce((a, r) => a + parseMoney(r.balanceConsumption), 0),
    ),
    totalCardHours: toHoursString(
      recordRows.reduce((a, r) => a + Number(r.totalCardHours ?? 0), 0),
    ),
    balanceCardHours: toHoursString(
      recordRows.reduce((a, r) => a + Number(r.balanceCardHours ?? 0), 0),
    ),
    voucherCardHours: toHoursString(
      recordRows.reduce((a, r) => a + Number(r.voucherCardHours ?? 0), 0),
    ),
    confirmedRevenueExclTax: toMoneyString(
      recordRows.reduce((a, r) => a + parseMoney(r.confirmedRevenueExclTax), 0),
    ),
    soldDurationCostExclTax: toMoneyString(
      recordRows.reduce((a, r) => a + parseMoney(r.soldDurationCostExclTax), 0),
    ),
    giftedDurationCostExclTax: toMoneyString(
      recordRows.reduce((a, r) => a + parseMoney(r.giftedDurationCostExclTax), 0),
    ),
    grossProfit: toMoneyString(recordRows.reduce((a, r) => a + parseMoney(r.grossProfit), 0)),
    sourceLineIds: null,
  }

  await db
    .insert(platformCostMonthly)
    .values([...recordRows, ...staffSumRows, sumRow])
  financeLog('compute-cost-rollup', 'done', {
    periodId,
    recordCount: recordRows.length,
    staffSumCount: staffSumRows.length,
  })
  return {
    costCount: recordRows.length,
    projectCost: projectCostAcc,
    internalUserCost: internalUserCostAcc,
  }
}
