import { db } from '@/lib/db'
import {
  computeGiftedDurationCostExclTaxForPricing,
  computeSoldDurationCostExclTax,
  resolveTierCostContext,
} from '@/lib/finance/cost-pricing-utils'
import {
  COST_TAX_DIVISOR,
  computeGrossProfit,
  recomputeStaffSumRows,
} from '@/lib/finance/cost-row-utils'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import type { PlatformCostMonthly } from '@/lib/types/finance'
import {
  billingPeriod,
  billingPeriodAggCustomerConsumption,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawCustomerConsumption,
  billingPeriodRawTenantBill,
  billingPeriodReconciliationReport,
  billingPeriodTenantProjectEnrichment,
  billingTenantCostAllocation,
  platformCostMonthly,
  platformIncomeMonthly,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { RULE_VERSION } from './constants'
import { FinanceError } from './errors'
import { computePeriodIncome } from './compute-income'
import { listTenantProjectBindings } from './enrichment'
import { financeError, financeLog, financeWarn } from './logger'
import { appendOperationLog, newId } from './operation-log'
import { purgeBillingPeriodArtifacts } from './purge'
import {
  buildTenantBillPricingMap,
  findMissingBaremetalPlatformListPrice,
  findMissingTenantBillPricing,
  pricingMapKeyForWindow,
  type ResolvedUnitCost,
} from './tenant-bill-pricing'
import { listTenantBillWindows, syncTenantBillWindowsForPeriod } from './tenant-bill-windows'
import { asOfFromOrderedAt } from './platform-list-price'
import { validateCrossFileImports } from './validate-import'

function parseNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

async function loadCurrentRaw(periodId: string) {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const customerBatch = batches.find((b) => b.fileType === 'customer_consumption')
  const baremetalBatch = batches.find((b) => b.fileType === 'baremetal_order')
  const tenantBillBatches = batches.filter((b) => b.fileType === 'tenant_bill')
  if (!customerBatch || !baremetalBatch || tenantBillBatches.length === 0) {
    throw new FinanceError('PRECONDITION_FAILED', '请先上传全部 Excel 文件')
  }

  const windows = await listTenantBillWindows(periodId)
  if (windows.length === 0 || tenantBillBatches.length !== windows.length) {
    throw new FinanceError('PRECONDITION_FAILED', '客户账单时间段未就绪，请重新校验账期')
  }

  const [customerRows, baremetalRows, tenantBillByWindow] = await Promise.all([
    db
      .select()
      .from(billingPeriodRawCustomerConsumption)
      .where(eq(billingPeriodRawCustomerConsumption.batchId, customerBatch.id)),
    db
      .select()
      .from(billingPeriodRawBaremetalOrder)
      .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id)),
    Promise.all(
      windows.map(async (window) => {
        const batch = tenantBillBatches.find((b) => b.windowId === window.id)
        if (!batch) {
          throw new FinanceError(
            'PRECONDITION_FAILED',
            `缺少时间段 ${window.windowStart} ~ ${window.windowEnd} 的客户账单`,
          )
        }
        const rows = await db
          .select()
          .from(billingPeriodRawTenantBill)
          .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
        return { window, rows }
      }),
    ),
  ])

  const tenantBillRows = tenantBillByWindow.flatMap((x) => x.rows)

  return { customerRows, baremetalRows, tenantBillRows, tenantBillByWindow }
}

function buildAggRowsForCost(
  rows: (typeof billingPeriodAggCustomerConsumption.$inferSelect)[],
) {
  return rows.map((a) => ({
    tenantPlatformId: a.tenantPlatformId,
    customerType: a.customerType,
    balanceConsumption: a.balanceConsumption,
  }))
}

type SplitCostRow = {
  staffId: string
  accountManager: string
  projectId: string
  regionCode: string
  gpuModel: string
  balanceConsumption: number
  balanceCardHours: number
  voucherCardHours: number
}

function pricingMapKey(regionCode: string, gpuModel: string): string {
  return `${regionCode}::${gpuModel}`
}

function staffRegionGpuKey(staffId: string, regionCode: string, gpuModel: string): string {
  return `${staffId}::${regionCode}::${gpuModel}`
}

function recordKey(
  staffId: string,
  projectId: string,
  regionCode: string,
  gpuModel: string,
): string {
  return `${staffId}::${projectId}::${regionCode}::${gpuModel}`
}

function pricingFieldString(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null
  return toMoneyString(value)
}

type CostRecordRow = PlatformCostMonthly & { project_id?: string }

function buildCostRecords(input: {
  periodId: string
  windowId: string
  tenantBillRows: (typeof billingPeriodRawTenantBill.$inferSelect)[]
  aggRows: ReturnType<typeof buildAggRowsForCost>
  enrichments: (typeof billingPeriodTenantProjectEnrichment.$inferSelect)[]
  allocByTenantProject: Map<string, number>
  bindings: Awaited<ReturnType<typeof listTenantProjectBindings>>
  pricingMap: Map<string, ResolvedUnitCost>
  reconciliationIssues: string[]
}): CostRecordRow[] {
  const splitRows: SplitCostRow[] = []

  for (const row of input.tenantBillRows) {
    const aggB = input.aggRows.find(
      (a) => a.tenantPlatformId === row.tenantPlatformId && a.customerType === 'B',
    )
    if (!aggB) continue

    const tenantProjects = input.enrichments.filter(
      (e) => e.tenantPlatformId === row.tenantPlatformId,
    )
    if (tenantProjects.length === 0) {
      input.reconciliationIssues.push(`租户 ${row.tenantPlatformId} 无关联项目，跳过成本`)
      continue
    }

    for (const proj of tenantProjects) {
      const allocKey = `${row.tenantPlatformId}::${proj.projectId}`
      let ratio = input.allocByTenantProject.get(allocKey)
      if (ratio == null) {
        if (tenantProjects.length === 1) ratio = 1
        else continue
      }
      if (!proj.staffId) {
        input.reconciliationIssues.push(
          `项目 ${proj.projectName} 无客户经理，跳过成本分项`,
        )
        continue
      }

      splitRows.push({
        staffId: proj.staffId,
        accountManager: proj.accountManagerName ?? proj.staffId,
        projectId: proj.projectId,
        regionCode: row.regionCode,
        gpuModel: row.gpuModel,
        balanceConsumption: parseNum(row.balanceConsumption) * ratio,
        balanceCardHours: parseNum(row.balanceCardHours) * ratio,
        voucherCardHours: parseNum(row.voucherCardHours) * ratio,
      })
    }
  }

  const staffRegionTotals = new Map<
    string,
    {
      balanceConsumption: number
      balanceCardHours: number
      voucherCardHours: number
      regionCode: string
      gpuModel: string
      staffId: string
    }
  >()

  for (const row of splitRows) {
    const key = staffRegionGpuKey(row.staffId, row.regionCode, row.gpuModel)
    const cur = staffRegionTotals.get(key) ?? {
      balanceConsumption: 0,
      balanceCardHours: 0,
      voucherCardHours: 0,
      regionCode: row.regionCode,
      gpuModel: row.gpuModel,
      staffId: row.staffId,
    }
    cur.balanceConsumption += row.balanceConsumption
    cur.balanceCardHours += row.balanceCardHours
    cur.voucherCardHours += row.voucherCardHours
    staffRegionTotals.set(key, cur)
  }

  const tierContextByStaffRegion = new Map<
    string,
    ReturnType<typeof resolveTierCostContext>
  >()

  for (const [key, totals] of staffRegionTotals) {
    const pricing = input.pricingMap.get(
      pricingMapKeyForWindow(input.windowId, totals.regionCode, totals.gpuModel),
    )
    if (!pricing) {
      input.reconciliationIssues.push(
        `缺成本配置 staff=${totals.staffId} region=${totals.regionCode} gpu=${totals.gpuModel}`,
      )
      continue
    }
    tierContextByStaffRegion.set(
      key,
      resolveTierCostContext(pricing, {
        balanceConsumption: totals.balanceConsumption,
        balanceCardHours: totals.balanceCardHours,
        voucherCardHours: totals.voucherCardHours,
      }),
    )
  }

  const recordMap = new Map<string, CostRecordRow>()

  for (const row of splitRows) {
    const pricing = input.pricingMap.get(
      pricingMapKeyForWindow(input.windowId, row.regionCode, row.gpuModel),
    )
    if (!pricing) continue

    const tierCtx = tierContextByStaffRegion.get(
      staffRegionGpuKey(row.staffId, row.regionCode, row.gpuModel),
    )
    const metrics = {
      balanceConsumption: row.balanceConsumption,
      balanceCardHours: row.balanceCardHours,
      voucherCardHours: row.voucherCardHours,
    }
    const confirmed = row.balanceConsumption / COST_TAX_DIVISOR
    const sold = computeSoldDurationCostExclTax(pricing, metrics, tierCtx ?? undefined)
    const gifted = computeGiftedDurationCostExclTaxForPricing(
      pricing,
      metrics,
      tierCtx ?? undefined,
    )
    const gross = computeGrossProfit(confirmed, sold, gifted)

    const rKey = recordKey(row.staffId, row.projectId, row.regionCode, row.gpuModel)
    const existing = recordMap.get(rKey)
    if (existing) {
      const mergeBalance =
        parseNum(existing.balance_consumption) + row.balanceConsumption
      const mergeHours = parseNum(existing.balance_card_hours) + row.balanceCardHours
      const mergeVoucher = parseNum(existing.voucher_card_hours) + row.voucherCardHours
      const mergeConfirmed = mergeBalance / COST_TAX_DIVISOR
      const mergeMetrics = {
        balanceConsumption: mergeBalance,
        balanceCardHours: mergeHours,
        voucherCardHours: mergeVoucher,
      }
      const mergeSold = computeSoldDurationCostExclTax(pricing, mergeMetrics, tierCtx ?? undefined)
      const mergeGifted = computeGiftedDurationCostExclTaxForPricing(
        pricing,
        mergeMetrics,
        tierCtx ?? undefined,
      )
      recordMap.set(rKey, {
        ...existing,
        balance_consumption: toMoneyString(mergeBalance),
        balance_card_hours: mergeHours.toFixed(4),
        voucher_card_hours: mergeVoucher.toFixed(4),
        confirmed_revenue_excl_tax: toMoneyString(mergeConfirmed),
        sold_duration_cost_excl_tax: toMoneyString(mergeSold),
        gifted_duration_cost_excl_tax: toMoneyString(mergeGifted),
        gross_profit: toMoneyString(
          computeGrossProfit(mergeConfirmed, mergeSold, mergeGifted),
        ),
      })
      continue
    }

    recordMap.set(rKey, {
      id: newId(),
      billing_period_id: input.periodId,
      type: 'record',
      staff_id: row.staffId,
      account_manager: row.accountManager,
      project_id: row.projectId,
      supplier_unit_cost_id: pricing.supplierUnitCostId,
      idc_name: row.regionCode,
      idc_code: row.regionCode,
      card_type: row.gpuModel,
      balance_consumption: toMoneyString(row.balanceConsumption),
      balance_card_hours: row.balanceCardHours.toFixed(4),
      voucher_card_hours: row.voucherCardHours.toFixed(4),
      confirmed_revenue_excl_tax: toMoneyString(confirmed),
      sold_duration_cost_excl_tax: toMoneyString(sold),
      gifted_duration_cost_excl_tax: toMoneyString(gifted),
      gross_profit: toMoneyString(gross),
      deal_unit_price_per_hour: pricingFieldString(pricing.unitPricePerHour),
      list_price_per_hour: pricingFieldString(pricing.listPricePerHour),
      created_at: new Date().toISOString(),
      updated_at: null,
    })
  }

  return [...recordMap.values()]
}

export async function computeBillingPeriod(input: {
  billingPeriodId: string
  actorId?: string | null
}): Promise<{ incomeCount: number; costCount: number; status: string }> {
  const periodId = input.billingPeriodId
  financeLog('compute', 'start', { periodId, ruleVersion: RULE_VERSION })

  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  if (period.status === 'published' || period.status === 'adjusted') {
    throw new FinanceError('CONFLICT', '已发布账期不可直接重算，请先撤回发布')
  }
  if (period.status === 'void') {
    throw new FinanceError('CONFLICT', '作废账期不可计算')
  }
  if (period.status === 'import_error') {
    throw new FinanceError('PRECONDITION_FAILED', '导入存在错误，请修正 Excel 后重新上传')
  }
  if (period.status === 'pending_pricing') {
    throw new FinanceError(
      'UNPROCESSABLE',
      '账单区域×卡型缺少机房卡型成本配置，请先维护供应商单价',
    )
  }
  if (period.status !== 'imported' && period.status !== 'computed') {
    throw new FinanceError('PRECONDITION_FAILED', '请先完成三类 Excel 导入且校验通过')
  }

  const cross = await validateCrossFileImports(periodId)
  if (!cross.ok) {
    await db
      .update(billingPeriod)
      .set({ status: 'import_error' })
      .where(eq(billingPeriod.id, periodId))
    throw new FinanceError(
      'PRECONDITION_FAILED',
      '存在 B 端未知租户，请下载错误明细 Excel 修正后重新上传',
    )
  }

  const missingPricing = [
    ...(await findMissingTenantBillPricing({ periodId })),
    ...(await findMissingBaremetalPlatformListPrice({ periodId })),
  ]
  if (missingPricing.length > 0) {
    await db
      .update(billingPeriod)
      .set({ status: 'pending_pricing' })
      .where(eq(billingPeriod.id, periodId))
    const sample = missingPricing
      .slice(0, 3)
      .map((p) => `${p.regionCode}×${p.gpuModel}(${p.failureReason})`)
      .join('、')
    throw new FinanceError(
      'UNPROCESSABLE',
      `${missingPricing.length} 个区域×卡型缺少机房卡型成本配置（如 ${sample}）`,
    )
  }

  const bindings = await listTenantProjectBindings(periodId)
  const pendingTenants = bindings.filter(
    (b) =>
      b.projects.length >= 2 &&
      b.projects.some((p) => p.allocationPercent == null),
  )
  if (pendingTenants.length > 0) {
    await db
      .update(billingPeriod)
      .set({ status: 'pending_allocation' })
      .where(eq(billingPeriod.id, periodId))
    financeWarn('compute', 'blocked: pending allocation', {
      periodId,
      tenants: pendingTenants.map((t) => t.tenantPlatformId),
    })
    throw new FinanceError(
      'UNPROCESSABLE',
      `${pendingTenants.length} 个租户需配置成本分成比例后方可计算`,
    )
  }

  await purgeBillingPeriodArtifacts({
    billingPeriodId: periodId,
    scope: 'derived',
    actorId: input.actorId,
  })

  await syncTenantBillWindowsForPeriod(periodId)

  const { customerRows, baremetalRows, tenantBillRows, tenantBillByWindow } =
    await loadCurrentRaw(periodId)
  financeLog('compute', 'raw loaded', {
    periodId,
    customer: customerRows.length,
    baremetal: baremetalRows.length,
    tenantBill: tenantBillRows.length,
  })

  const bBalanceByTenant = new Map<string, number>()
  for (const row of tenantBillRows) {
    const cur = bBalanceByTenant.get(row.tenantPlatformId) ?? 0
    bBalanceByTenant.set(
      row.tenantPlatformId,
      cur + parseNum(row.balanceConsumption),
    )
  }

  const reconciliationIssues: string[] = []

  const baremetalListPriceNotes: string[] = []
  for (const row of baremetalRows) {
    const deviceModel = row.deviceModel?.trim() ?? ''
    if (deviceModel) {
      baremetalListPriceNotes.push(
        `baremetal_order=${row.orderId} model=${deviceModel} ordered_at=${asOfFromOrderedAt(row.orderedAt)}`,
      )
    }
  }
  reconciliationIssues.push(...baremetalListPriceNotes.slice(0, 50))

  let incomeResult: Awaited<ReturnType<typeof computePeriodIncome>>
  try {
    incomeResult = await computePeriodIncome({
      periodId,
      customerRows,
      baremetalRows,
      tenantBillBalanceByTenant: bBalanceByTenant,
      bindings,
    })
  } catch (error) {
    if (error instanceof FinanceError && error.code === 'PRECONDITION_FAILED') {
      await db
        .update(billingPeriod)
        .set({ status: 'import_error' })
        .where(eq(billingPeriod.id, periodId))
    }
    throw error
  }

  reconciliationIssues.push(...incomeResult.reconciliationIssues)
  financeLog('compute', 'income written', {
    periodId,
    count: incomeResult.incomeCount,
  })

  const aggDbRows = await db
    .select()
    .from(billingPeriodAggCustomerConsumption)
    .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
  const aggRows = buildAggRowsForCost(aggDbRows)

  const enrichments = await db
    .select()
    .from(billingPeriodTenantProjectEnrichment)
    .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, periodId))

  const allocations = await db
    .select()
    .from(billingTenantCostAllocation)
    .where(eq(billingTenantCostAllocation.billingPeriodId, periodId))

  const allocByTenantProject = new Map<string, number>()
  for (const a of allocations) {
    allocByTenantProject.set(
      `${a.tenantPlatformId}::${a.projectId}`,
      parseNum(a.allocationPercent) / 100,
    )
  }
  for (const b of bindings) {
    if (b.projects.length === 1) {
      allocByTenantProject.set(
        `${b.tenantPlatformId}::${b.projects[0]!.projectId}`,
        1,
      )
    }
  }

  const pricingMap = await buildTenantBillPricingMap({ periodId })

  const costRecordRows: CostRecordRow[] = []
  for (const { window, rows } of tenantBillByWindow) {
    const windowCosts = buildCostRecords({
      periodId,
      windowId: window.id,
      tenantBillRows: rows,
      aggRows,
      enrichments,
      allocByTenantProject,
      bindings,
      pricingMap,
      reconciliationIssues,
    })
    costRecordRows.push(...windowCosts)
  }

  const mergedCostMap = new Map<string, CostRecordRow>()
  for (const row of costRecordRows) {
    const key = recordKey(
      row.staff_id,
      row.project_id ?? '',
      row.idc_code ?? '',
      row.card_type ?? '',
    )
    const existing = mergedCostMap.get(key)
    if (!existing) {
      mergedCostMap.set(key, row)
      continue
    }
    const mergeBalance =
      parseNum(existing.balance_consumption) + parseNum(row.balance_consumption)
    const mergeHours = parseNum(existing.balance_card_hours) + parseNum(row.balance_card_hours)
    const mergeVoucher =
      parseNum(existing.voucher_card_hours) + parseNum(row.voucher_card_hours)
    const mergeConfirmed = mergeBalance / COST_TAX_DIVISOR
    mergedCostMap.set(key, {
      ...existing,
      balance_consumption: toMoneyString(mergeBalance),
      balance_card_hours: mergeHours.toFixed(4),
      voucher_card_hours: mergeVoucher.toFixed(4),
      confirmed_revenue_excl_tax: toMoneyString(mergeConfirmed),
      sold_duration_cost_excl_tax: toMoneyString(
        parseNum(existing.sold_duration_cost_excl_tax) +
          parseNum(row.sold_duration_cost_excl_tax),
      ),
      gifted_duration_cost_excl_tax: toMoneyString(
        parseNum(existing.gifted_duration_cost_excl_tax) +
          parseNum(row.gifted_duration_cost_excl_tax),
      ),
      gross_profit: toMoneyString(
        parseNum(existing.gross_profit) + parseNum(row.gross_profit),
      ),
    })
  }

  const costRecords: CostRecordRow[] = [...mergedCostMap.values()]

  const staffIds = [...new Set(costRecords.map((r) => r.staff_id))]
  for (const staffId of staffIds) {
    const staffRecords = costRecords.filter((r) => r.staff_id === staffId)
    const sumRow: PlatformCostMonthly = {
      id: newId(),
      billing_period_id: periodId,
      type: 'sum',
      staff_id: staffId,
      account_manager: staffRecords[0]?.account_manager ?? staffId,
      supplier_unit_cost_id: null,
      idc_name: null,
      idc_code: null,
      card_type: null,
      balance_consumption: '0',
      balance_card_hours: '0',
      voucher_card_hours: '0',
      confirmed_revenue_excl_tax: '0',
      sold_duration_cost_excl_tax: '0',
      gifted_duration_cost_excl_tax: '0',
      gross_profit: '0',
      deal_unit_price_per_hour: null,
      list_price_per_hour: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    }
    costRecords.push(sumRow)
  }

  const costWithSums = recomputeStaffSumRows(costRecords)
  const costDbRows: (typeof platformCostMonthly.$inferInsert)[] = costWithSums.map(
    (r) => ({
      id: r.id,
      billingPeriodId: periodId,
      type: r.type,
      staffId: r.staff_id,
      accountManager: r.account_manager,
      projectId: (r as CostRecordRow).project_id ?? null,
      supplierUnitCostId: r.supplier_unit_cost_id,
      idcName: r.idc_name,
      idcCode: r.idc_code,
      cardType: r.card_type,
      balanceConsumption: r.balance_consumption,
      balanceCardHours: r.balance_card_hours,
      voucherCardHours: r.voucher_card_hours,
      confirmedRevenueExclTax: r.confirmed_revenue_excl_tax,
      soldDurationCostExclTax: r.sold_duration_cost_excl_tax,
      giftedDurationCostExclTax: r.gifted_duration_cost_excl_tax,
      grossProfit: r.gross_profit,
      dealUnitPricePerHour: r.deal_unit_price_per_hour,
      listPricePerHour: r.list_price_per_hour,
      sourceRawIds: null,
    }),
  )

  if (costDbRows.length > 0) {
    await db.insert(platformCostMonthly).values(costDbRows)
  }
  financeLog('compute', 'cost written', { periodId, count: costDbRows.length })

  const incomeRows = await db
    .select()
    .from(platformIncomeMonthly)
    .where(eq(platformIncomeMonthly.billingPeriodId, periodId))

  let totalIncome = 0
  let balanceIncome = 0
  let baremetalIncome = 0
  let supplementary = 0
  for (const row of incomeRows) {
    totalIncome += parseNum(row.totalConsumption)
    balanceIncome += parseNum(row.balanceConsumption)
    baremetalIncome += parseNum(row.bareMetalConsumption)
    supplementary += parseNum(row.supplementaryConsumption)
  }

  const recordCosts = costWithSums.filter((r) => r.type === 'record')
  let totalCost = 0
  let totalGross = 0
  for (const r of recordCosts) {
    totalGross += parseNum(r.gross_profit)
    totalCost +=
      parseNum(r.sold_duration_cost_excl_tax) +
      parseNum(r.gifted_duration_cost_excl_tax)
  }

  await db
    .update(billingPeriod)
    .set({
      status: 'computed',
      totalIncome: toMoneyString(totalIncome),
      balanceIncome: toMoneyString(balanceIncome),
      baremetalIncome: toMoneyString(baremetalIncome),
      supplementary: toMoneyString(supplementary),
      totalCost: toMoneyString(totalCost),
      totalGrossProfit: toMoneyString(totalGross),
      lastComputedAt: new Date(),
    })
    .where(eq(billingPeriod.id, periodId))

  await db.insert(billingPeriodReconciliationReport).values({
    id: newId(),
    billingPeriodId: periodId,
    reportJson: {
      issues: reconciliationIssues,
      incomeRowCount: incomeResult.incomeCount,
      costRowCount: costDbRows.length,
      computedAt: new Date().toISOString(),
    },
    ruleVersion: RULE_VERSION,
  })

  await appendOperationLog({
    billingPeriodId: periodId,
    operation: 'compute',
    actorId: input.actorId,
    metadata: {
      ruleVersion: RULE_VERSION,
      incomeCount: incomeResult.incomeCount,
      costCount: costDbRows.length,
    },
  })

  financeLog('compute', 'done', {
    periodId,
    totalIncome,
    totalCost,
    totalGross,
    issues: reconciliationIssues.length,
  })

  return {
    incomeCount: incomeResult.incomeCount,
    costCount: costDbRows.length,
    status: 'computed',
  }
}
