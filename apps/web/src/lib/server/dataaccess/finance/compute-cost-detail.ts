import { db } from '@/lib/db'
import {
  computeGiftedDurationCostExclTaxForPricing,
  computeSoldDurationCostExclTax,
  resolveTierCostContext,
} from '@/lib/finance/cost-pricing-utils'
import {
  COST_TAX_DIVISOR,
  computeGrossProfit,
  toHoursString,
} from '@/lib/finance/cost-row-utils'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import {
  billingPeriodCostDetail,
  billingPeriodImportBatch,
  billingPeriodRawTenantBill,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import type { BaremetalAggAccumulator } from './compute-cost-baremetal-agg'
import type { CostTenantProjectBinding } from './compute-cost-enrichment'
import { financeLog } from './logger'
import { newId } from './operation-log'
import {
  buildTenantBillPricingMap,
  normalizeBillingRegion,
  normalizeGpuCodeForMatch,
  pricingMapKeyForWindow,
  type ResolvedUnitCost,
} from './tenant-bill-pricing'
import type { listTenantBillWindows } from './tenant-bill-windows'

function parseNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

function parseAllocPercent(value: string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return n / 100
}

function pricingFieldString(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null
  return toMoneyString(value)
}

type SplitCostRow = {
  staffId: string
  accountManagerName: string
  projectId: string
  projectName: string
  tenantPlatformId: string
  tenantId: string
  customerId: string | null
  customerFullName: string | null
  idcCode: string
  idcName: string
  cardType: string
  pricingRegionCode: string
  pricingGpuModel: string
  windowId: string
  balanceConsumption: number
  balanceCardHours: number
  voucherCardHours: number
  allocationPercent: string | null
  sourceTenantBillRawIds: string[]
  sourceBaremetalAggId: string | null
}

type DetailAccumulator = {
  id: string
  billingPeriodId: string
  tenantPlatformId: string
  tenantId: string
  customerId: string | null
  customerFullName: string | null
  projectId: string
  projectName: string
  staffId: string
  accountManagerName: string
  windowId: string | null
  idcCode: string
  idcName: string
  cardType: string
  pricingRegionCode: string
  pricingGpuModel: string
  balanceConsumption: number
  balanceCardHours: number
  voucherCardHours: number
  allocationPercent: string | null
  sourceTenantBillRawIds: string[]
  sourceBaremetalAggId: string | null
}

function detailKey(
  staffId: string,
  projectId: string,
  idcCode: string,
  cardType: string,
): string {
  return `${staffId}::${projectId}::${idcCode}::${cardType}`
}

function staffIdcCardKey(staffId: string, idcCode: string, cardType: string): string {
  return `${staffId}::${idcCode}::${cardType}`
}

function buildSplitRowsForWindow(input: {
  periodId: string
  windowId: string
  tenantBillRows: (typeof billingPeriodRawTenantBill.$inferSelect)[]
  bindingsByTenant: Map<string, CostTenantProjectBinding>
  issues: string[]
}): SplitCostRow[] {
  const splitRows: SplitCostRow[] = []

  for (const row of input.tenantBillRows) {
    const binding = input.bindingsByTenant.get(row.tenantPlatformId)
    if (!binding || binding.projects.length === 0) {
      input.issues.push(`租户 ${row.tenantPlatformId} 无 CRM 项目绑定，跳过 tenant_bill 成本`)
      continue
    }

    const idcCode = normalizeBillingRegion(row.regionCode)
    const cardType = normalizeGpuCodeForMatch(row.gpuModel)
    const idcName = row.regionCode.trim()

    for (const proj of binding.projects) {
      let ratio = parseAllocPercent(proj.allocationPercent)
      if (ratio == null) {
        if (binding.projects.length === 1) ratio = 1
        else continue
      }
      if (!proj.staffId) {
        input.issues.push(`项目 ${proj.projectName} 无客户经理，跳过成本分项`)
        continue
      }

      splitRows.push({
        staffId: proj.staffId,
        accountManagerName: proj.accountManagerName ?? proj.staffId,
        projectId: proj.projectId,
        projectName: proj.projectName,
        tenantPlatformId: row.tenantPlatformId,
        tenantId: binding.tenantId,
        customerId: binding.customerId,
        customerFullName: binding.customerFullName,
        idcCode,
        idcName,
        cardType,
        pricingRegionCode: row.regionCode,
        pricingGpuModel: row.gpuModel,
        windowId: input.windowId,
        balanceConsumption: parseNum(row.balanceConsumption) * ratio,
        balanceCardHours: parseNum(row.balanceCardHours) * ratio,
        voucherCardHours: parseNum(row.voucherCardHours) * ratio,
        allocationPercent: proj.allocationPercent,
        sourceTenantBillRawIds: [row.id],
        sourceBaremetalAggId: null,
      })
    }
  }

  return splitRows
}

function buildBaremetalSplitRows(input: {
  baremetalByKey: Map<string, BaremetalAggAccumulator>
  bindingsByTenant: Map<string, CostTenantProjectBinding>
  issues: string[]
}): SplitCostRow[] {
  const splitRows: SplitCostRow[] = []

  for (const acc of input.baremetalByKey.values()) {
    const binding = input.bindingsByTenant.get(acc.tenantPlatformId)
    if (!binding || binding.projects.length === 0) {
      input.issues.push(`裸金属租户 ${acc.tenantPlatformId} 无 CRM 项目绑定，跳过`)
      continue
    }

    for (const proj of binding.projects) {
      let ratio = parseAllocPercent(proj.allocationPercent)
      if (ratio == null) {
        if (binding.projects.length === 1) ratio = 1
        else continue
      }
      if (!proj.staffId) {
        input.issues.push(`项目 ${proj.projectName} 无客户经理，跳过裸金属成本分项`)
        continue
      }

      splitRows.push({
        staffId: proj.staffId,
        accountManagerName: proj.accountManagerName ?? proj.staffId,
        projectId: proj.projectId,
        projectName: proj.projectName,
        tenantPlatformId: acc.tenantPlatformId,
        tenantId: binding.tenantId,
        customerId: binding.customerId,
        customerFullName: binding.customerFullName,
        idcCode: acc.idcCode,
        idcName: acc.idcName ?? acc.idcCode,
        cardType: acc.cardType,
        pricingRegionCode: acc.idcCode,
        pricingGpuModel: acc.cardType,
        windowId: '',
        balanceConsumption: acc.balanceConsumption * ratio,
        balanceCardHours: acc.balanceCardHours * ratio,
        voucherCardHours: 0,
        allocationPercent: proj.allocationPercent,
        sourceTenantBillRawIds: [],
        sourceBaremetalAggId: acc.id,
      })
    }
  }

  return splitRows
}

function mergeSplitRows(rows: SplitCostRow[], periodId: string): Map<string, DetailAccumulator> {
  const map = new Map<string, DetailAccumulator>()

  for (const row of rows) {
    const key = detailKey(row.staffId, row.projectId, row.idcCode, row.cardType)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        id: newId(),
        billingPeriodId: periodId,
        tenantPlatformId: row.tenantPlatformId,
        tenantId: row.tenantId,
        customerId: row.customerId,
        customerFullName: row.customerFullName,
        projectId: row.projectId,
        projectName: row.projectName,
        staffId: row.staffId,
        accountManagerName: row.accountManagerName,
        windowId: row.windowId || null,
        idcCode: row.idcCode,
        idcName: row.idcName,
        cardType: row.cardType,
        pricingRegionCode: row.pricingRegionCode,
        pricingGpuModel: row.pricingGpuModel,
        balanceConsumption: row.balanceConsumption,
        balanceCardHours: row.balanceCardHours,
        voucherCardHours: row.voucherCardHours,
        allocationPercent: row.allocationPercent,
        sourceTenantBillRawIds: [...row.sourceTenantBillRawIds],
        sourceBaremetalAggId: row.sourceBaremetalAggId,
      })
      continue
    }

    existing.balanceConsumption += row.balanceConsumption
    existing.balanceCardHours += row.balanceCardHours
    existing.voucherCardHours += row.voucherCardHours
    existing.sourceTenantBillRawIds.push(...row.sourceTenantBillRawIds)
    if (row.sourceBaremetalAggId) {
      existing.sourceBaremetalAggId = row.sourceBaremetalAggId
    }
    if (row.windowId && !existing.windowId) {
      existing.windowId = row.windowId
    } else if (row.windowId && existing.windowId && row.windowId !== existing.windowId) {
      existing.windowId = null
    }
  }

  return map
}

function applyPricingToDetails(input: {
  details: Map<string, DetailAccumulator>
  pricingMap: Map<string, ResolvedUnitCost>
  windowIds: string[]
  issues: string[]
}): (typeof billingPeriodCostDetail.$inferInsert)[] {
  const tierContextByStaffIdcCard = new Map<
    string,
    ReturnType<typeof resolveTierCostContext>
  >()

  for (const detail of input.details.values()) {
    const staffKey = staffIdcCardKey(detail.staffId, detail.idcCode, detail.cardType)
    if (tierContextByStaffIdcCard.has(staffKey)) continue

    let pricing: ResolvedUnitCost | undefined
    for (const windowId of input.windowIds) {
      pricing = input.pricingMap.get(
        pricingMapKeyForWindow(windowId, detail.pricingRegionCode, detail.pricingGpuModel),
      )
      if (pricing) break
    }

    if (!pricing) {
      input.issues.push(
        `缺成本配置 staff=${detail.staffId} idc=${detail.idcCode} card=${detail.cardType}`,
      )
      continue
    }

    tierContextByStaffIdcCard.set(
      staffKey,
      resolveTierCostContext(pricing, {
        balanceConsumption: detail.balanceConsumption,
        balanceCardHours: detail.balanceCardHours,
        voucherCardHours: detail.voucherCardHours,
      }),
    )
  }

  const dbRows: (typeof billingPeriodCostDetail.$inferInsert)[] = []

  for (const detail of input.details.values()) {
    let pricing: ResolvedUnitCost | undefined
    for (const windowId of input.windowIds) {
      pricing = input.pricingMap.get(
        pricingMapKeyForWindow(windowId, detail.pricingRegionCode, detail.pricingGpuModel),
      )
      if (pricing) break
    }
    if (!pricing) continue

    const tierCtx = tierContextByStaffIdcCard.get(
      staffIdcCardKey(detail.staffId, detail.idcCode, detail.cardType),
    )
    const metrics = {
      balanceConsumption: detail.balanceConsumption,
      balanceCardHours: detail.balanceCardHours,
      voucherCardHours: detail.voucherCardHours,
    }
    const confirmed = detail.balanceConsumption / COST_TAX_DIVISOR
    const sold = computeSoldDurationCostExclTax(pricing, metrics, tierCtx ?? undefined)
    const gifted = computeGiftedDurationCostExclTaxForPricing(
      pricing,
      metrics,
      tierCtx ?? undefined,
    )
    const gross = computeGrossProfit(confirmed, sold, gifted)

    dbRows.push({
      id: detail.id,
      billingPeriodId: detail.billingPeriodId,
      tenantPlatformId: detail.tenantPlatformId,
      tenantId: detail.tenantId,
      customerId: detail.customerId,
      customerFullName: detail.customerFullName,
      projectId: detail.projectId,
      projectName: detail.projectName,
      staffId: detail.staffId,
      accountManagerName: detail.accountManagerName,
      windowId: detail.windowId,
      idcCode: detail.idcCode,
      idcName: detail.idcName,
      cardType: detail.cardType,
      balanceConsumption: toMoneyString(detail.balanceConsumption),
      balanceCardHours: toHoursString(detail.balanceCardHours),
      voucherCardHours: toHoursString(detail.voucherCardHours),
      supplierUnitCostId: pricing.supplierUnitCostId,
      dealUnitPricePerHour: pricingFieldString(pricing.unitPricePerHour),
      listPricePerHour: pricingFieldString(pricing.listPricePerHour),
      confirmedRevenueExclTax: toMoneyString(confirmed),
      soldDurationCostExclTax: toMoneyString(sold),
      giftedDurationCostExclTax: toMoneyString(gifted),
      grossProfit: toMoneyString(gross),
      allocationPercent: detail.allocationPercent,
      sourceTenantBillRawIds:
        detail.sourceTenantBillRawIds.length > 0 ? detail.sourceTenantBillRawIds : null,
      sourceBaremetalAggId: detail.sourceBaremetalAggId,
    })
  }

  return dbRows
}

export async function buildAndPersistCostDetail(input: {
  billingPeriodId: string
  windows: Awaited<ReturnType<typeof listTenantBillWindows>>
  bindings: CostTenantProjectBinding[]
  baremetalByKey: Map<string, BaremetalAggAccumulator>
  issues: string[]
}): Promise<(typeof billingPeriodCostDetail.$inferInsert)[]> {
  const { billingPeriodId: periodId, windows, bindings, baremetalByKey, issues } = input
  const bindingsByTenant = new Map(bindings.map((b) => [b.tenantPlatformId, b]))

  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const tenantBillBatches = batches.filter((b) => b.fileType === 'tenant_bill')

  const splitRows: SplitCostRow[] = []

  for (const window of windows) {
    const batch = tenantBillBatches.find((b) => b.windowId === window.id)
    if (!batch) continue
    const rows = await db
      .select()
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
    splitRows.push(
      ...buildSplitRowsForWindow({
        periodId,
        windowId: window.id,
        tenantBillRows: rows,
        bindingsByTenant,
        issues,
      }),
    )
  }

  splitRows.push(
    ...buildBaremetalSplitRows({
      baremetalByKey,
      bindingsByTenant,
      issues,
    }),
  )

  const merged = mergeSplitRows(splitRows, periodId)
  const pricingMap = await buildTenantBillPricingMap({ periodId })
  const windowIds = windows.map((w) => w.id)
  const dbRows = applyPricingToDetails({
    details: merged,
    pricingMap,
    windowIds,
    issues,
  })

  if (dbRows.length > 0) {
    await db.insert(billingPeriodCostDetail).values(dbRows)
  }

  financeLog('compute-cost-detail', 'done', { periodId, detailCount: dbRows.length })
  return dbRows
}

export type CostDetailRow = typeof billingPeriodCostDetail.$inferInsert
