import { db } from '@/lib/db'
import { platformCostMonthly } from '@workspace/db/schema'
import { parseMoney, toMoneyString } from '@/lib/finance/income-row-utils'
import { toHoursString } from '@/lib/finance/cost-row-utils'
import { financeLog } from './logger'
import { newId } from './operation-log'
import type { CostDetailRow } from './compute-cost-detail'

type RollupAccumulator = {
  id: string
  billingPeriodId: string
  staffId: string
  staffName: string
  accountManager: string
  idcCode: string
  idcName: string | null
  cardType: string
  balanceConsumption: number
  balanceCardHours: number
  voucherCardHours: number
  confirmedRevenueExclTax: number
  soldDurationCostExclTax: number
  giftedDurationCostExclTax: number
  grossProfit: number
  dealUnitPricePerHour: string | null
  listPricePerHour: string | null
  supplierUnitCostId: string | null
}

function rollupKey(staffId: string, idcCode: string, cardType: string): string {
  return `${staffId}::${idcCode}::${cardType}`
}

export async function rollupCostDetailToPlatformMonthly(
  details: CostDetailRow[],
): Promise<number> {
  if (details.length === 0) return 0

  const periodId = details[0]!.billingPeriodId!
  const bucket = new Map<string, RollupAccumulator>()

  for (const row of details) {
    const key = rollupKey(row.staffId, row.idcCode, row.cardType)
    const existing = bucket.get(key)
    if (!existing) {
      bucket.set(key, {
        id: newId(),
        billingPeriodId: periodId,
        staffId: row.staffId,
        staffName: row.accountManagerName ?? row.staffId,
        accountManager: row.accountManagerName ?? row.staffId,
        idcCode: row.idcCode,
        idcName: row.idcName ?? null,
        cardType: row.cardType,
        balanceConsumption: parseMoney(row.balanceConsumption),
        balanceCardHours: Number(row.balanceCardHours ?? 0),
        voucherCardHours: Number(row.voucherCardHours ?? 0),
        confirmedRevenueExclTax: parseMoney(row.confirmedRevenueExclTax),
        soldDurationCostExclTax: parseMoney(row.soldDurationCostExclTax),
        giftedDurationCostExclTax: parseMoney(row.giftedDurationCostExclTax),
        grossProfit: parseMoney(row.grossProfit),
        dealUnitPricePerHour: row.dealUnitPricePerHour ?? null,
        listPricePerHour: row.listPricePerHour ?? null,
        supplierUnitCostId: row.supplierUnitCostId ?? null,
      })
      continue
    }

    existing.balanceConsumption += parseMoney(row.balanceConsumption)
    existing.balanceCardHours += Number(row.balanceCardHours ?? 0)
    existing.voucherCardHours += Number(row.voucherCardHours ?? 0)
    existing.confirmedRevenueExclTax += parseMoney(row.confirmedRevenueExclTax)
    existing.soldDurationCostExclTax += parseMoney(row.soldDurationCostExclTax)
    existing.giftedDurationCostExclTax += parseMoney(row.giftedDurationCostExclTax)
    existing.grossProfit += parseMoney(row.grossProfit)
  }

  const dbRows = [...bucket.values()].map((r) => ({
    id: r.id,
    billingPeriodId: r.billingPeriodId,
    type: 'record' as const,
    staffId: r.staffId,
    staffName: r.staffName,
    accountManager: r.accountManager,
    projectId: null,
    supplierUnitCostId: r.supplierUnitCostId,
    idcName: r.idcName,
    idcCode: r.idcCode,
    cardType: r.cardType,
    balanceConsumption: toMoneyString(r.balanceConsumption),
    balanceCardHours: toHoursString(r.balanceCardHours),
    voucherCardHours: toHoursString(r.voucherCardHours),
    confirmedRevenueExclTax: toMoneyString(r.confirmedRevenueExclTax),
    soldDurationCostExclTax: toMoneyString(r.soldDurationCostExclTax),
    giftedDurationCostExclTax: toMoneyString(r.giftedDurationCostExclTax),
    grossProfit: toMoneyString(r.grossProfit),
    dealUnitPricePerHour: r.dealUnitPricePerHour,
    listPricePerHour: r.listPricePerHour,
    sourceRawIds: null,
  }))

  await db.insert(platformCostMonthly).values(dbRows)
  financeLog('compute-cost-rollup', 'done', { periodId, rollupCount: dbRows.length })
  return dbRows.length
}
