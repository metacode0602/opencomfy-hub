import { db } from '@/lib/db'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import {
  billingPeriod,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawTenantBill,
  billingPeriodReconciliationReport,
  platformCostMonthly,
} from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'
import type { ComputeCostMode } from './compute-cost-mode'
import { persistCostPricingSnapshots } from './compute-cost-pricing-snapshot'
import { rollupSourceLinesToPlatformMonthly } from './compute-cost-rollup'
import { persistCostSourceLines } from './compute-cost-source-line'
import { formatPendingCostAllocationError } from './cost-allocation-errors'
import { getPendingCostAllocationIssues } from './cost-tenant-resolve'
import { RULE_VERSION } from './constants'
import { FinanceError } from './errors'
import { getImportSlotStatuses } from './import-slot-status'
import { financeLog, financeWarn } from './logger'
import { appendOperationLog, newId } from './operation-log'
import { purgeCostDerivedStandalone } from './purge-cost'
import {
  findMissingBaremetalPlatformListPrice,
  findMissingTenantBillPricing,
  findMissingTenantBillPricingAtPeriodEnd,
} from './tenant-bill-pricing'
import { refreshBillingPeriodPeriodTotals } from './billing-period-period-totals'
import { periodUsesPeriodEndCostPricing } from './billing-period-pricing-mode'
import { listTenantBillWindows } from './tenant-bill-windows'

export type { ComputeCostMode } from './compute-cost-mode'

export type ComputeCostResult = {
  costCount: number
  reconciliationIssues: string[]
  status: string
}

function parseNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

export async function collectCostTenantPlatformIds(periodId: string): Promise<string[]> {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const baremetalBatch = batches.find((b) => b.fileType === 'baremetal_order')
  const tenantBillBatches = batches.filter((b) => b.fileType === 'tenant_bill')

  const ids = new Set<string>()

  if (baremetalBatch) {
    const baremetalRows = await db
      .select({ tenantPlatformId: billingPeriodRawBaremetalOrder.tenantPlatformId })
      .from(billingPeriodRawBaremetalOrder)
      .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id))
    for (const row of baremetalRows) ids.add(row.tenantPlatformId)
  }

  for (const batch of tenantBillBatches) {
    const tenantRows = await db
      .select({ tenantPlatformId: billingPeriodRawTenantBill.tenantPlatformId })
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
    for (const row of tenantRows) ids.add(row.tenantPlatformId)
  }

  return [...ids]
}

async function assertRegenerateCostImportsReady(periodId: string): Promise<void> {
  const slots = await getImportSlotStatuses(periodId)
  const windows = await listTenantBillWindows(periodId)
  if (windows.length !== 1) {
    throw new FinanceError('PRECONDITION_FAILED', '重新生成成本须使用整月单时间段')
  }
  const tenantBillReady =
    slots.tenantBillWindows.length === 1 && slots.tenantBillWindows[0]?.parseStatus === 'ok'
  const baremetalReady = slots.baremetal?.parseStatus === 'ok'
  if (!tenantBillReady || !baremetalReady) {
    throw new FinanceError(
      'PRECONDITION_FAILED',
      '重新生成成本须已上传并解析成功的客户账单详情与裸金属订单',
    )
  }
}

async function assertCostComputePreconditions(
  periodId: string,
  mode: ComputeCostMode = 'create',
): Promise<void> {
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
  if (
    period.status !== 'imported' &&
    period.status !== 'computed' &&
    period.status !== 'draft' &&
    period.status !== 'pending_pricing'
  ) {
    throw new FinanceError('PRECONDITION_FAILED', '当前账期状态不允许计算成本')
  }

  const usePeriodEndPricing =
    mode === 'regenerate' || periodUsesPeriodEndCostPricing(period)

  if (mode === 'regenerate') {
    await assertRegenerateCostImportsReady(periodId)
  } else {
    const slots = await getImportSlotStatuses(periodId)
    const windows = await listTenantBillWindows(periodId)
    const tenantBillReady =
      windows.length > 0 &&
      slots.tenantBillWindows.length === windows.length &&
      slots.tenantBillWindows.every((w) => w.parseStatus === 'ok')
    const baremetalReady = slots.baremetal?.parseStatus === 'ok'

    if (!tenantBillReady || !baremetalReady) {
      throw new FinanceError(
        'PRECONDITION_FAILED',
        '计算成本需已解析的客户账单与裸金属订单',
      )
    }
  }

  const missingPricing = usePeriodEndPricing
    ? [
        ...(await findMissingTenantBillPricingAtPeriodEnd({
          periodId,
          periodEnd: period.periodEnd,
        })),
        ...(await findMissingBaremetalPlatformListPrice({ periodId })),
      ]
    : [
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

  const tenantPlatformIds = await collectCostTenantPlatformIds(periodId)
  const pendingIssues = await getPendingCostAllocationIssues({
    billingPeriodId: periodId,
    tenantPlatformIds,
    periodEnd: period.periodEnd,
  })
  if (pendingIssues.length > 0) {
    await db
      .update(billingPeriod)
      .set({ status: 'pending_allocation' })
      .where(eq(billingPeriod.id, periodId))
    financeWarn('compute-cost', 'blocked: pending allocation', {
      periodId,
      tenants: pendingIssues.map((i) => i.tenantPlatformId),
    })
    throw new FinanceError(
      'UNPROCESSABLE',
      formatPendingCostAllocationError(pendingIssues, 'cost'),
    )
  }
}

async function upsertCostReconciliationReport(input: {
  periodId: string
  issues: string[]
  costRowCount: number
}): Promise<void> {
  const existing = await db.query.billingPeriodReconciliationReport.findFirst({
    where: eq(billingPeriodReconciliationReport.billingPeriodId, input.periodId),
  })

  const reportJson = {
    ...(existing?.reportJson && typeof existing.reportJson === 'object'
      ? (existing.reportJson as Record<string, unknown>)
      : {}),
    costIssues: input.issues,
    costRowCount: input.costRowCount,
    costComputedAt: new Date().toISOString(),
  }

  if (existing) {
    await db
      .update(billingPeriodReconciliationReport)
      .set({ reportJson, ruleVersion: RULE_VERSION })
      .where(eq(billingPeriodReconciliationReport.id, existing.id))
  } else {
    await db.insert(billingPeriodReconciliationReport).values({
      id: newId(),
      billingPeriodId: input.periodId,
      reportJson,
      ruleVersion: RULE_VERSION,
    })
  }
}

export async function computeBillingPeriodCost(input: {
  billingPeriodId: string
  actorId?: string | null
  mode?: ComputeCostMode
}): Promise<ComputeCostResult> {
  const periodId = input.billingPeriodId
  const mode = input.mode ?? 'create'
  financeLog('compute-cost', 'start', { periodId, ruleVersion: RULE_VERSION, mode })

  await assertCostComputePreconditions(periodId, mode)

  const period = (await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
  }))!
  const usePeriodEndPricing =
    mode === 'regenerate' || periodUsesPeriodEndCostPricing(period)

  await purgeCostDerivedStandalone(periodId)
  if (mode === 'create') {
    const { syncTenantBillWindowsForPeriod } = await import('./tenant-bill-windows')
    await syncTenantBillWindowsForPeriod(periodId)
  }

  const tenantPlatformIds = await collectCostTenantPlatformIds(periodId)
  const issues: string[] = []

  await persistCostSourceLines({
    billingPeriodId: periodId,
    tenantPlatformIds,
    periodEnd: period.periodEnd,
    issues,
    mode,
    usePeriodEndPricing,
  })

  const snapshots = await persistCostPricingSnapshots({
    billingPeriodId: periodId,
    periodEnd: period.periodEnd,
    mode,
    usePeriodEndPricing,
  })
  const rollup = await rollupSourceLinesToPlatformMonthly({
    billingPeriodId: periodId,
    snapshots,
    issues,
    usePeriodEndPricing,
    periodEnd: period.periodEnd,
    mode,
  })

  const recordRows = await db
    .select()
    .from(platformCostMonthly)
    .where(
      and(
        eq(platformCostMonthly.billingPeriodId, periodId),
        eq(platformCostMonthly.type, 'record'),
      ),
    )

  let totalGross = 0
  for (const row of recordRows) {
    totalGross += parseNum(row.grossProfit)
  }

  const totalCost = rollup.projectCost + rollup.internalUserCost

  await refreshBillingPeriodPeriodTotals(periodId, {
    projectCost: rollup.projectCost,
    internalUserCost: rollup.internalUserCost,
    totalCost,
    totalGrossProfit: totalGross,
    status: 'computed',
    lastComputedAt: new Date(),
  })

  await upsertCostReconciliationReport({
    periodId,
    issues,
    costRowCount: rollup.costCount,
  })

  await appendOperationLog({
    billingPeriodId: periodId,
    operation: mode === 'regenerate' ? 'regenerate_cost' : 'compute_cost',
    actorId: input.actorId,
    metadata: {
      ruleVersion: RULE_VERSION,
      costCount: rollup.costCount,
      issueCount: issues.length,
      mode,
    },
  })

  financeLog('compute-cost', 'done', {
    periodId,
    costCount: rollup.costCount,
    totalCost,
    projectCost: rollup.projectCost,
    internalUserCost: rollup.internalUserCost,
    totalGross,
    issues: issues.length,
    mode,
  })

  return {
    costCount: rollup.costCount,
    reconciliationIssues: issues,
    status: 'computed',
  }
}
