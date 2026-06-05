import { db } from '@/lib/db'
import {
  billingPeriod,
  platformCostMonthly,
  platformIncomeMonthly,
} from '@workspace/db/schema'
import { listBalanceCardHoursAdjustmentHistories } from './apply-balance-card-hours-adjustment'
import { desc, eq } from 'drizzle-orm'
import {
  computeBillingPeriodCost,
  collectCostTenantPlatformIds,
  type ComputeCostMode,
} from './compute-cost'
import { computeBillingPeriodIncome } from './compute-billing-period-income'
import { getPendingCostAllocationIssues } from './cost-tenant-resolve'
import { FinanceError } from './errors'
import { getImportSlotStatuses } from './import-slot-status'
import { financeLog } from './logger'
import { appendOperationLog, newId } from './operation-log'
import {
  ensureRegenerateCostWindow,
  purgeCostImportsForRegenerate,
} from './purge-cost'
import { listTenantProjectBindings } from './enrichment'
import { billingTenantCostAllocation } from '@workspace/db/schema'
import {
  computeTotalConsumption,
  toMoneyString,
} from '@/lib/finance/income-row-utils'
import {
  findMissingBaremetalPlatformListPrice,
  findMissingTenantBillPricing,
  findMissingTenantBillPricingAtPeriodEnd,
  readErrorReportBySlot,
  validateCrossFileImports,
} from './validate-import'
import {
  computeSinglePeriodIncome,
  previewSinglePeriodIncome,
} from './compute-single-period-income'
import { detectPlatformListPriceWindows } from './platform-list-price'
import {
  listTenantBillWindows,
  syncTenantBillWindowsForPeriod,
} from './tenant-bill-windows'
import { customerFullNamesByTenantIds } from './income-customer-enrich'
import { validateSingleIncome } from './validate-single-income'
import { listCostSourceLines as fetchCostSourceLines } from './list-cost-source-lines'
import {
  listImportTenantBindings as fetchImportTenantBindings,
  type ImportTenantBindingFilters,
} from './list-import-tenant-bindings'
import type { ImportSlotKey } from './constants'
import { SLOT_TO_FILE_TYPE } from './constants'
import { periodUsesPeriodEndCostPricing } from './billing-period-pricing-mode'

async function financeImport() {
  return import('./import')
}

async function financePurge() {
  return import('./purge')
}

export type BillingPeriodDto = {
  id: string
  period_code: string
  period_start: string
  period_end: string
  status: string
  total_income: string | null
  enterprise_income: string | null
  personal_income: string | null
  income_total: string | null
  total_cost: string | null
  project_cost: string | null
  internal_user_cost: string | null
  supplementary: string | null
  balance_income: string | null
  baremetal_income: string | null
  last_computed_at: string | null
  published_at: string | null
  ignore_list_price_windows: boolean
}

function mapPeriod(row: typeof billingPeriod.$inferSelect): BillingPeriodDto {
  return {
    id: row.id,
    period_code: row.periodCode,
    period_start: row.periodStart,
    period_end: row.periodEnd,
    status: row.status,
    total_income: row.totalIncome,
    enterprise_income: row.enterpriseIncome,
    personal_income: row.personalIncome,
    income_total: row.incomeTotal,
    total_cost: row.totalCost,
    project_cost: row.projectCost,
    internal_user_cost: row.internalUserCost,
    supplementary: row.supplementary,
    balance_income: row.balanceIncome,
    baremetal_income: row.baremetalIncome,
    last_computed_at: row.lastComputedAt?.toISOString() ?? null,
    published_at: row.publishedAt?.toISOString() ?? null,
    ignore_list_price_windows: row.ignoreListPriceWindows ?? false,
  }
}

export const financeBillingPeriodsDataAccess = {
  async list(): Promise<BillingPeriodDto[]> {
    const all = await db.select().from(billingPeriod).orderBy(desc(billingPeriod.periodStart))
    return all.filter((r) => r.status !== 'void').map(mapPeriod)
  },

  async getById(id: string): Promise<BillingPeriodDto | null> {
    const row = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, id),
    })
    return row ? mapPeriod(row) : null
  },

  async create(input: {
    periodCode: string
    periodStart: string
    periodEnd: string
    ignoreListPriceWindows?: boolean
  }): Promise<BillingPeriodDto> {
    const existing = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.periodCode, input.periodCode.trim()),
    })
    if (existing) {
      throw new FinanceError('CONFLICT', `账期编码 ${input.periodCode} 已存在`)
    }
    if (input.periodStart > input.periodEnd) {
      throw new FinanceError('BAD_REQUEST', '结束日期不能早于开始日期')
    }
    const id = newId()
    await db.insert(billingPeriod).values({
      id,
      periodCode: input.periodCode.trim(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: 'draft',
      ignoreListPriceWindows: input.ignoreListPriceWindows ?? false,
    })
    await syncTenantBillWindowsForPeriod(id)
    financeLog('period', 'created', { id, periodCode: input.periodCode })
    const row = await db.query.billingPeriod.findFirst({ where: eq(billingPeriod.id, id) })
    return mapPeriod(row!)
  },

  async listCostSourceLines(billingPeriodId: string) {
    return fetchCostSourceLines(billingPeriodId)
  },

  async listImportTenantBindings(
    billingPeriodId: string,
    filters: ImportTenantBindingFilters = {},
  ) {
    return fetchImportTenantBindings(billingPeriodId, filters)
  },

  async getBundle(periodId: string) {
    const period = await this.getById(periodId)
    if (!period) return null
    const income = await db
      .select()
      .from(platformIncomeMonthly)
      .where(eq(platformIncomeMonthly.billingPeriodId, periodId))
    const customerByTenant = await customerFullNamesByTenantIds(
      income.map((r) => r.tenantId),
    )
    const cost = await db
      .select()
      .from(platformCostMonthly)
      .where(eq(platformCostMonthly.billingPeriodId, periodId))
    const costAdjustmentHistories =
      await listBalanceCardHoursAdjustmentHistories(periodId)
    return {
      period,
      income: income.map((r) => ({
        id: r.id,
        billing_period_id: r.billingPeriodId,
        project_name: r.projectName,
        tenant_name: r.tenantName,
        tenant_id: r.tenantId,
        tenant_platform_id: r.tenantPlatformId,
        customer_id: r.customerId,
        customer_full_name:
          customerByTenant.get(r.tenantId) ?? r.customerFullName,
        project_id: r.projectId,
        supplementary_consumption: r.supplementaryConsumption,
        balance_consumption: r.balanceConsumption,
        bare_metal_consumption: r.bareMetalConsumption,
        total_consumption: r.totalConsumption,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt?.toISOString() ?? null,
      })),
      cost: cost.map((r) => ({
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
      })),
      costAdjustmentHistories,
    }
  },

  async applyBalanceCardHoursAdjustment(
    ...args: Parameters<
      (typeof import('./apply-balance-card-hours-adjustment'))['applyBalanceCardHoursAdjustment']
    >
  ) {
    const { applyBalanceCardHoursAdjustment } = await import(
      './apply-balance-card-hours-adjustment'
    )
    return applyBalanceCardHoursAdjustment(...args)
  },

  async importExcelFile(
    ...args: Parameters<(typeof import('./import'))['importExcelFile']>
  ) {
    const { importExcelFile } = await financeImport()
    return importExcelFile(...args)
  },
  getImportSlotStatuses,
  computeBillingPeriodCost,
  computeBillingPeriodIncome,
  computeSinglePeriodIncome,
  previewSinglePeriodIncome,
  listTenantProjectBindings,
  validateSingleIncome,

  async validatePeriod(
    periodId: string,
    options?: { costMode?: ComputeCostMode },
  ) {
    const period = await this.getById(periodId)
    if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
    const costMode = options?.costMode ?? 'create'
    const usePeriodEndPricing =
      costMode === 'regenerate' || periodUsesPeriodEndCostPricing(period)
    const windows = await listTenantBillWindows(periodId)
    const priceWindowInfo = await detectPlatformListPriceWindows({
      periodStart: period.period_start,
      periodEnd: period.period_end,
    })
    const slots = await getImportSlotStatuses(periodId)
    const cross = await validateCrossFileImports(periodId)
    const missingTenantBill = usePeriodEndPricing
      ? await findMissingTenantBillPricingAtPeriodEnd({
          periodId,
          periodEnd: period.period_end,
        })
      : await findMissingTenantBillPricing({ periodId })
    const missingBaremetal = await findMissingBaremetalPlatformListPrice({ periodId })
    const missingPricing = [...missingTenantBill, ...missingBaremetal]
    const tenantBillReady =
      windows.length > 0 &&
      slots.tenantBillWindows.length === windows.length &&
      slots.tenantBillWindows.every((w) => w.parseStatus === 'ok')
    const incomeImportsReady =
      slots.customer?.parseStatus === 'ok' && slots.baremetal?.parseStatus === 'ok'
    const costImportsReady =
      tenantBillReady && slots.baremetal?.parseStatus === 'ok'
    const costTenantPlatformIds = await collectCostTenantPlatformIds(periodId)
    const bindings = await listTenantProjectBindings(periodId)
    const bindingPlatformIds = bindings
      .filter((b) => b.projects.length >= 2)
      .map((b) => b.tenantPlatformId)
    const allocationCheckPlatformIds = [
      ...new Set([...costTenantPlatformIds, ...bindingPlatformIds]),
    ]
    const pendingAllocations = await getPendingCostAllocationIssues({
      billingPeriodId: periodId,
      tenantPlatformIds: allocationCheckPlatformIds,
      periodEnd: period.period_end,
    })
    const canComputeCost =
      (period.status === 'imported' ||
        period.status === 'computed' ||
        period.status === 'draft') &&
      missingPricing.length === 0 &&
      pendingAllocations.length === 0 &&
      costImportsReady
    const canRunBase =
      cross.ok && missingPricing.length === 0 && pendingAllocations.length === 0
    return {
      periodStatus: period.status,
      slots,
      windows,
      priceWindowInfo,
      crossFileOk: cross.ok,
      missingPricing,
      pendingAllocations,
      pendingAllocationCount: pendingAllocations.length,
      pendingCostAllocationCount: pendingAllocations.length,
      canCompute: canComputeCost,
      canComputeCost,
      canComputeIncome:
        (period.status === 'imported' ||
          period.status === 'computed' ||
          period.status === 'draft') &&
        cross.ok &&
        pendingAllocations.length === 0 &&
        incomeImportsReady,
    }
  },

  async detectPriceWindows(input: { periodStart: string; periodEnd: string }) {
    return detectPlatformListPriceWindows(input)
  },

  async downloadImportErrorReport(input: {
    billingPeriodId: string
    slot: ImportSlotKey
    windowId?: string
  }) {
    const fileType = SLOT_TO_FILE_TYPE[input.slot]
    const report = await readErrorReportBySlot({
      periodId: input.billingPeriodId,
      fileType,
      windowId: input.windowId,
    })
    if (!report) throw new FinanceError('NOT_FOUND', '无可下载的错误明细')
    return report
  },

  async saveSupplementary(input: {
    billingPeriodId: string
    items: { incomeRowId: string; supplementaryConsumption: string }[]
    actorId?: string | null
  }): Promise<void> {
    const period = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, input.billingPeriodId),
    })
    if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
    if (period.status !== 'computed' && period.status !== 'adjusted') {
      throw new FinanceError('PRECONDITION_FAILED', '仅已计算账期可保存补充消费')
    }

    for (const item of input.items) {
      const row = await db.query.platformIncomeMonthly.findFirst({
        where: eq(platformIncomeMonthly.id, item.incomeRowId),
      })
      if (!row || row.billingPeriodId !== input.billingPeriodId) continue
      const sup = toMoneyString(Number(item.supplementaryConsumption) || 0)
      const total = computeTotalConsumption({
        supplementary_consumption: sup,
        balance_consumption: row.balanceConsumption ?? '0',
        bare_metal_consumption: row.bareMetalConsumption ?? '0',
      })
      await db
        .update(platformIncomeMonthly)
        .set({
          supplementaryConsumption: sup,
          totalConsumption: total,
        })
        .where(eq(platformIncomeMonthly.id, item.incomeRowId))
    }

    const { refreshBillingPeriodPeriodTotals } = await import('./billing-period-period-totals')
    await refreshBillingPeriodPeriodTotals(input.billingPeriodId)

    await appendOperationLog({
      billingPeriodId: input.billingPeriodId,
      operation: 'save_supplementary',
      actorId: input.actorId,
      metadata: { count: input.items.length },
    })
  },

  async saveCostAllocations(input: {
    billingPeriodId: string
    allocations: {
      tenantPlatformId: string
      tenantId: string
      projectId: string
      allocationPercent: string
    }[]
    actorId?: string | null
  }): Promise<void> {
    const sumByTenant = new Map<string, number>()
    for (const a of input.allocations) {
      const cur = sumByTenant.get(a.tenantPlatformId) ?? 0
      sumByTenant.set(a.tenantPlatformId, cur + Number(a.allocationPercent))
    }
    for (const [tenant, sum] of sumByTenant) {
      if (Math.abs(sum - 100) > 0.0001) {
        throw new FinanceError(
          'BAD_REQUEST',
          `租户 ${tenant} 分成比例合计须为 100%，当前为 ${sum}%`,
        )
      }
    }

    await db
      .delete(billingTenantCostAllocation)
      .where(eq(billingTenantCostAllocation.billingPeriodId, input.billingPeriodId))

    if (input.allocations.length > 0) {
      await db.insert(billingTenantCostAllocation).values(
        input.allocations.map((a) => ({
          id: newId(),
          billingPeriodId: input.billingPeriodId,
          tenantPlatformId: a.tenantPlatformId,
          tenantId: a.tenantId,
          projectId: a.projectId,
          allocationPercent: Number(a.allocationPercent).toFixed(4),
          createdBy: input.actorId ?? null,
        })),
      )
    }

    await appendOperationLog({
      billingPeriodId: input.billingPeriodId,
      operation: 'save_allocation',
      actorId: input.actorId,
      metadata: { count: input.allocations.length },
    })
  },

  async publish(periodId: string, actorId?: string | null): Promise<void> {
    const period = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, periodId),
    })
    if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
    if (period.status !== 'computed' && period.status !== 'adjusted') {
      throw new FinanceError('PRECONDITION_FAILED', '仅已计算账期可发布')
    }
    await db
      .update(billingPeriod)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(billingPeriod.id, periodId))
    await appendOperationLog({
      billingPeriodId: periodId,
      operation: 'publish',
      actorId,
    })
  },

  async unpublish(periodId: string, actorId?: string | null): Promise<void> {
    const period = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, periodId),
    })
    if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
    if (period.status !== 'published' && period.status !== 'adjusted') {
      throw new FinanceError('PRECONDITION_FAILED', '仅已发布账期可撤回')
    }
    await db
      .update(billingPeriod)
      .set({ status: 'computed', publishedAt: null })
      .where(eq(billingPeriod.id, periodId))
    await appendOperationLog({
      billingPeriodId: periodId,
      operation: 'unpublish',
      actorId,
    })
  },

  async regenerate(periodId: string, actorId?: string | null): Promise<BillingPeriodDto> {
    const period = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, periodId),
    })
    if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
    if (period.status === 'published' || period.status === 'adjusted') {
      throw new FinanceError('CONFLICT', '已发布账期须先作废后再重新上传生成')
    }
    if (period.status === 'void') {
      throw new FinanceError('CONFLICT', '作废账期不可重新生成')
    }
    const { purgeBillingPeriodArtifacts } = await financePurge()
    await purgeBillingPeriodArtifacts({
      billingPeriodId: periodId,
      scope: 'full',
      actorId,
    })
    await syncTenantBillWindowsForPeriod(periodId)
    await db
      .update(billingPeriod)
      .set({ status: 'draft', publishedAt: null, voidedAt: null })
      .where(eq(billingPeriod.id, periodId))
    await appendOperationLog({
      billingPeriodId: periodId,
      operation: 'regenerate',
      actorId,
    })
    financeLog('regenerate', 'period reset to draft', { periodId })
    return mapPeriod(
      (await db.query.billingPeriod.findFirst({ where: eq(billingPeriod.id, periodId) }))!,
    )
  },

  async prepareRegenerateCost(periodId: string, actorId?: string | null) {
    const period = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, periodId),
    })
    if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  if (period.status === 'published') {
    throw new FinanceError('CONFLICT', '已发布账期不可重新生成成本，请先撤回发布')
  }
    if (period.status === 'void') {
      throw new FinanceError('CONFLICT', '作废账期不可重新生成成本')
    }

    await purgeCostImportsForRegenerate(periodId)
    const window = await ensureRegenerateCostWindow({
      periodId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    })

    await appendOperationLog({
      billingPeriodId: periodId,
      operation: 'prepare_regenerate_cost',
      actorId,
    })

    financeLog('prepare-regenerate-cost', 'ready', { periodId, windowId: window.id })
    return window
  },

  async regenerateCost(input: {
    billingPeriodId: string
    actorId?: string | null
  }) {
    return computeBillingPeriodCost({
      billingPeriodId: input.billingPeriodId,
      actorId: input.actorId,
      mode: 'regenerate',
    })
  },

  async voidPeriod(periodId: string, actorId?: string | null): Promise<BillingPeriodDto> {
    const period = await db.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, periodId),
    })
    if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
    if (period.status !== 'published' && period.status !== 'adjusted') {
      throw new FinanceError('PRECONDITION_FAILED', '仅已发布账期可作废')
    }
    const { purgeBillingPeriodArtifacts } = await financePurge()
    await purgeBillingPeriodArtifacts({
      billingPeriodId: periodId,
      scope: 'full',
      actorId,
    })
    await syncTenantBillWindowsForPeriod(periodId)
    await db
      .update(billingPeriod)
      .set({ status: 'draft', publishedAt: null, voidedAt: new Date() })
      .where(eq(billingPeriod.id, periodId))
    await appendOperationLog({
      billingPeriodId: periodId,
      operation: 'void',
      actorId,
    })
    financeLog('void', 'published period voided and reset to draft', { periodId })
    return mapPeriod(
      (await db.query.billingPeriod.findFirst({ where: eq(billingPeriod.id, periodId) }))!,
    )
  },
}
