import {
  platformBillingValueToRmb,
  platformOrderAmountToRmb,
} from '@/lib/crm/tenant-billing-import-utils'
import type {
  BillDetailPreviewItem,
  MetalOrderPreviewItem,
  MonthlyBillPreviewItem,
  RechargePreviewItem,
  TenantBillingImportCommitResult,
  TenantBillingImportPreviewInput,
  TenantBillingImportPreviewResult,
  TenantBillingImportSection,
  TenantBillingImportSectionSummary,
} from '@/lib/types/tenant-billing-import'

/** 平台整数 → 人民币元（与 tenant-billing-import-utils 一致） */
function mockBillingValueToRmb(raw: number): number {
  return platformBillingValueToRmb(raw)
}

function mockOrderAmountToRmb(raw: number): number {
  return platformOrderAmountToRmb(raw)
}

function summarize<T extends { action: string }>(
  items: T[],
): TenantBillingImportSectionSummary {
  return {
    total: items.length,
    toCreate: items.filter((i) => i.action === 'create').length,
    toUpdate: items.filter((i) => i.action === 'update').length,
    skipped: items.filter((i) => i.action === 'skip').length,
  }
}

function section<T extends { action: string }>(
  items: T[],
  error?: string,
): TenantBillingImportSection<T> {
  return { summary: summarize(items), items, error }
}

/** 基于设计文档 / OpenAPI 样例（租户 984）的静态 mock 行 */
function buildMockMetalOrders(): MetalOrderPreviewItem[] {
  return [
    {
      key: 'metal-47',
      action: 'create',
      orderNo: '1779249022888',
      status: '已完成',
      idcName: '千岛湖机房',
      amountRmb: mockOrderAmountToRmb(260_000_000),
      deviceCount: 1,
      gpuSummary: '5090 × 8',
      createTime: '2026-05-20 11:50:22',
    },
    {
      key: 'metal-38',
      action: 'update',
      orderNo: '1778119022001',
      status: '已完成',
      idcName: '千岛湖机房',
      amountRmb: mockOrderAmountToRmb(180_000_000),
      deviceCount: 1,
      gpuSummary: '4090 × 8',
      createTime: '2026-04-12 09:20:10',
    },
  ]
}

function buildMockMonthlyBills(): MonthlyBillPreviewItem[] {
  const mayTotal = mockBillingValueToRmb(234_703_140_855)
  const mayCoupon = mockBillingValueToRmb(26_339_564)
  const aprTotal = mockBillingValueToRmb(110_440_220_825)
  const aprCoupon = mockBillingValueToRmb(11_776_786)

  return [
    {
      key: 'bill-2026-05',
      action: 'create',
      billMonth: '2026-05',
      periodStart: '2026-05-01T00:00:00+08:00',
      periodEnd: '2026-06-01T00:00:00+08:00',
      totalAmountRmb: mayTotal,
      couponAmountRmb: mayCoupon,
      balanceAmountRmb: mayTotal - mayCoupon,
    },
    {
      key: 'bill-2026-04',
      action: 'update',
      billMonth: '2026-04',
      periodStart: '2026-04-01T00:00:00+08:00',
      periodEnd: '2026-05-01T00:00:00+08:00',
      totalAmountRmb: aprTotal,
      couponAmountRmb: aprCoupon,
      balanceAmountRmb: aprTotal - aprCoupon,
    },
  ]
}

function buildMockRecharges(): RechargePreviewItem[] {
  return [
    {
      key: 'recharge-14431',
      action: 'create',
      transactionId: '1779110321760:984',
      amountRmb: mockOrderAmountToRmb(43_000_000),
      payChannel: '线下转账',
      status: '已完成',
      createTime: '2026-05-18 21:18:41',
    },
    {
      key: 'recharge-14332',
      action: 'create',
      transactionId: '1778747920013:984',
      amountRmb: mockOrderAmountToRmb(1_424_925),
      payChannel: '线下转账',
      status: '已完成',
      createTime: '2026-05-14 16:38:40',
      remark: '3月份费用，平台消费14,249.25，已对公转账',
    },
    {
      key: 'recharge-2688',
      action: 'skip',
      transactionId: '1754110187907-984',
      amountRmb: mockOrderAmountToRmb(5_000),
      payChannel: '微信',
      status: '已完成',
      createTime: '2025-08-02 12:49:47',
    },
  ]
}

function buildMockBillDetails(): BillDetailPreviewItem[] {
  const rows: Omit<BillDetailPreviewItem, 'key' | 'action'>[] = [
    {
      billMonth: '2026-05',
      productLine: 'pod_deployment',
      resourceName: 'Deployment',
      amountRmb: mockBillingValueToRmb(233_107_978_313),
      couponAmountRmb: 0,
      balanceAmountRmb: mockBillingValueToRmb(233_107_978_313),
    },
    {
      billMonth: '2026-05',
      productLine: 'bare_metal',
      resourceName: '裸金属整租',
      amountRmb: mockBillingValueToRmb(1_550_240_000),
      couponAmountRmb: 0,
      balanceAmountRmb: mockBillingValueToRmb(1_550_240_000),
    },
    {
      billMonth: '2026-05',
      productLine: 'harbor',
      resourceName: 'Harbor',
      amountRmb: mockBillingValueToRmb(108_879_322),
      couponAmountRmb: mockBillingValueToRmb(7_500_000),
      balanceAmountRmb:
        mockBillingValueToRmb(108_879_322) - mockBillingValueToRmb(7_500_000),
    },
    {
      billMonth: '2026-05',
      productLine: 'juicefs',
      resourceName: 'JuiceFS',
      amountRmb: mockBillingValueToRmb(23_217_308),
      couponAmountRmb: mockBillingValueToRmb(18_000_000),
      balanceAmountRmb:
        mockBillingValueToRmb(23_217_308) - mockBillingValueToRmb(18_000_000),
    },
    {
      billMonth: '2026-04',
      productLine: 'pod_deployment',
      resourceName: 'Deployment',
      amountRmb: mockBillingValueToRmb(98_220_100_000),
      couponAmountRmb: 0,
      balanceAmountRmb: mockBillingValueToRmb(98_220_100_000),
    },
    {
      billMonth: '2026-04',
      productLine: 'share_storage',
      resourceName: '共享存储',
      amountRmb: mockBillingValueToRmb(839_880),
      couponAmountRmb: mockBillingValueToRmb(839_880),
      balanceAmountRmb: 0,
    },
  ]

  return rows.map((row, idx) => ({
    ...row,
    key: `detail-${row.billMonth}-${idx}`,
    action: idx % 3 === 0 ? 'update' : 'create',
  }))
}

function buildMockDailyUsageBills() {
  return [
    {
      key: 'daily-2025-11-10-pod_deployment',
      action: 'create' as const,
      usageDate: '2025-11-10',
      taskType: 'Deployment',
      productLine: 'pod_deployment',
      periodStart: '2025-11-10T00:00:00+08:00',
      periodEnd: '2025-11-11T00:00:00+08:00',
      totalAmountRmb: mockBillingValueToRmb(117_898),
      couponAmountRmb: mockBillingValueToRmb(117_898),
      balanceAmountRmb: 0,
    },
  ]
}

const previewCache = new Map<string, TenantBillingImportPreviewResult>()

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function validateDateRange(startDate?: string, endDate?: string) {
  const hasStart = Boolean(startDate?.trim())
  const hasEnd = Boolean(endDate?.trim())
  if (hasStart !== hasEnd) {
    throw new Error('开始日期与结束日期须同时填写或同时留空')
  }
  if (hasStart && hasEnd && startDate! > endDate!) {
    throw new Error('开始日期不能晚于结束日期')
  }
}

/**
 * Mock：点击「确认」拉取预览（后续替换为 tRPC fetchBillingImportPreview）
 */
export async function mockFetchTenantBillingImportPreview(
  input: TenantBillingImportPreviewInput,
): Promise<TenantBillingImportPreviewResult> {
  validateDateRange(input.startDate, input.endDate)

  if (!input.platformTenantId?.trim()) {
    throw new Error('该租户未关联平台 ID，请先从平台导入租户')
  }

  await delay(900)

  const previewId = crypto.randomUUID()
  const metalOrders = buildMockMetalOrders()
  const monthlyBills = buildMockMonthlyBills()
  const recharges = buildMockRecharges()
  const dailyUsageBills = buildMockDailyUsageBills()
  const billDetails = buildMockBillDetails()

  const result: TenantBillingImportPreviewResult = {
    previewId,
    tenant: {
      platformTenantId: input.platformTenantId,
      name: input.tenantName,
    },
    dateRange: {
      startDate: input.startDate,
      endDate: input.endDate,
    },
    sections: {
      metalOrders: section(metalOrders),
      monthlyBills: section(monthlyBills),
      recharges: section(recharges),
      dailyUsageBills: section(dailyUsageBills),
      billDetails: section(billDetails),
    },
  }

  previewCache.set(previewId, result)
  return result
}

/**
 * Mock：点击「确认导入」写库（后续替换为 tRPC commitBillingImport）
 */
export async function mockCommitTenantBillingImport(
  previewId: string,
): Promise<TenantBillingImportCommitResult> {
  const preview = previewCache.get(previewId)
  if (!preview) {
    throw new Error('预览已过期，请重新点击「确认」获取数据')
  }

  await delay(1200)

  previewCache.delete(previewId)

  const fromSection = (s: TenantBillingImportSection<{ key: string }>) => ({
    created: s.summary.toCreate,
    updated: s.summary.toUpdate,
    deleted: s.items.length > 0 ? 0 : undefined,
    errors: s.error ? [{ key: 'section', message: s.error }] : [],
  })

  return {
    metalOrders: fromSection(preview.sections.metalOrders),
    monthlyBills: fromSection(preview.sections.monthlyBills),
    recharges: fromSection(preview.sections.recharges),
    dailyUsageBills: fromSection(preview.sections.dailyUsageBills),
    billDetails: {
      ...fromSection(preview.sections.billDetails),
      deleted: 2,
    },
  }
}

/** 演示：某平台 ID 拉取失败（可在 UI 开发时切换） */
export async function mockFetchTenantBillingImportPreviewWithPartialError(
  input: TenantBillingImportPreviewInput,
): Promise<TenantBillingImportPreviewResult> {
  const result = await mockFetchTenantBillingImportPreview(input)
  return {
    ...result,
    sections: {
      ...result.sections,
      recharges: {
        ...result.sections.recharges,
        items: [],
        summary: { total: 0, toCreate: 0, toUpdate: 0, skipped: 0 },
        error: '平台充值列表接口超时，请稍后重试',
      },
    },
  }
}
