import { db } from '@/lib/db'
import {
  computeGiftedDurationCostExclTaxForPricing,
  computeSoldDurationCostExclTax,
  resolveTierCostContext,
  type ResolvedPricingFields,
} from '@/lib/finance/cost-pricing-utils'
import { COST_TAX_DIVISOR, computeGrossProfit } from '@/lib/finance/cost-row-utils'
import { parseMoney } from '@/lib/finance/income-row-utils'
import { billingPeriodCostSourceLine } from '@workspace/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { findLatestPricingSnapshot } from '../compute-cost-pricing-snapshot'
import type { CostPricingSnapshotRow } from '../compute-cost-pricing-snapshot'
import { listTenantBillWindows } from '../tenant-bill-windows'
import { loadResolvedPricingMap, pricingRefKey } from '../cost-pricing-resolve'
import type { ResolvedUnitCost } from '../tenant-bill-pricing'
import { periodUsesPeriodEndCostPricing } from '../billing-period-pricing-mode'
import type { billingPeriod } from '@workspace/db/schema'

const FLEX_KINDS = ['flex', 'baremetal'] as const

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

function computeLineGrossProfit(
  pricing: ResolvedPricingFields,
  metrics: {
    balanceConsumption: number
    balanceCardHours: number
    voucherCardHours: number
  },
): number {
  const tierCtx = resolveTierCostContext(pricing, metrics)
  const confirmed = metrics.balanceConsumption / COST_TAX_DIVISOR
  const sold = computeSoldDurationCostExclTax(pricing, metrics, tierCtx)
  const gifted = computeGiftedDurationCostExclTaxForPricing(pricing, metrics, tierCtx)
  return computeGrossProfit(confirmed, sold, gifted)
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

export type ProjectMetrics = {
  grossProfitBase: number
  flexConsumption: number
}

export async function computeAllProjectMetrics(input: {
  billingPeriodId: string
  period: typeof billingPeriod.$inferSelect
  snapshots: Map<string, CostPricingSnapshotRow>
}): Promise<Map<string, ProjectMetrics>> {
  const { billingPeriodId, period, snapshots } = input
  const usePeriodEndPricing = periodUsesPeriodEndCostPricing(period)
  const windows = await listTenantBillWindows(billingPeriodId)
  const windowIds = windows.map((w) => w.id)

  const lines = await db
    .select()
    .from(billingPeriodCostSourceLine)
    .where(
      and(
        eq(billingPeriodCostSourceLine.billingPeriodId, billingPeriodId),
        inArray(billingPeriodCostSourceLine.kind, [...FLEX_KINDS]),
        sql`${billingPeriodCostSourceLine.projectId} is not null`,
      ),
    )

  if (lines.length === 0) return new Map()

  const pricingPairs = lines.map((line) => ({
    dataCenterId: line.dataCenterId,
    gpuCardTypeId: line.gpuCardTypeId,
    asOfDate: readSourceLinePricingAsOf(
      line,
      period.periodEnd,
      windows,
      usePeriodEndPricing,
    ),
  }))
  const { map: pricingMap } = await loadResolvedPricingMap({ pairs: pricingPairs })

  const byProject = new Map<string, ProjectMetrics>()

  for (const line of lines) {
    const projectId = line.projectId!
    const lineMetrics = {
      balanceConsumption: parseMoney(line.balanceConsumption),
      balanceCardHours: Number(line.balanceCardHours ?? 0),
      voucherCardHours: Number(line.voucherCardHours ?? 0),
    }
    const asOf = readSourceLinePricingAsOf(
      line,
      period.periodEnd,
      windows,
      usePeriodEndPricing,
    )
    const resolved = pricingMap.get(
      pricingRefKey(line.dataCenterId, line.gpuCardTypeId, asOf),
    )
    if (!resolved) continue

    const pricing = resolvedToPricingFields(resolved)
    const gross = computeLineGrossProfit(pricing, lineMetrics)
    const flex = parseMoney(line.balanceConsumption)

    const snap = findLatestPricingSnapshot({
      snapshots,
      dataCenterId: line.dataCenterId,
      gpuCardTypeId: line.gpuCardTypeId,
      windowIds: line.windowId ? [line.windowId] : windowIds,
    })
    void snap

    const acc = byProject.get(projectId) ?? { grossProfitBase: 0, flexConsumption: 0 }
    acc.grossProfitBase += gross
    acc.flexConsumption += flex
    byProject.set(projectId, acc)
  }

  return byProject
}

export async function listProjectIdsWithCostLines(billingPeriodId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ projectId: billingPeriodCostSourceLine.projectId })
    .from(billingPeriodCostSourceLine)
    .where(
      and(
        eq(billingPeriodCostSourceLine.billingPeriodId, billingPeriodId),
        inArray(billingPeriodCostSourceLine.kind, [...FLEX_KINDS]),
        sql`${billingPeriodCostSourceLine.projectId} is not null`,
      ),
    )
  return rows.map((r) => r.projectId!).filter(Boolean)
}
