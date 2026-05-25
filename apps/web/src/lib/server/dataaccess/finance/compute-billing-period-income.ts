import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodAggCustomerConsumption,
  billingPeriodImportBatch,
  billingPeriodRawCustomerConsumption,
  platformIncomeMonthly,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import {
  appendRefGapIssues,
  buildTenantAggMap,
  type ComputeIncomeResult,
  validateCustomerTypeConsistency,
} from './compute-income-shared'
import {
  classifyTenantsSql,
  runStandardIncomeSqlPath,
  stepI5UpdatePeriodIncomeTotals,
} from './compute-income-sql'
import { loadBaremetalByTenant, processMultiProjectTenants } from './compute-income-multi'
import { RULE_VERSION } from './constants'
import type { TenantProjectBinding } from './enrichment'
import { listTenantProjectBindings } from './enrichment'
import { formatPendingCostAllocationError } from './cost-allocation-errors'
import { getPendingCostAllocationIssues } from './cost-tenant-resolve'
import { FinanceError } from './errors'
import { financeLog, financeWarn } from './logger'
import { appendOperationLog } from './operation-log'
import { validateCrossFileImports } from './validate-import'

async function purgeIncomeArtifacts(periodId: string): Promise<void> {
  await db.delete(platformIncomeMonthly).where(eq(platformIncomeMonthly.billingPeriodId, periodId))
  await db
    .delete(billingPeriodAggCustomerConsumption)
    .where(eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId))
}

async function loadCustomerConsumptionRows(periodId: string) {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const customerBatch = batches.find((b) => b.fileType === 'customer_consumption')
  if (!customerBatch || customerBatch.parseStatus !== 'ok') {
    throw new FinanceError('PRECONDITION_FAILED', '请先上传并解析客户消费明细')
  }
  return db
    .select()
    .from(billingPeriodRawCustomerConsumption)
    .where(eq(billingPeriodRawCustomerConsumption.batchId, customerBatch.id))
}

async function assertIncomeComputePreconditions(periodId: string): Promise<void> {
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
    period.status !== 'draft'
  ) {
    throw new FinanceError('PRECONDITION_FAILED', '当前账期状态不允许计算收入')
  }

  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const okBatches = batches.filter((b) => b.parseStatus === 'ok')
  const hasCustomer = okBatches.some((b) => b.fileType === 'customer_consumption')
  const hasBaremetal = okBatches.some((b) => b.fileType === 'baremetal_order')
  if (!hasCustomer || !hasBaremetal) {
    throw new FinanceError(
      'PRECONDITION_FAILED',
      '计算收入需已解析的客户消费明细与裸金属订单',
    )
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

  const customerRows = await loadCustomerConsumptionRows(periodId)
  const incomeTenantPlatformIds = [...new Set(customerRows.map((r) => r.tenantPlatformId))]
  const pendingIssues = await getPendingCostAllocationIssues({
    billingPeriodId: periodId,
    tenantPlatformIds: incomeTenantPlatformIds,
    periodEnd: period.periodEnd,
  })
  if (pendingIssues.length > 0) {
    await db
      .update(billingPeriod)
      .set({ status: 'pending_allocation' })
      .where(eq(billingPeriod.id, periodId))
    throw new FinanceError(
      'UNPROCESSABLE',
      formatPendingCostAllocationError(pendingIssues, 'income'),
    )
  }
}

/** 收入 pipeline 核心：I0 → 标准 SQL I1～I4 → 多项目内存 → I5 */
export async function runPeriodIncomePipeline(input: {
  periodId: string
  customerRows: (typeof billingPeriodRawCustomerConsumption.$inferSelect)[]
  bindings: TenantProjectBinding[]
  tenantBillBalanceByTenant?: Map<string, number>
  markPeriodComputed?: boolean
}): Promise<ComputeIncomeResult> {
  const { periodId, customerRows, bindings } = input
  const issues: string[] = []

  validateCustomerTypeConsistency(customerRows)

  const tenantAggMap = buildTenantAggMap(customerRows)
  const platformIds = [...tenantAggMap.keys()]
  if (platformIds.length === 0) {
    financeWarn('compute-income', 'no customer consumption tenants', { periodId })
    return { incomeCount: 0, reconciliationIssues: issues }
  }

  const { standardPlatformIds, multiPlatformIds } = await classifyTenantsSql(periodId)

  await purgeIncomeArtifacts(periodId)

  let incomeCount = await runStandardIncomeSqlPath(periodId, standardPlatformIds)

  const bareByTenant = await loadBaremetalByTenant(periodId)
  appendRefGapIssues(
    issues,
    tenantAggMap,
    bareByTenant,
    input.tenantBillBalanceByTenant ?? new Map(),
  )

  incomeCount += await processMultiProjectTenants({
    periodId,
    multiPlatformIds,
    tenantAggMap,
    bindings,
    bareByTenant,
    issues,
  })

  await stepI5UpdatePeriodIncomeTotals({
    periodId,
    markComputed: input.markPeriodComputed ?? false,
  })

  financeLog('compute-income', 'pipeline done', {
    periodId,
    incomeCount,
    issueCount: issues.length,
  })

  return { incomeCount, reconciliationIssues: issues }
}

/** 仅计算收入（SQL 标准路径 + 多项目内存），供独立 API 与全量 compute 复用 */
export async function computeBillingPeriodIncome(input: {
  billingPeriodId: string
  actorId?: string | null
  tenantBillBalanceByTenant?: Map<string, number>
  markPeriodComputed?: boolean
}): Promise<ComputeIncomeResult> {
  const periodId = input.billingPeriodId
  financeLog('compute-income', 'start', { periodId, ruleVersion: RULE_VERSION })

  await assertIncomeComputePreconditions(periodId)

  const customerRows = await loadCustomerConsumptionRows(periodId)
  const bindings = await listTenantProjectBindings(periodId)

  let result: ComputeIncomeResult
  try {
    result = await runPeriodIncomePipeline({
      periodId,
      customerRows,
      bindings,
      tenantBillBalanceByTenant: input.tenantBillBalanceByTenant,
      markPeriodComputed: input.markPeriodComputed ?? false,
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

  await appendOperationLog({
    billingPeriodId: periodId,
    operation: 'compute_income',
    actorId: input.actorId,
    metadata: {
      ruleVersion: RULE_VERSION,
      incomeCount: result.incomeCount,
      implementation: 'sql',
    },
  })

  return result
}
