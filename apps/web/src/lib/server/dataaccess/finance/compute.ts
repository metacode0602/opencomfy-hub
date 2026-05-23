import { db } from '@/lib/db'
import {
  COST_TAX_DIVISOR,
  computeGiftedDurationCostExclTax,
  computeGrossProfit,
  recomputeStaffSumRows,
} from '@/lib/finance/cost-row-utils'
import { computeTotalConsumption, toMoneyString } from '@/lib/finance/income-row-utils'
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
  billingTenant,
  billingTenantCostAllocation,
  platformCostMonthly,
  platformIncomeMonthly,
} from '@workspace/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { RULE_VERSION } from './constants'
import { FinanceError } from './errors'
import { getTenantDisplayNames, listTenantProjectBindings } from './enrichment'
import { financeError, financeLog, financeWarn } from './logger'
import { appendOperationLog, newId } from './operation-log'
import { purgeBillingPeriodArtifacts } from './purge'
import {
  findMissingTenantBillPricing,
  validateCrossFileImports,
} from './validate-import'

const DEFAULT_UNIT_PRICE = 42

function parseNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

async function loadCurrentRaw(periodId: string) {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const byType = new Map(batches.map((b) => [b.fileType, b]))
  const customerBatch = byType.get('customer_consumption')
  const baremetalBatch = byType.get('baremetal_order')
  const tenantBillBatch = byType.get('tenant_bill')
  if (!customerBatch || !baremetalBatch || !tenantBillBatch) {
    throw new FinanceError('PRECONDITION_FAILED', '请先上传三类 Excel 文件')
  }

  const [customerRows, baremetalRows, tenantBillRows] = await Promise.all([
    db
      .select()
      .from(billingPeriodRawCustomerConsumption)
      .where(eq(billingPeriodRawCustomerConsumption.batchId, customerBatch.id)),
    db
      .select()
      .from(billingPeriodRawBaremetalOrder)
      .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id)),
    db
      .select()
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, tenantBillBatch.id)),
  ])

  return { customerRows, baremetalRows, tenantBillRows }
}

function buildAggRows(
  periodId: string,
  customerRows: (typeof billingPeriodRawCustomerConsumption.$inferSelect)[],
) {
  const map = new Map<
    string,
    {
      tenantPlatformId: string
      customerType: string
      total: number
      voucher: number
      balance: number
      sourceRawIds: string[]
      rowCount: number
    }
  >()
  for (const row of customerRows) {
    const key = `${row.tenantPlatformId}::${row.customerType}`
    const cur = map.get(key) ?? {
      tenantPlatformId: row.tenantPlatformId,
      customerType: row.customerType,
      total: 0,
      voucher: 0,
      balance: 0,
      sourceRawIds: [],
      rowCount: 0,
    }
    cur.total += parseNum(row.totalConsumption)
    cur.voucher += parseNum(row.voucherConsumption)
    cur.balance += parseNum(row.balanceConsumption)
    cur.sourceRawIds.push(row.id)
    cur.rowCount += 1
    map.set(key, cur)
  }
  return [...map.values()].map((a) => ({
    id: newId(),
    billingPeriodId: periodId,
    tenantPlatformId: a.tenantPlatformId,
    customerType: a.customerType,
    totalConsumption: toMoneyString(a.total),
    voucherConsumption: toMoneyString(a.voucher),
    balanceConsumption: toMoneyString(a.balance),
    sourceRawIds: a.sourceRawIds,
    rowCountByType: a.rowCount,
  }))
}

async function resolveTenantIdMap(platformIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (platformIds.length === 0) return map
  const rows = await db
    .select({ id: billingTenant.id, platformId: billingTenant.platformTenantId })
    .from(billingTenant)
    .where(inArray(billingTenant.platformTenantId, platformIds))
  for (const t of rows) {
    if (t.platformId) map.set(t.platformId, t.id)
  }
  return map
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

  const missingPricing = await findMissingTenantBillPricing({
    periodId,
    periodEnd: period.periodEnd,
  })
  if (missingPricing.length > 0) {
    await db
      .update(billingPeriod)
      .set({ status: 'pending_pricing' })
      .where(eq(billingPeriod.id, periodId))
    const sample = missingPricing
      .slice(0, 3)
      .map((p) => `${p.regionCode}×${p.gpuModel}`)
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

  const { customerRows, baremetalRows, tenantBillRows } = await loadCurrentRaw(periodId)
  financeLog('compute', 'raw loaded', {
    periodId,
    customer: customerRows.length,
    baremetal: baremetalRows.length,
    tenantBill: tenantBillRows.length,
  })

  const aggRows = buildAggRows(periodId, customerRows)
  if (aggRows.length > 0) {
    await db.insert(billingPeriodAggCustomerConsumption).values(aggRows)
  }

  const bBalanceByTenant = new Map<string, number>()
  for (const row of tenantBillRows) {
    const cur = bBalanceByTenant.get(row.tenantPlatformId) ?? 0
    bBalanceByTenant.set(
      row.tenantPlatformId,
      cur + parseNum(row.balanceConsumption),
    )
  }

  const bareByTenant = new Map<string, number>()
  for (const row of baremetalRows) {
    const cur = bareByTenant.get(row.tenantPlatformId) ?? 0
    bareByTenant.set(row.tenantPlatformId, cur + parseNum(row.finalAmount))
  }

  const platformIds = [
    ...new Set([
      ...aggRows.map((a) => a.tenantPlatformId),
      ...tenantBillRows.map((r) => r.tenantPlatformId),
    ]),
  ]
  const tenantIdMap = await resolveTenantIdMap(platformIds)
  const tenantIds = [...new Set([...tenantIdMap.values()])]
  const displayNames = await getTenantDisplayNames(tenantIds)

  const enrichments = await db
    .select()
    .from(billingPeriodTenantProjectEnrichment)
    .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, periodId))

  const incomeInserts: (typeof platformIncomeMonthly.$inferInsert)[] = []
  const reconciliationIssues: string[] = []

  for (const agg of aggRows) {
    const tenantId = tenantIdMap.get(agg.tenantPlatformId)
    if (!tenantId) {
      if (agg.customerType === 'B') {
        throw new FinanceError(
          'PRECONDITION_FAILED',
          `B 端租户 ${agg.tenantPlatformId} 未在 CRM 中维护`,
        )
      }
      reconciliationIssues.push(`未知租户 platform_id=${agg.tenantPlatformId}`)
      continue
    }
    const bBalance = bBalanceByTenant.get(agg.tenantPlatformId) ?? 0
    const mBare = bareByTenant.get(agg.tenantPlatformId) ?? 0
    const supplementary = 0
    const balance = bBalance
    const bare = mBare
    const supStr = toMoneyString(supplementary)
    const balStr = toMoneyString(balance)
    const bareStr = toMoneyString(bare)
    const total = computeTotalConsumption({
      supplementary_consumption: supStr,
      balance_consumption: balStr,
      bare_metal_consumption: bareStr,
    })

    const cBalance = parseNum(agg.balanceConsumption)
    reconciliationIssues.push(
      `ref_gap tenant=${agg.tenantPlatformId}: ${(cBalance - bBalance - mBare).toFixed(4)}`,
    )

    const tenantEnrich = enrichments.filter(
      (e) => e.tenantPlatformId === agg.tenantPlatformId,
    )
    let projectName: string | null = null
    if (tenantEnrich.length === 1) {
      projectName = tenantEnrich[0]!.projectName
    } else if (tenantEnrich.length > 1) {
      projectName = tenantEnrich.map((e) => e.projectName).join(' / ')
    }

    const names = displayNames.get(tenantId)
    incomeInserts.push({
      id: newId(),
      billingPeriodId: periodId,
      customerType: agg.customerType,
      tenantId,
      tenantPlatformId: agg.tenantPlatformId,
      tenantName: names?.tenantName ?? agg.tenantPlatformId,
      projectName,
      customerFullName: names?.customerFullName ?? null,
      supplementaryConsumption: supStr,
      balanceConsumption: balStr,
      bareMetalConsumption: bareStr,
      totalConsumption: total,
    })
  }

  if (incomeInserts.length > 0) {
    await db.insert(platformIncomeMonthly).values(incomeInserts)
  }
  financeLog('compute', 'income written', { periodId, count: incomeInserts.length })

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

  const costRecords: PlatformCostMonthly[] = []
  const recordKeyToIdx = new Map<string, number>()

  for (const row of tenantBillRows) {
    const aggB = aggRows.find(
      (a) => a.tenantPlatformId === row.tenantPlatformId && a.customerType === 'B',
    )
    if (!aggB) continue

    const tenantProjects = enrichments.filter(
      (e) => e.tenantPlatformId === row.tenantPlatformId,
    )
    if (tenantProjects.length === 0) {
      reconciliationIssues.push(`租户 ${row.tenantPlatformId} 无关联项目，跳过成本`)
      continue
    }

    for (const proj of tenantProjects) {
      const allocKey = `${row.tenantPlatformId}::${proj.projectId}`
      let ratio = allocByTenantProject.get(allocKey)
      if (ratio == null) {
        if (tenantProjects.length === 1) ratio = 1
        else continue
      }
      if (!proj.staffId) {
        reconciliationIssues.push(
          `项目 ${proj.projectName} 无客户经理，跳过成本分项`,
        )
        continue
      }

      const balanceConsumption =
        (parseNum(row.balanceConsumption) * ratio)
      const balanceCardHours = parseNum(row.balanceCardHours) * ratio
      const voucherCardHours = parseNum(row.voucherCardHours) * ratio
      const confirmed = balanceConsumption / COST_TAX_DIVISOR
      const unitPrice = DEFAULT_UNIT_PRICE
      const sold = (unitPrice * balanceCardHours) / COST_TAX_DIVISOR
      const gifted = computeGiftedDurationCostExclTax(unitPrice, voucherCardHours)
      const gross = computeGrossProfit(confirmed, sold, gifted)

      const staffKey = `${proj.staffId}::${proj.projectId}::${row.regionCode}::${row.gpuModel}`
      const existingIdx = recordKeyToIdx.get(staffKey)
      if (existingIdx != null) {
        const ex = costRecords[existingIdx]!
        const mergeBalance = parseNum(ex.balance_consumption) + balanceConsumption
        const mergeHours = parseNum(ex.balance_card_hours) + balanceCardHours
        const mergeVoucher = parseNum(ex.voucher_card_hours) + voucherCardHours
        const mergeConfirmed = mergeBalance / COST_TAX_DIVISOR
        const mergeSold = (unitPrice * mergeHours) / COST_TAX_DIVISOR
        const mergeGifted = computeGiftedDurationCostExclTax(unitPrice, mergeVoucher)
        costRecords[existingIdx] = {
          ...ex,
          balance_consumption: toMoneyString(mergeBalance),
          balance_card_hours: mergeHours.toFixed(4),
          voucher_card_hours: mergeVoucher.toFixed(4),
          confirmed_revenue_excl_tax: toMoneyString(mergeConfirmed),
          sold_duration_cost_excl_tax: toMoneyString(mergeSold),
          gifted_duration_cost_excl_tax: toMoneyString(mergeGifted),
          gross_profit: toMoneyString(
            computeGrossProfit(mergeConfirmed, mergeSold, mergeGifted),
          ),
        }
        continue
      }

      const record: PlatformCostMonthly = {
        id: newId(),
        billing_period_id: periodId,
        type: 'record',
        staff_id: proj.staffId,
        account_manager: proj.accountManagerName ?? proj.staffId,
        supplier_unit_cost_id: null,
        idc_name: row.regionCode,
        idc_code: row.regionCode,
        card_type: row.gpuModel,
        balance_consumption: toMoneyString(balanceConsumption),
        balance_card_hours: balanceCardHours.toFixed(4),
        voucher_card_hours: voucherCardHours.toFixed(4),
        confirmed_revenue_excl_tax: toMoneyString(confirmed),
        sold_duration_cost_excl_tax: toMoneyString(sold),
        gifted_duration_cost_excl_tax: toMoneyString(gifted),
        gross_profit: toMoneyString(gross),
        created_at: new Date().toISOString(),
        updated_at: null,
      }
      recordKeyToIdx.set(staffKey, costRecords.length)
      costRecords.push(record)
    }
  }

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
      projectId: null,
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
      sourceRawIds: null,
    }),
  )

  if (costDbRows.length > 0) {
    await db.insert(platformCostMonthly).values(costDbRows)
  }
  financeLog('compute', 'cost written', { periodId, count: costDbRows.length })

  let totalIncome = 0
  let balanceIncome = 0
  let baremetalIncome = 0
  let supplementary = 0
  for (const row of incomeInserts) {
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
      incomeRowCount: incomeInserts.length,
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
      incomeCount: incomeInserts.length,
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
    incomeCount: incomeInserts.length,
    costCount: costDbRows.length,
    status: 'computed',
  }
}
