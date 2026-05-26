import { db } from '@/lib/db'
import {
  billMonthFromPlatformPeriod,
  detailLineType,
  dueDateForBillMonth,
  formatBillingCommitSummary,
  formatGpuSummary,
  mapMetalBillingUnit,
  mapMetalOrderStatus,
  mapPayChannel,
  mapPlatformProductLine,
  mapPlatformTaskType,
  mapRechargeStatus,
  moneyStringsEqual,
  parsePlatformDateTime,
  payChannelLabel,
  platformBillingValueToMoneyString,
  platformBillingValueToRmb,
  platformOrderAmountToMoneyString,
  platformOrderAmountToRmb,
  platformRechargeAmountToMoneyString,
  platformRechargeAmountToRmb,
  summarizeSection,
  usageDateFromPlatformPeriod,
  usageMonthFromDate,
  validateBillingDateRange,
} from '@/lib/crm/tenant-billing-import-utils'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import {
  fetchPlatformBillDetailsForOverview,
  fetchPlatformDailyTaskSummaries,
  fetchPlatformDailyUsageBills,
  fetchPlatformMetalOrders,
  fetchPlatformMonthlyBills,
  fetchPlatformRecharges,
  SuanliBillingApiError,
  type PlatformBillDetailRecord,
  type PlatformDailyTaskSummaryRecord,
  type PlatformDailyUsageBillRecord,
  type PlatformMetalOrderRecord,
  type PlatformMonthlyBillRecord,
  type PlatformRechargeRecord,
} from '@/lib/server/integrations/suanli-billing-api'
import {
  BILLING_API_PAGE_DELAY_MS,
  BILLING_IMPORT_SECTION_DELAY_MS,
  delayBillingApi,
} from '@/lib/server/integrations/suanli-billing-api-throttle'
import type {
  BillDetailPreviewItem,
  DailyUsageBillPreviewItem,
  MetalOrderPreviewItem,
  MonthlyBillPreviewItem,
  RechargePreviewItem,
  TenantBillingImportAction,
  TenantBillingImportCommitResult,
  TenantBillingImportPreviewResult,
  TenantBillingImportSection,
} from '@/lib/types/tenant-billing-import'
import type {
  PlatformImportBillingBatchResult,
  PlatformImportBillingItemResult,
} from '@/lib/types/platform-tenant-import'
import { projectsDataAccess } from './projects'
import {
  billingTenant,
  commerceOrder,
  commerceOrderItem,
  consumptionUsageDaily,
  tenantConsumptionDailyDetail,
  recharge,
  tenantBill,
  tenantBillDetail,
} from '@workspace/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

const PREVIEW_TTL_MS = 15 * 60 * 1000

/** 平台任务明细暂未返回机房/卡型时的占位 */
const DETAIL_DC_CODE_NA = '_na'
const DETAIL_DC_NAME_NA = '—'
const DETAIL_GPU_CODE_NA = '_na'

type BillDetailLine = {
  platformKey: string
  productLine: string
  resourceName: string
  amount: string
  couponAmount: string
  balanceAmount: string
  type: string
}

type BillDetailGroup = {
  billMonth: string
  periodStart: string
  periodEnd: string
  periodStartDate: Date
  periodEndDate: Date
  lines: BillDetailLine[]
}

type CachedBillingImport = {
  expiresAt: number
  traceId: string
  tenantId: string
  customerId: string
  platformTenantId: string
  metalOrders: Array<{ action: TenantBillingImportAction; record: PlatformMetalOrderRecord }>
  monthlyBills: Array<{ action: TenantBillingImportAction; record: PlatformMonthlyBillRecord; billMonth: string }>
  recharges: Array<{ action: TenantBillingImportAction; record: PlatformRechargeRecord }>
  dailyUsageBills: Array<{
    action: TenantBillingImportAction
    record: PlatformDailyUsageBillRecord
    usageDate: string
    productLine: string
  }>
  dailyTaskDetails: Array<{
    usageDate: string
    productLine: string
    record: PlatformDailyTaskSummaryRecord
  }>
  billDetailGroups: BillDetailGroup[]
  billDetailItems: BillDetailPreviewItem[]
}

const previewCache = new Map<string, CachedBillingImport>()

function newId() {
  return crypto.randomUUID()
}

function section<T>(items: T[], error?: string): TenantBillingImportSection<T> {
  return {
    summary: summarizeSection(items as Array<{ action: string }>),
    items,
    error,
  }
}

async function resolveTenant(tenantId: string) {
  const row = await db.query.billingTenant.findFirst({
    where: eq(billingTenant.id, tenantId),
    columns: {
      id: true,
      customerId: true,
      name: true,
      platformTenantId: true,
    },
  })
  if (!row) {
    throw new Error('计费租户不存在')
  }
  if (!row.platformTenantId?.trim()) {
    throw new Error('该租户未关联平台 ID，请先从平台导入租户')
  }
  return row
}

function expandBillDetails(
  details: PlatformBillDetailRecord[],
): { groups: BillDetailGroup[]; items: BillDetailPreviewItem[] } {
  const groups: BillDetailGroup[] = []
  const items: BillDetailPreviewItem[] = []

  for (const detail of details) {
    const billMonth = billMonthFromPlatformPeriod(detail.start_time)
    const periodStartDate = parsePlatformDateTime(detail.start_time)
    const periodEndDate = parsePlatformDateTime(detail.end_time)
    if (!periodStartDate || !periodEndDate) continue

    const lines: BillDetailLine[] = []
    for (const [platformKey, values] of Object.entries(detail.amounts ?? {})) {
      const billingRaw = values.billing_value ?? 0
      const discountRaw = values.discount_value ?? 0
      if (billingRaw === 0 && discountRaw === 0) continue

      const { productLine, resourceName } = mapPlatformProductLine(platformKey)
      const amount = platformBillingValueToMoneyString(billingRaw)
      const couponAmount = platformBillingValueToMoneyString(discountRaw)
      const balanceAmount = platformBillingValueToRmb(billingRaw - discountRaw).toFixed(4)

      lines.push({
        platformKey,
        productLine,
        resourceName,
        amount,
        couponAmount,
        balanceAmount,
        type: detailLineType(productLine),
      })

      items.push({
        key: `detail-${billMonth}-${platformKey}`,
        action: 'create',
        billMonth,
        productLine,
        resourceName,
        amountRmb: platformBillingValueToRmb(billingRaw),
        couponAmountRmb: platformBillingValueToRmb(discountRaw),
        balanceAmountRmb: platformBillingValueToRmb(billingRaw - discountRaw),
      })
    }

    if (lines.length > 0) {
      groups.push({
        billMonth,
        periodStart: detail.start_time,
        periodEnd: detail.end_time,
        periodStartDate,
        periodEndDate,
        lines,
      })
    }
  }

  return { groups, items }
}

function buildMetalPreview(
  records: PlatformMetalOrderRecord[],
  existingByOrderNo: Map<string, { id: string; amount: string }>,
): {
  preview: MetalOrderPreviewItem[]
  cached: CachedBillingImport['metalOrders']
} {
  const preview: MetalOrderPreviewItem[] = []
  const cached: CachedBillingImport['metalOrders'] = []

  for (const record of records) {
    const amount = platformOrderAmountToMoneyString(record.total_price)
    const existing = existingByOrderNo.get(record.order_no)
    let action: TenantBillingImportAction = 'create'
    if (existing) {
      action = moneyStringsEqual(existing.amount, amount) ? 'skip' : 'update'
    }

    cached.push({ action, record })
    preview.push({
      key: `metal-${record.order_id}`,
      action,
      orderNo: record.order_no,
      status: record.status === 'Finished' ? '已完成' : record.status,
      idcName: record.idc_name ?? '—',
      amountRmb: platformOrderAmountToRmb(record.total_price),
      deviceCount: record.device_count ?? 0,
      gpuSummary: formatGpuSummary(record.gpu_models),
      createTime: record.create_time.replace(' +00:00', '').slice(0, 19),
    })
  }

  return { preview, cached }
}

function buildMonthlyBillPreview(
  records: PlatformMonthlyBillRecord[],
  existingByMonth: Map<
    string,
    { id: string; totalAmount: string; couponAmount: string; balanceAmount: string }
  >,
): {
  preview: MonthlyBillPreviewItem[]
  cached: CachedBillingImport['monthlyBills']
} {
  const preview: MonthlyBillPreviewItem[] = []
  const cached: CachedBillingImport['monthlyBills'] = []

  for (const record of records) {
    const billMonth = billMonthFromPlatformPeriod(record.start_time)
    const totalAmount = platformBillingValueToMoneyString(record.total_billing_value)
    const couponAmount = platformBillingValueToMoneyString(record.total_discount_value)
    const balanceAmount = platformBillingValueToRmb(
      record.total_billing_value - record.total_discount_value,
    ).toFixed(4)

    const existing = existingByMonth.get(billMonth)
    let action: TenantBillingImportAction = 'create'
    if (existing) {
      const same =
        moneyStringsEqual(existing.totalAmount, totalAmount) &&
        moneyStringsEqual(existing.couponAmount, couponAmount) &&
        moneyStringsEqual(existing.balanceAmount, balanceAmount)
      action = same ? 'skip' : 'update'
    }

    cached.push({ action, record, billMonth })
    preview.push({
      key: `bill-${billMonth}`,
      action,
      billMonth,
      periodStart: record.start_time,
      periodEnd: record.end_time,
      totalAmountRmb: platformBillingValueToRmb(record.total_billing_value),
      couponAmountRmb: platformBillingValueToRmb(record.total_discount_value),
      balanceAmountRmb: platformBillingValueToRmb(
        record.total_billing_value - record.total_discount_value,
      ),
    })
  }

  return { preview, cached }
}

function buildDailyUsagePreview(
  records: PlatformDailyUsageBillRecord[],
  existingByKey: Map<
    string,
    { id: string; amount: string; voucherAmount: string; balanceAmount: string }
  >,
): {
  preview: DailyUsageBillPreviewItem[]
  cached: CachedBillingImport['dailyUsageBills']
} {
  const preview: DailyUsageBillPreviewItem[] = []
  const cached: CachedBillingImport['dailyUsageBills'] = []

  for (const record of records) {
    const usageDate = usageDateFromPlatformPeriod(record.start_time)
    const { productLine, label: taskTypeLabel } = mapPlatformTaskType(record.task_type)
    const amount = platformBillingValueToMoneyString(record.total_billing_value)
    const voucherAmount = platformBillingValueToMoneyString(record.total_discount_value)
    const balanceAmount = platformBillingValueToRmb(
      record.total_billing_value - record.total_discount_value,
    ).toFixed(4)
    const diffKey = `${usageDate}:${productLine}`

    const existing = existingByKey.get(diffKey)
    let action: TenantBillingImportAction = 'create'
    if (existing) {
      const same =
        moneyStringsEqual(existing.amount, amount) &&
        moneyStringsEqual(existing.voucherAmount, voucherAmount) &&
        moneyStringsEqual(existing.balanceAmount, balanceAmount)
      action = same ? 'skip' : 'update'
    }

    cached.push({ action, record, usageDate, productLine })
    preview.push({
      key: `daily-${usageDate}-${productLine}`,
      action,
      usageDate,
      taskType: taskTypeLabel,
      productLine,
      periodStart: record.start_time,
      periodEnd: record.end_time,
      totalAmountRmb: platformBillingValueToRmb(record.total_billing_value),
      couponAmountRmb: platformBillingValueToRmb(record.total_discount_value),
      balanceAmountRmb: platformBillingValueToRmb(
        record.total_billing_value - record.total_discount_value,
      ),
    })
  }

  return { preview, cached }
}

function buildRechargePreview(
  records: PlatformRechargeRecord[],
  existingByTx: Map<string, { id: string; amount: string; status: string }>,
): {
  preview: RechargePreviewItem[]
  cached: CachedBillingImport['recharges']
} {
  const preview: RechargePreviewItem[] = []
  const cached: CachedBillingImport['recharges'] = []

  for (const record of records) {
    const amount = platformRechargeAmountToMoneyString(record.total_amount)
    const mappedStatus = mapRechargeStatus(record.status)
    const existing = existingByTx.get(record.order_id)
    let action: TenantBillingImportAction = 'create'
    if (existing) {
      action =
        moneyStringsEqual(existing.amount, amount) && existing.status === mappedStatus
          ? 'skip'
          : 'update'
    }

    cached.push({ action, record })
    preview.push({
      key: `recharge-${record.id}`,
      action,
      transactionId: record.order_id,
      amountRmb: platformRechargeAmountToRmb(record.total_amount),
      payChannel: payChannelLabel(mapPayChannel(record.pay_channel)),
      status: record.status === 'Completed' ? '已完成' : record.status,
      createTime: record.create_time.replace(' +08:00', '').slice(0, 19),
      remark: record.remark ?? undefined,
    })
  }

  return { preview, cached }
}

function diffBillDetailItems(
  items: BillDetailPreviewItem[],
  existingDetailsByBillMonth: Map<string, Map<string, { amount: string; couponAmount: string }>>,
): BillDetailPreviewItem[] {
  return items.map((item) => {
    const byLine = existingDetailsByBillMonth.get(item.billMonth)
    if (!byLine) {
      return { ...item, action: 'create' as const }
    }
    const existing = byLine.get(`${item.productLine}:${item.resourceName}`)
    if (!existing) {
      return { ...item, action: 'create' as const }
    }
    const same =
      moneyStringsEqual(existing.amount, item.amountRmb.toFixed(4)) &&
      moneyStringsEqual(existing.couponAmount, item.couponAmountRmb.toFixed(4))
    return { ...item, action: same ? 'skip' : 'update' }
  })
}

function purgeExpiredCache() {
  const now = Date.now()
  for (const [id, entry] of previewCache) {
    if (entry.expiresAt <= now) previewCache.delete(id)
  }
}

export const tenantBillingImportDataAccess = {
  async fetchPreview(input: {
    tenantId: string
    startDate?: string
    endDate?: string
  }): Promise<TenantBillingImportPreviewResult> {
    validateBillingDateRange(input.startDate, input.endDate)
    purgeExpiredCache()

    const traceId = crypto.randomUUID().slice(0, 8)
    const tenant = await resolveTenant(input.tenantId)

    crmLog('tenant-billing-import', 'fetch start', {
      traceId,
      tenantId: input.tenantId,
      platformTenantId: tenant.platformTenantId,
      startDate: input.startDate,
      endDate: input.endDate,
    })

    const apiInput = {
      platformTenantId: tenant.platformTenantId!,
      startDate: input.startDate,
      endDate: input.endDate,
      traceId,
    }

    let metalRecords: PlatformMetalOrderRecord[] = []
    let billRecords: PlatformMonthlyBillRecord[] = []
    let rechargeRecords: PlatformRechargeRecord[] = []
    let dailyUsageRecords: PlatformDailyUsageBillRecord[] = []
    let detailRecords: PlatformBillDetailRecord[] = []

    let metalError: string | undefined
    let billsError: string | undefined
    let rechargesError: string | undefined
    let dailyUsageError: string | undefined
    let detailsError: string | undefined

    const [metalRes, billsRes, rechargesRes, dailyUsageRes] = await (async () => {
      /** 串行拉取 + 段间等待，避免并发打满 OpenAPI */
      const runSection = async <T>(label: string, fn: () => Promise<T>) => {
        try {
          const value = await fn()
          return { status: 'fulfilled' as const, value }
        } catch (reason) {
          return { status: 'rejected' as const, reason }
        }
      }

      const bills = await runSection('monthly_bills', () =>
        fetchPlatformMonthlyBills(apiInput),
      )
      await delayBillingApi(BILLING_IMPORT_SECTION_DELAY_MS, 'section:metal_orders')

      const metal = await runSection('metal_orders', () => fetchPlatformMetalOrders(apiInput))
      await delayBillingApi(BILLING_IMPORT_SECTION_DELAY_MS, 'section:recharges')

      const recharges = await runSection('recharges', () => fetchPlatformRecharges(apiInput))
      await delayBillingApi(BILLING_IMPORT_SECTION_DELAY_MS, 'section:daily_usage_bills')

      const dailyUsage = await runSection('daily_usage_bills', () =>
        fetchPlatformDailyUsageBills(apiInput),
      )
      return [metal, bills, recharges, dailyUsage] as const
    })()

    if (metalRes.status === 'fulfilled') {
      metalRecords = metalRes.value
    } else {
      metalError =
        metalRes.reason instanceof Error ? metalRes.reason.message : '裸金属订单拉取失败'
      crmWarn('tenant-billing-import', 'metal failed', { traceId, err: metalError })
    }

    if (billsRes.status === 'fulfilled') {
      billRecords = billsRes.value
    } else {
      billsError = billsRes.reason instanceof Error ? billsRes.reason.message : '月度账单拉取失败'
      crmWarn('tenant-billing-import', 'bills failed', { traceId, err: billsError })
    }

    if (rechargesRes.status === 'fulfilled') {
      rechargeRecords = rechargesRes.value
    } else {
      rechargesError =
        rechargesRes.reason instanceof Error ? rechargesRes.reason.message : '充值列表拉取失败'
      crmWarn('tenant-billing-import', 'recharges failed', { traceId, err: rechargesError })
    }

    if (dailyUsageRes.status === 'fulfilled') {
      dailyUsageRecords = dailyUsageRes.value
    } else {
      dailyUsageError =
        dailyUsageRes.reason instanceof Error
          ? dailyUsageRes.reason.message
          : '每日用量账单拉取失败'
      crmWarn('tenant-billing-import', 'daily usage failed', { traceId, err: dailyUsageError })
    }

    const dailyTaskDetails: CachedBillingImport['dailyTaskDetails'] = []
    let dailyTaskDetailsError: string | undefined

    if (dailyUsageRecords.length > 0 && !dailyUsageError) {
      try {
        for (let i = 0; i < dailyUsageRecords.length; i++) {
          const row = dailyUsageRecords[i]!
          if (i > 0) {
            await delayBillingApi(BILLING_API_PAGE_DELAY_MS, 'daily_task_summary:interval')
          }
          const tasks = await fetchPlatformDailyTaskSummaries({
            platformTenantId: tenant.platformTenantId!,
            taskType: row.task_type,
            startTime: row.start_time,
            endTime: row.end_time,
            traceId,
          })
          const usageDate = usageDateFromPlatformPeriod(row.start_time)
          const { productLine } = mapPlatformTaskType(row.task_type)
          for (const task of tasks) {
            if (!task.task_id) continue
            dailyTaskDetails.push({ usageDate, productLine, record: task })
          }
        }
      } catch (e) {
        dailyTaskDetailsError =
          e instanceof Error ? e.message : '每日任务消费明细拉取失败'
        crmWarn('tenant-billing-import', 'daily task details failed', {
          traceId,
          err: dailyTaskDetailsError,
        })
      }
    }

    if (billRecords.length > 0) {
      await delayBillingApi(BILLING_IMPORT_SECTION_DELAY_MS, 'section:bill_details')
      try {
        detailRecords = await fetchPlatformBillDetailsForOverview({
          platformTenantId: tenant.platformTenantId!,
          overviewRows: billRecords,
          traceId,
        })
      } catch (e) {
        detailsError = e instanceof Error ? e.message : '账单明细拉取失败'
        crmWarn('tenant-billing-import', 'details failed', { traceId, err: detailsError })
      }
    } else if (!billsError) {
      detailsError = undefined
    } else {
      detailsError = '月度账单拉取失败，无法获取账单明细'
    }

    const [existingOrders, existingBills, existingRecharges, existingBillRows, existingDailyUsage] =
      await Promise.all([
        db
          .select({ id: commerceOrder.id, orderNo: commerceOrder.orderNo, amount: commerceOrder.amount })
          .from(commerceOrder)
          .where(eq(commerceOrder.tenantId, tenant.id)),
        db
          .select({
            id: tenantBill.id,
            billMonth: tenantBill.billMonth,
            totalAmount: tenantBill.totalAmount,
            couponAmount: tenantBill.couponAmount,
            balanceAmount: tenantBill.balanceAmount,
          })
          .from(tenantBill)
          .where(eq(tenantBill.tenantId, tenant.id)),
        db
          .select({
            id: recharge.id,
            transactionId: recharge.transactionId,
            amount: recharge.amount,
            status: recharge.status,
          })
          .from(recharge)
          .where(eq(recharge.tenantId, tenant.id)),
        db
          .select({ id: tenantBill.id, billMonth: tenantBill.billMonth })
          .from(tenantBill)
          .where(eq(tenantBill.tenantId, tenant.id)),
        db
          .select({
            id: consumptionUsageDaily.id,
            usageDate: consumptionUsageDaily.usageDate,
            productLine: consumptionUsageDaily.productLine,
            amount: consumptionUsageDaily.amount,
            voucherAmount: consumptionUsageDaily.voucherAmount,
            balanceAmount: consumptionUsageDaily.balanceAmount,
          })
          .from(consumptionUsageDaily)
          .where(eq(consumptionUsageDaily.tenantId, tenant.id)),
      ])

    const existingByOrderNo = new Map(
      existingOrders
        .filter((o) => o.orderNo)
        .map((o) => [o.orderNo!, { id: o.id, amount: String(o.amount) }]),
    )
    const existingByMonth = new Map(
      existingBills.map((b) => [
        b.billMonth,
        {
          id: b.id,
          totalAmount: String(b.totalAmount),
          couponAmount: String(b.couponAmount),
          balanceAmount: String(b.balanceAmount),
        },
      ]),
    )
    const existingByTx = new Map(
      existingRecharges
        .filter((r) => r.transactionId)
        .map((r) => [
          r.transactionId!,
          { id: r.id, amount: String(r.amount), status: r.status },
        ]),
    )

    const existingDailyUsageByKey = new Map(
      existingDailyUsage.map((row) => [
        `${String(row.usageDate).slice(0, 10)}:${row.productLine ?? ''}`,
        {
          id: row.id,
          amount: String(row.amount ?? '0'),
          voucherAmount: String(row.voucherAmount ?? '0'),
          balanceAmount: String(row.balanceAmount ?? '0'),
        },
      ]),
    )

    const billIds = existingBillRows.map((b) => b.id)
    const existingDetailsByBillMonth = new Map<
      string,
      Map<string, { amount: string; couponAmount: string }>
    >()
    if (billIds.length > 0) {
      const detailRows = await db
        .select({
          billId: tenantBillDetail.billId,
          productLine: tenantBillDetail.productLine,
          resourceName: tenantBillDetail.resourceName,
          amount: tenantBillDetail.amount,
          couponAmount: tenantBillDetail.couponAmount,
        })
        .from(tenantBillDetail)
        .where(inArray(tenantBillDetail.billId, billIds))

      const monthByBillId = new Map(existingBillRows.map((b) => [b.id, b.billMonth]))
      for (const row of detailRows) {
        const month = monthByBillId.get(row.billId)
        if (!month) continue
        if (!existingDetailsByBillMonth.has(month)) {
          existingDetailsByBillMonth.set(month, new Map())
        }
        existingDetailsByBillMonth.get(month)!.set(
          `${row.productLine ?? ''}:${row.resourceName ?? ''}`,
          {
            amount: String(row.amount),
            couponAmount: String(row.couponAmount),
          },
        )
      }
    }

    const metalBuilt = buildMetalPreview(metalRecords, existingByOrderNo)
    const billsBuilt = buildMonthlyBillPreview(billRecords, existingByMonth)
    const rechargesBuilt = buildRechargePreview(rechargeRecords, existingByTx)
    const dailyUsageBuilt = buildDailyUsagePreview(dailyUsageRecords, existingDailyUsageByKey)
    const { groups: billDetailGroups, items: rawDetailItems } =
      expandBillDetails(detailRecords)
    const billDetailItems = diffBillDetailItems(rawDetailItems, existingDetailsByBillMonth)

    if (
      billRecords.length > 0 &&
      !billsError &&
      billDetailGroups.length === 0 &&
      !detailsError
    ) {
      detailsError = '月度账单有数据但明细为空，请检查平台接口返回'
      crmWarn('tenant-billing-import', 'details empty despite bills', {
        traceId,
        billCount: billRecords.length,
        detailRecordCount: detailRecords.length,
        detailItemCount: rawDetailItems.length,
      })
    }

    const previewId = newId()
    previewCache.set(previewId, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      traceId,
      tenantId: tenant.id,
      customerId: tenant.customerId,
      platformTenantId: tenant.platformTenantId!,
      metalOrders: metalBuilt.cached,
      monthlyBills: billsBuilt.cached,
      recharges: rechargesBuilt.cached,
      dailyUsageBills: dailyUsageBuilt.cached,
      dailyTaskDetails,
      billDetailGroups,
      billDetailItems,
    })

    const result: TenantBillingImportPreviewResult = {
      previewId,
      tenant: {
        platformTenantId: tenant.platformTenantId!,
        name: tenant.name,
      },
      dateRange: {
        startDate: input.startDate,
        endDate: input.endDate,
      },
      sections: {
        metalOrders: section(metalBuilt.preview, metalError),
        monthlyBills: section(billsBuilt.preview, billsError),
        recharges: section(rechargesBuilt.preview, rechargesError),
        dailyUsageBills: section(dailyUsageBuilt.preview, dailyUsageError),
        billDetails: section(billDetailItems, detailsError),
      },
    }

    crmLog('tenant-billing-import', 'fetch done', {
      traceId,
      previewId,
      metal: metalBuilt.preview.length,
      bills: billsBuilt.preview.length,
      recharges: rechargesBuilt.preview.length,
      dailyUsage: dailyUsageBuilt.preview.length,
      dailyTaskDetails: dailyTaskDetails.length,
      details: billDetailItems.length,
      dailyTaskDetailsError,
    })

    return result
  },

  async commitImport(previewId: string): Promise<TenantBillingImportCommitResult> {
    purgeExpiredCache()
    const cached = previewCache.get(previewId)
    if (!cached || cached.expiresAt <= Date.now()) {
      throw new Error('预览已过期，请重新点击「确认」获取数据')
    }

    const traceId = cached.traceId
    crmLog('tenant-billing-import', 'commit start', { traceId, previewId })

    const result: TenantBillingImportCommitResult = {
      metalOrders: { created: 0, updated: 0, errors: [] },
      monthlyBills: { created: 0, updated: 0, errors: [] },
      recharges: { created: 0, updated: 0, errors: [] },
      dailyUsageBills: { created: 0, updated: 0, errors: [] },
      dailyConsumptionDetails: { created: 0, updated: 0, errors: [] },
      billDetails: { created: 0, updated: 0, deleted: 0, errors: [] },
    }

    const billIdByMonth = new Map<string, string>()

    try {
      await db.transaction(async (tx) => {
        for (const item of cached.monthlyBills) {
          if (item.action === 'skip') continue
          try {
            const { record, billMonth } = item
            const totalAmount = platformBillingValueToMoneyString(record.total_billing_value)
            const couponAmount = platformBillingValueToMoneyString(record.total_discount_value)
            const balanceAmount = platformBillingValueToRmb(
              record.total_billing_value - record.total_discount_value,
            ).toFixed(4)
            const periodStart = parsePlatformDateTime(record.start_time)
            const periodEnd = parsePlatformDateTime(record.end_time)
            const existing = await tx.query.tenantBill.findFirst({
              where: and(
                eq(tenantBill.tenantId, cached.tenantId),
                eq(tenantBill.billMonth, billMonth),
              ),
              columns: { id: true },
            })

            const payload = {
              customerId: cached.customerId,
              tenantId: cached.tenantId,
              projectId: null,
              billMonth,
              totalAmount,
              balanceAmount,
              couponAmount,
              status: 'paid',
              dueDate: dueDateForBillMonth(billMonth),
              paidAt: periodEnd,
              platformPeriodStart: periodStart,
              platformPeriodEnd: periodEnd,
            }

            if (existing) {
              await tx
                .update(tenantBill)
                .set(payload)
                .where(eq(tenantBill.id, existing.id))
              billIdByMonth.set(billMonth, existing.id)
              result.monthlyBills.updated += 1
            } else {
              const id = newId()
              await tx.insert(tenantBill).values({ id, ...payload })
              billIdByMonth.set(billMonth, id)
              result.monthlyBills.created += 1
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : '写入失败'
            result.monthlyBills.errors.push({ key: item.billMonth, message })
            crmWarn('tenant-billing-import', 'bill row failed', {
              traceId,
              billMonth: item.billMonth,
              err: message,
            })
          }
        }

        for (const group of cached.billDetailGroups) {
          const skipAll = cached.billDetailItems
            .filter((i) => i.billMonth === group.billMonth)
            .every((i) => i.action === 'skip')
          if (skipAll) continue

          try {
            let billId = billIdByMonth.get(group.billMonth)
            if (!billId) {
              const existing = await tx.query.tenantBill.findFirst({
                where: and(
                  eq(tenantBill.tenantId, cached.tenantId),
                  eq(tenantBill.billMonth, group.billMonth),
                ),
                columns: { id: true },
              })
              billId = existing?.id
            }
            if (!billId) {
              throw new Error(`缺少 ${group.billMonth} 账单头`)
            }

            const deleted = await tx
              .delete(tenantBillDetail)
              .where(eq(tenantBillDetail.billId, billId))
              .returning({ id: tenantBillDetail.id })
            result.billDetails.deleted = (result.billDetails.deleted ?? 0) + deleted.length

            for (const line of group.lines) {
              await tx.insert(tenantBillDetail).values({
                id: newId(),
                billId,
                productLine: line.productLine,
                resourceName: line.resourceName,
                usage: null,
                unit: null,
                unitPrice: null,
                amount: line.amount,
                balanceAmount: line.balanceAmount,
                couponAmount: line.couponAmount,
                type: line.type,
              })
              result.billDetails.created += 1
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : '明细写入失败'
            result.billDetails.errors.push({ key: group.billMonth, message })
            crmWarn('tenant-billing-import', 'detail group failed', {
              traceId,
              billMonth: group.billMonth,
              err: message,
            })
          }
        }

        for (const item of cached.dailyUsageBills) {
          if (item.action === 'skip') continue
          try {
            const { record, usageDate, productLine } = item
            const amount = platformBillingValueToMoneyString(record.total_billing_value)
            const voucherAmount = platformBillingValueToMoneyString(record.total_discount_value)
            const balanceAmount = platformBillingValueToRmb(
              record.total_billing_value - record.total_discount_value,
            ).toFixed(4)
            const rowId = `usage-daily-${cached.tenantId}-${usageDate}-${productLine}`

            const existing = await tx.query.consumptionUsageDaily.findFirst({
              where: and(
                eq(consumptionUsageDaily.tenantId, cached.tenantId),
                eq(consumptionUsageDaily.usageDate, usageDate),
                eq(consumptionUsageDaily.productLine, productLine),
              ),
              columns: { id: true },
            })

            const payload = {
              customerId: cached.customerId,
              tenantId: cached.tenantId,
              usageDate,
              usageMonth: usageMonthFromDate(usageDate),
              productLine,
              unit: 'day',
              amount,
              voucherAmount,
              balanceAmount,
            }

            if (existing) {
              await tx
                .update(consumptionUsageDaily)
                .set(payload)
                .where(eq(consumptionUsageDaily.id, existing.id))
              result.dailyUsageBills.updated += 1
            } else {
              await tx.insert(consumptionUsageDaily).values({ id: rowId, ...payload })
              result.dailyUsageBills.created += 1
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : '每日用量写入失败'
            result.dailyUsageBills.errors.push({
              key: `${item.usageDate}:${item.productLine}`,
              message,
            })
            crmWarn('tenant-billing-import', 'daily usage row failed', {
              traceId,
              usageDate: item.usageDate,
              productLine: item.productLine,
              err: message,
            })
          }
        }

        for (const item of cached.dailyTaskDetails) {
          try {
            const { record, usageDate, productLine } = item
            const totalAmount = platformBillingValueToMoneyString(record.billing_value)
            const voucherAmount = platformBillingValueToMoneyString(record.discount_value)
            const balanceAmount = platformBillingValueToRmb(
              record.billing_value - record.discount_value,
            ).toFixed(4)
            const idempotencyKey = `${cached.tenantId}|${usageDate}|${productLine}|task|${record.task_id}`
            const rowId = `usage-detail-${cached.tenantId}-${usageDate}-${productLine}-${record.task_id}`

            const existing = await tx.query.tenantConsumptionDailyDetail.findFirst({
              where: eq(tenantConsumptionDailyDetail.platformIdempotencyKey, idempotencyKey),
              columns: { id: true },
            })

            const payload = {
              customerId: cached.customerId,
              tenantId: cached.tenantId,
              usageDate,
              usageMonth: usageMonthFromDate(usageDate),
              productLine,
              dataCenterId: null,
              dataCenterCode: DETAIL_DC_CODE_NA,
              dataCenterName: DETAIL_DC_NAME_NA,
              gpuCardTypeId: null,
              gpuCardTypeCode: DETAIL_GPU_CODE_NA,
              gpuCardTypeName: null,
              platformTaskId: String(record.task_id),
              taskName: record.task_name || null,
              totalAmount,
              voucherAmount,
              balanceAmount,
              source: 'platform_sync',
              platformIdempotencyKey: idempotencyKey,
              rawJson: record,
            }

            if (existing) {
              await tx
                .update(tenantConsumptionDailyDetail)
                .set(payload)
                .where(eq(tenantConsumptionDailyDetail.id, existing.id))
              result.dailyConsumptionDetails.updated += 1
            } else {
              await tx.insert(tenantConsumptionDailyDetail).values({ id: rowId, ...payload })
              result.dailyConsumptionDetails.created += 1
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : '任务明细写入失败'
            result.dailyConsumptionDetails.errors.push({
              key: `${item.usageDate}:${item.record.task_id}`,
              message,
            })
            crmWarn('tenant-billing-import', 'daily task detail row failed', {
              traceId,
              usageDate: item.usageDate,
              taskId: item.record.task_id,
              err: message,
            })
          }
        }

        for (const item of cached.recharges) {
          if (item.action === 'skip') continue
          try {
            const { record } = item
            const amount = platformRechargeAmountToMoneyString(record.total_amount)
            const existing = await tx.query.recharge.findFirst({
              where: eq(recharge.transactionId, record.order_id),
              columns: { id: true },
            })
            const payload = {
              tenantId: cached.tenantId,
              projectId: null,
              amount,
              paymentMethod: mapPayChannel(record.pay_channel),
              status: mapRechargeStatus(record.status),
              transactionId: record.order_id,
              refundAmount: '0',
              remark: record.remark ?? null,
              createdAt: parsePlatformDateTime(record.create_time) ?? new Date(),
              completedAt: record.last_update_time
                ? parsePlatformDateTime(record.last_update_time)
                : null,
            }

            if (existing) {
              await tx.update(recharge).set(payload).where(eq(recharge.id, existing.id))
              result.recharges.updated += 1
            } else {
              await tx.insert(recharge).values({ id: `recharge-${record.id}`, ...payload })
              result.recharges.created += 1
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : '充值写入失败'
            result.recharges.errors.push({ key: item.record.order_id, message })
          }
        }

        for (const item of cached.metalOrders) {
          if (item.action === 'skip') continue
          try {
            const { record } = item
            const amount = platformOrderAmountToMoneyString(record.total_price)
            const orderId = `metal-${record.order_id}`
            const existing = await tx.query.commerceOrder.findFirst({
              where: eq(commerceOrder.orderNo, record.order_no),
              columns: { id: true },
            })

            const gpuCount =
              record.gpu_models?.reduce((sum, g) => sum + (g.gpu_count ?? 0), 0) ?? null
            const deviceModel = record.gpu_models?.[0]?.gpu_model ?? null

            const orderPayload = {
              orderNo: record.order_no,
              customerId: cached.customerId,
              tenantId: cached.tenantId,
              projectId: null,
              productLine: 'bare_metal',
              status: mapMetalOrderStatus(record.status),
              dataCenterId: null,
              dataCenterName: record.idc_name ?? null,
              amount,
              balanceAmount: amount,
              couponAmount: '0',
              discountAmount: '0',
              deviceCount: record.device_count ?? null,
              deviceModel,
              gpuCount,
              unit: mapMetalBillingUnit(record.billing_type),
              createdAt: parsePlatformDateTime(record.create_time) ?? new Date(),
              completedAt:
                record.status === 'Finished'
                  ? parsePlatformDateTime(record.create_time)
                  : null,
            }

            let targetOrderId = orderId
            if (existing) {
              targetOrderId = existing.id
              await tx.update(commerceOrder).set(orderPayload).where(eq(commerceOrder.id, existing.id))
              await tx
                .delete(commerceOrderItem)
                .where(eq(commerceOrderItem.orderId, existing.id))
              result.metalOrders.updated += 1
            } else {
              await tx.insert(commerceOrder).values({ id: orderId, ...orderPayload })
              result.metalOrders.created += 1
            }

            const models = record.gpu_models?.length
              ? record.gpu_models
              : [{ gpu_model: deviceModel ?? 'GPU', gpu_count: gpuCount ?? 1, total_price: record.total_price }]

            for (let i = 0; i < models.length; i++) {
              const g = models[i]!
              const lineTotal = platformOrderAmountToMoneyString(g.total_price ?? record.total_price)
              const qty = g.gpu_count ?? 1
              await tx.insert(commerceOrderItem).values({
                id: `${targetOrderId}-item-${i}`,
                orderId: targetOrderId,
                name: g.gpu_model ?? 'GPU',
                quantity: String(qty),
                unitPrice: platformOrderAmountToRmb(Number(lineTotal) / qty).toFixed(4),
                total: lineTotal,
                sortOrder: i,
              })
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : '订单写入失败'
            result.metalOrders.errors.push({ key: item.record.order_no, message })
          }
        }
      })
    } catch (e) {
      crmError('tenant-billing-import', 'commit transaction failed', e, { traceId, previewId })
      throw e instanceof Error ? e : new Error('导入事务失败')
    } finally {
      previewCache.delete(previewId)
    }

    crmLog('tenant-billing-import', 'commit done', {
      traceId,
      previewId,
      ...result,
    })

    return result
  },

  /**
   * 拉取预览并直接写入（平台批量导入场景，跳过用户确认账单预览）
   */
  async directImport(input: {
    tenantId: string
    startDate?: string
    endDate?: string
  }): Promise<PlatformImportBillingItemResult> {
    const tenant = await resolveTenant(input.tenantId)
    const base = {
      platformTenantId: tenant.platformTenantId!,
      tenantName: tenant.name,
    }

    try {
      const preview = await tenantBillingImportDataAccess.fetchPreview(input)
      const toWrite = Object.values(preview.sections).reduce(
        (n, s) => n + s.summary.toCreate + s.summary.toUpdate,
        0,
      )

      if (toWrite === 0) {
        return {
          ...base,
          success: true,
          summary: '均已同步，无需写入',
        }
      }

      const commitResult = await tenantBillingImportDataAccess.commitImport(preview.previewId)
      const sectionErrors = [
        ...commitResult.metalOrders.errors,
        ...commitResult.monthlyBills.errors,
        ...commitResult.recharges.errors,
        ...commitResult.dailyUsageBills.errors,
        ...commitResult.billDetails.errors,
      ]
      const summary = formatBillingCommitSummary(commitResult)

      if (sectionErrors.length > 0) {
        return {
          ...base,
          success: false,
          summary,
          error: sectionErrors.map((e) => e.message).join('；'),
        }
      }

      return {
        ...base,
        success: true,
        summary,
      }
    } catch (e) {
      return {
        ...base,
        success: false,
        error: e instanceof Error ? e.message : '账单导入失败',
      }
    }
  },

  async syncBillingForProject(input: {
    projectId: string
    startDate?: string
    endDate?: string
  }): Promise<PlatformImportBillingBatchResult> {
    validateBillingDateRange(input.startDate, input.endDate)

    const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(input.projectId)
    if (tenantIds.length === 0) {
      throw new Error('未找到关联计费租户')
    }

    const tenantRows = await db
      .select({
        id: billingTenant.id,
        name: billingTenant.name,
        platformTenantId: billingTenant.platformTenantId,
      })
      .from(billingTenant)
      .where(inArray(billingTenant.id, tenantIds))

    const tenantById = new Map(tenantRows.map((row) => [row.id, row]))
    const items: PlatformImportBillingItemResult[] = []

    for (const tenantId of tenantIds) {
      const tenant = tenantById.get(tenantId)
      if (!tenant) continue

      if (!tenant.platformTenantId?.trim()) {
        items.push({
          platformTenantId: '',
          tenantName: tenant.name,
          success: false,
          error: '未关联平台租户 ID',
        })
        continue
      }

      const result = await tenantBillingImportDataAccess.directImport({
        tenantId: tenant.id,
        startDate: input.startDate,
        endDate: input.endDate,
      })
      items.push(result)
    }

    return {
      items,
      successCount: items.filter((item) => item.success).length,
      failedCount: items.filter((item) => !item.success).length,
    }
  },
}

export { SuanliBillingApiError }
