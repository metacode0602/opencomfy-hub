import { db } from '@/lib/db'
import type { ContractPricingMode, ContractPricingTier } from '@/lib/data/types'
import {
  computeGiftedDurationCostExclTaxForPricing,
  computeSoldDurationCostExclTax,
  parsePositiveMoney,
  parsePositivePercent,
  parsePricingTiers,
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
  dataCenter,
  gpuCardType,
  platformCostMonthly,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import {
  findLatestPricingSnapshot,
  type CostPricingSnapshotRow,
} from './compute-cost-pricing-snapshot'
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
}

function pricingFieldString(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null
  return toMoneyString(value)
}

function snapshotToPricingFields(snap: CostPricingSnapshotRow): ResolvedPricingFields {
  return {
    pricingMode: snap.pricingMode as ContractPricingMode,
    unitPricePerHour:
      parsePositiveMoney(snap.dealUnitPricePerHour) ??
      parsePositiveMoney(snap.listPricePerHour),
    revenueSharePercent: parsePositivePercent(snap.revenueSharePercent),
    listPricePerHour: parsePositiveMoney(snap.listPricePerHour),
    pricingTiers: parsePricingTiers(snap.pricingTiers) as ContractPricingTier[],
  }
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
}): Promise<number> {
  const { billingPeriodId: periodId, snapshots, issues } = input

  const lines = await db
    .select()
    .from(billingPeriodCostSourceLine)
    .where(eq(billingPeriodCostSourceLine.billingPeriodId, periodId))

  if (lines.length === 0) return 0

  const windows = await listTenantBillWindows(periodId)
  const windowIds = windows.map((w) => w.id)

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
        balanceConsumption: parseMoney(line.balanceConsumption),
        totalCardHours: Number(line.totalCardHours ?? 0),
        voucherCardHours: Number(line.voucherCardHours ?? 0),
        balanceCardHours: Number(line.balanceCardHours ?? 0),
        sourceLineIds: [line.id],
        windowIds: line.windowId ? [line.windowId] : [],
      })
      continue
    }

    existing.totalConsumption += parseMoney(line.totalConsumption)
    existing.voucherConsumption += parseMoney(line.voucherConsumption)
    existing.balanceConsumption += parseMoney(line.balanceConsumption)
    existing.totalCardHours += Number(line.totalCardHours ?? 0)
    existing.voucherCardHours += Number(line.voucherCardHours ?? 0)
    existing.balanceCardHours += Number(line.balanceCardHours ?? 0)
    existing.sourceLineIds.push(line.id)
    if (line.windowId && !existing.windowIds.includes(line.windowId)) {
      existing.windowIds.push(line.windowId)
    }
  }

  const recordRows: (typeof platformCostMonthly.$inferInsert)[] = []

  for (const group of bucket.values()) {
    const snap = findLatestPricingSnapshot({
      snapshots,
      dataCenterId: group.dataCenterId,
      gpuCardTypeId: group.gpuCardTypeId,
      windowIds: group.windowIds.length > 0 ? group.windowIds : windowIds,
    })
    if (!snap) {
      issues.push(
        `缺定价快照 staff=${group.staffId} dc=${group.dataCenterId} card=${group.gpuCardTypeId}`,
      )
      continue
    }

    const pricing = snapshotToPricingFields(snap)
    const metrics = {
      balanceConsumption: group.balanceConsumption,
      balanceCardHours: group.balanceCardHours,
      voucherCardHours: group.voucherCardHours,
    }
    const tierCtx = resolveTierCostContext(pricing, metrics)
    const confirmed = group.balanceConsumption / COST_TAX_DIVISOR
    const sold = computeSoldDurationCostExclTax(pricing, metrics, tierCtx)
    const gifted = computeGiftedDurationCostExclTaxForPricing(pricing, metrics, tierCtx)
    const gross = computeGrossProfit(confirmed, sold, gifted)

    recordRows.push({
      id: newId(),
      billingPeriodId: periodId,
      type: 'record',
      staffId: group.staffId,
      staffName: group.staffName,
      accountManager: group.staffName,
      dataCenterId: group.dataCenterId,
      gpuCardTypeId: group.gpuCardTypeId,
      supplierUnitCostId: snap.supplierUnitCostId,
      pricingSnapshotId: snap.id,
      idcName: group.dataCenterName,
      idcCode: group.dataCenterRegion || null,
      cardType: group.gpuCardTypeCode,
      totalConsumption: toMoneyString(group.totalConsumption),
      voucherConsumption: toMoneyString(group.voucherConsumption),
      balanceConsumption: toMoneyString(group.balanceConsumption),
      totalCardHours: toHoursString(group.totalCardHours),
      balanceCardHours: toHoursString(group.balanceCardHours),
      voucherCardHours: toHoursString(group.voucherCardHours),
      confirmedRevenueExclTax: toMoneyString(confirmed),
      soldDurationCostExclTax: toMoneyString(sold),
      giftedDurationCostExclTax: toMoneyString(gifted),
      grossProfit: toMoneyString(gross),
      dealUnitPricePerHour: pricingFieldString(tierCtx.dealUnitPricePerHour),
      listPricePerHour: pricingFieldString(pricing.listPricePerHour),
      dealToListRatio:
        tierCtx.dealToListRatio != null ? tierCtx.dealToListRatio.toFixed(6) : null,
      matchedTierOrder: tierCtx.matchedTierOrder,
      revenueSharePercentApplied:
        tierCtx.revenueSharePercentApplied != null
          ? tierCtx.revenueSharePercentApplied.toFixed(4)
          : null,
      sourceLineIds: group.sourceLineIds,
    })
  }

  if (recordRows.length === 0) return 0

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
  return recordRows.length
}
