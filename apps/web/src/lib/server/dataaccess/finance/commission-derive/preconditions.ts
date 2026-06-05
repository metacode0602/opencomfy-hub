import { db } from '@/lib/db'
import {
  COMMISSION_POLICY_END_MONTH,
  COMMISSION_POLICY_START_MONTH,
} from '@/lib/crm/commission-constants'
import { billingPeriod, billingPeriodCostSourceLine } from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'
import { collectCostTenantPlatformIds } from '../compute-cost'
import { formatPendingCostAllocationError } from '../cost-allocation-errors'
import { getPendingCostAllocationIssues } from '../cost-tenant-resolve'
import { FinanceError } from '../errors'
import { getImportSlotStatuses } from '../import-slot-status'
import {
  findMissingBaremetalPlatformListPrice,
  findMissingTenantBillPricing,
  findMissingTenantBillPricingAtPeriodEnd,
} from '../tenant-bill-pricing'
import { listTenantBillWindows } from '../tenant-bill-windows'
import { periodUsesPeriodEndCostPricing } from '../billing-period-pricing-mode'
import { DERIVE_ISSUE_CODES } from './constants'

export async function assertDerivePreconditions(billingPeriodId: string): Promise<void> {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, billingPeriodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  if (period.status === 'void') throw new FinanceError('CONFLICT', '作废账期不可派生提成')
  if (period.status === 'import_error') {
    throw new FinanceError('PRECONDITION_FAILED', '导入存在错误，请修正 Excel 后重新上传')
  }

  const slots = await getImportSlotStatuses(billingPeriodId)
  const windows = await listTenantBillWindows(billingPeriodId)
  const tenantBillReady =
    windows.length > 0 &&
    slots.tenantBillWindows.length === windows.length &&
    slots.tenantBillWindows.every((w) => w.parseStatus === 'ok')
  const baremetalReady = slots.baremetal?.parseStatus === 'ok'

  if (!tenantBillReady || !baremetalReady) {
    throw new FinanceError(
      'PRECONDITION_FAILED',
      '须已解析的客户账单与裸金属订单',
    )
  }

  const usePeriodEndPricing = periodUsesPeriodEndCostPricing(period)
  const missingPricing = usePeriodEndPricing
    ? [
        ...(await findMissingTenantBillPricingAtPeriodEnd({
          periodId: billingPeriodId,
          periodEnd: period.periodEnd,
        })),
        ...(await findMissingBaremetalPlatformListPrice({ periodId: billingPeriodId })),
      ]
    : [
        ...(await findMissingTenantBillPricing({ periodId: billingPeriodId })),
        ...(await findMissingBaremetalPlatformListPrice({ periodId: billingPeriodId })),
      ]

  if (missingPricing.length > 0) {
    await db
      .update(billingPeriod)
      .set({ status: 'pending_pricing' })
      .where(eq(billingPeriod.id, billingPeriodId))
    const sample = missingPricing
      .slice(0, 3)
      .map((p) => `${p.regionCode}×${p.gpuModel}`)
      .join('、')
    throw new FinanceError(
      'UNPROCESSABLE',
      `${missingPricing.length} 个区域×卡型缺少机房卡型成本配置（如 ${sample}）`,
    )
  }

  const tenantPlatformIds = await collectCostTenantPlatformIds(billingPeriodId)
  const pendingIssues = await getPendingCostAllocationIssues({
    billingPeriodId,
    tenantPlatformIds,
    periodEnd: period.periodEnd,
  })
  if (pendingIssues.length > 0) {
    await db
      .update(billingPeriod)
      .set({ status: 'pending_allocation' })
      .where(eq(billingPeriod.id, billingPeriodId))
    throw new FinanceError(
      'UNPROCESSABLE',
      formatPendingCostAllocationError(pendingIssues, 'cost'),
    )
  }
}

export async function assertExistingCostSourceLines(billingPeriodId: string): Promise<void> {
  const rows = await db
    .select({ id: billingPeriodCostSourceLine.id })
    .from(billingPeriodCostSourceLine)
    .where(eq(billingPeriodCostSourceLine.billingPeriodId, billingPeriodId))
    .limit(1)
  if (rows.length === 0) {
    throw new FinanceError(
      'PRECONDITION_FAILED',
      '须先具备成本源行或撤回发布后重算成本',
    )
  }
}

export function isInPolicyWindow(periodCode: string): boolean {
  return periodCode >= COMMISSION_POLICY_START_MONTH && periodCode <= COMMISSION_POLICY_END_MONTH
}

export { DERIVE_ISSUE_CODES }
