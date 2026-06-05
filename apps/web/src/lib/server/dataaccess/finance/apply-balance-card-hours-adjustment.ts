import { db } from '@/lib/db'
import {
  deriveCostFieldsAfterBalanceAdjustment,
  recomputeCostSumRows,
  resolveUnitPricePerHour,
} from '@/lib/finance/cost-row-utils'
import { parseMoney } from '@/lib/finance/income-row-utils'
import type { PlatformCostMonthly } from '@/lib/types/finance'
import type { VoucherCardHoursAdjustmentHistoryEntry } from '@/lib/types/finance'
import {
  billingPeriod,
  platformCostMonthly,
  voucherCardHoursAdjustmentHistory,
} from '@workspace/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { refreshBillingPeriodPeriodTotals } from './billing-period-period-totals'
import { FinanceError } from './errors'
import { appendOperationLog, newId } from './operation-log'

type CostDbRow = typeof platformCostMonthly.$inferSelect

export function mapPlatformCostMonthlyRow(r: CostDbRow): PlatformCostMonthly {
  return {
    id: r.id,
    billing_period_id: r.billingPeriodId,
    supplier_unit_cost_id: r.supplierUnitCostId,
    account_manager: r.accountManager,
    staff_name: r.staffName,
    staff_id: r.staffId,
    data_center_id: r.dataCenterId,
    gpu_card_type_id: r.gpuCardTypeId,
    idc_name: r.idcName,
    idc_code: r.idcCode,
    card_type: r.cardType,
    type: r.type as 'record' | 'sum',
    total_consumption: r.totalConsumption,
    voucher_consumption: r.voucherConsumption,
    balance_consumption: r.balanceConsumption,
    total_card_hours: r.totalCardHours,
    balance_card_hours: r.balanceCardHours,
    voucher_card_hours: r.voucherCardHours,
    confirmed_revenue_excl_tax: r.confirmedRevenueExclTax,
    sold_duration_cost_excl_tax: r.soldDurationCostExclTax,
    gifted_duration_cost_excl_tax: r.giftedDurationCostExclTax,
    gross_profit: r.grossProfit,
    deal_unit_price_per_hour: r.dealUnitPricePerHour,
    list_price_per_hour: r.listPricePerHour,
    pricing_snapshot_id: r.pricingSnapshotId,
    source_line_ids: r.sourceLineIds,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt?.toISOString() ?? null,
  }
}

function mapAdjustmentHistoryRow(
  r: typeof voucherCardHoursAdjustmentHistory.$inferSelect,
): VoucherCardHoursAdjustmentHistoryEntry {
  return {
    id: r.id,
    cost_id: r.costId,
    balance_card_hours_before: r.balanceCardHoursBefore,
    balance_card_hours_after: r.balanceCardHoursAfter,
    adjustment_hours: r.adjustmentHours,
    sold_duration_cost_excl_tax_before: r.soldDurationCostExclTaxBefore,
    sold_duration_cost_excl_tax_after: r.soldDurationCostExclTaxAfter,
    gross_profit_before: r.grossProfitBefore,
    gross_profit_after: r.grossProfitAfter,
    unit_price_per_hour: r.unitPricePerHour,
    reason: r.reason,
    created_at: r.createdAt.toISOString(),
  }
}

export async function listBalanceCardHoursAdjustmentHistories(
  billingPeriodId: string,
): Promise<Record<string, VoucherCardHoursAdjustmentHistoryEntry[]>> {
  const costRows = await db
    .select({ id: platformCostMonthly.id })
    .from(platformCostMonthly)
    .where(eq(platformCostMonthly.billingPeriodId, billingPeriodId))

  const costIds = costRows.map((r) => r.id)
  if (costIds.length === 0) return {}

  const histories = await db
    .select()
    .from(voucherCardHoursAdjustmentHistory)
    .where(inArray(voucherCardHoursAdjustmentHistory.costId, costIds))

  const grouped: Record<string, VoucherCardHoursAdjustmentHistoryEntry[]> = {}
  for (const row of histories) {
    const entry = mapAdjustmentHistoryRow(row)
    const list = grouped[row.costId] ?? []
    list.push(entry)
    grouped[row.costId] = list
  }
  for (const id of Object.keys(grouped)) {
    grouped[id]!.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  return grouped
}

export async function applyBalanceCardHoursAdjustment(input: {
  costId: string
  adjustmentHours: number
  reason: string
  unitPricePerHour?: number
  actorId?: string | null
}): Promise<VoucherCardHoursAdjustmentHistoryEntry> {
  const record = await db.query.platformCostMonthly.findFirst({
    where: eq(platformCostMonthly.id, input.costId),
  })
  if (!record || record.type !== 'record') {
    throw new FinanceError('NOT_FOUND', '成本分项不存在')
  }

  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, record.billingPeriodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  if (period.status !== 'computed' && period.status !== 'adjusted') {
    throw new FinanceError('PRECONDITION_FAILED', '仅已计算或已调账账期可执行余额卡时调账')
  }

  const rowDto = mapPlatformCostMonthlyRow(record)
  const unitPrice =
    input.unitPricePerHour ?? resolveUnitPricePerHour(rowDto) ?? null
  if (unitPrice == null || unitPrice <= 0) {
    throw new FinanceError('BAD_REQUEST', '未找到该机房的卡型单价，无法调账')
  }
  if (input.adjustmentHours === 0) {
    throw new FinanceError('BAD_REQUEST', '调账卡时不能为 0')
  }

  const originalHours = Number(record.balanceCardHours ?? 0)
  if (originalHours + input.adjustmentHours < 0) {
    throw new FinanceError('BAD_REQUEST', '调账后余额卡时不能为负')
  }

  const adjustmentAmount =
    input.adjustmentHours * unitPrice
  const balanceConsumption = Number(record.balanceConsumption ?? 0)
  if (balanceConsumption + adjustmentAmount < 0) {
    throw new FinanceError('BAD_REQUEST', '调账后余额消费不能为负')
  }

  const derived = deriveCostFieldsAfterBalanceAdjustment({
    row: rowDto,
    adjustmentHours: input.adjustmentHours,
    unitPricePerHour: unitPrice,
  })

  const now = new Date()
  const historyId = newId()

  await db.transaction(async (tx) => {
    await tx
      .update(platformCostMonthly)
      .set({
        balanceCardHours: derived.balanceCardHoursAfter,
        balanceConsumption: derived.balanceConsumptionAfter,
        confirmedRevenueExclTax: derived.confirmedRevenueExclTax,
        soldDurationCostExclTax: derived.soldDurationCostExclTax,
        grossProfit: derived.grossProfit,
        updatedAt: now,
      })
      .where(eq(platformCostMonthly.id, input.costId))

    const allRows = await tx
      .select()
      .from(platformCostMonthly)
      .where(eq(platformCostMonthly.billingPeriodId, record.billingPeriodId))

    const dtos = allRows.map(mapPlatformCostMonthlyRow)
    const recomputed = recomputeCostSumRows(dtos)

    for (const sumRow of recomputed.filter((r) => r.type === 'sum')) {
      await tx
        .update(platformCostMonthly)
        .set({
          balanceConsumption: sumRow.balance_consumption,
          balanceCardHours: sumRow.balance_card_hours,
          voucherCardHours: sumRow.voucher_card_hours,
          confirmedRevenueExclTax: sumRow.confirmed_revenue_excl_tax,
          soldDurationCostExclTax: sumRow.sold_duration_cost_excl_tax,
          giftedDurationCostExclTax: sumRow.gifted_duration_cost_excl_tax,
          grossProfit: sumRow.gross_profit,
          updatedAt: now,
        })
        .where(eq(platformCostMonthly.id, sumRow.id))
    }

    await tx.insert(voucherCardHoursAdjustmentHistory).values({
      id: historyId,
      costId: input.costId,
      balanceCardHoursBefore: record.balanceCardHours,
      balanceCardHoursAfter: derived.balanceCardHoursAfter,
      adjustmentHours: String(input.adjustmentHours),
      soldDurationCostExclTaxBefore: record.soldDurationCostExclTax,
      soldDurationCostExclTaxAfter: derived.soldDurationCostExclTax,
      grossProfitBefore: record.grossProfit,
      grossProfitAfter: derived.grossProfit,
      unitPricePerHour: String(unitPrice),
      reason: input.reason.trim(),
      createdBy: input.actorId ?? null,
      createdAt: now,
    })
  })

  const totalGross = (
    await db
      .select({ grossProfit: platformCostMonthly.grossProfit })
      .from(platformCostMonthly)
      .where(
        and(
          eq(platformCostMonthly.billingPeriodId, record.billingPeriodId),
          eq(platformCostMonthly.type, 'record'),
        ),
      )
  ).reduce((acc, r) => acc + parseMoney(r.grossProfit), 0)

  await refreshBillingPeriodPeriodTotals(record.billingPeriodId, {
    totalGrossProfit: totalGross,
    status: 'adjusted',
  })

  await appendOperationLog({
    billingPeriodId: record.billingPeriodId,
    operation: 'balance_card_hours_adjustment',
    actorId: input.actorId,
    metadata: {
      costId: input.costId,
      adjustmentHours: input.adjustmentHours,
    },
  })

  const inserted = await db.query.voucherCardHoursAdjustmentHistory.findFirst({
    where: eq(voucherCardHoursAdjustmentHistory.id, historyId),
  })
  if (!inserted) {
    throw new FinanceError('UNPROCESSABLE', '调账记录写入失败')
  }
  return mapAdjustmentHistoryRow(inserted)
}
