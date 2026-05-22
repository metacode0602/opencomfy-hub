import { z } from 'zod'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import {
  toBillDetailQueryTimes,
  toMetalOrderQueryTimes,
  toMonthlyBillQueryTimes,
  toRechargeQueryTimes,
} from '@/lib/crm/tenant-billing-import-utils'

import adminInstance from './request'
import {
  BILLING_API_DETAIL_DELAY_MS,
  BILLING_API_PAGE_DELAY_MS,
  delayBillingApi,
  throttleBillingApiRequest,
} from './suanli-billing-api-throttle'

const PAGE_SIZE = 100

async function throttledGet<T>(
  label: string,
  url: string,
  config?: { params?: Record<string, unknown> },
): Promise<T> {
  await throttleBillingApiRequest(label)
  return adminInstance.get<T>(url, config)
}

async function throttledPost<T>(
  label: string,
  url: string,
  data?: Record<string, unknown> | object,
): Promise<T> {
  await throttleBillingApiRequest(label)
  return adminInstance.post<T>(url, data)
}

export class SuanliBillingApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'SuanliBillingApiError'
  }
}

function parseApiError(e: unknown): never {
  if (e instanceof SuanliBillingApiError) throw e
  const err = e as { message?: string; code?: string }
  throw new SuanliBillingApiError(err.message ?? '连接算算力平台失败', err.code)
}

const paginatedSchema = z.object({
  count: z.number().optional(),
  results: z.array(z.record(z.string(), z.unknown())).optional(),
})

const gpuModelSchema = z.object({
  gpu_model: z.string().optional(),
  gpu_count: z.number().optional(),
  order_details_id: z.number().optional(),
  order_detail_status: z.string().optional(),
  total_price: z.number().optional(),
  is_paid: z.boolean().optional(),
})

export type PlatformMetalOrderRecord = {
  order_id: number
  order_no: string
  status: string
  tenant_id: number
  buy_count?: number
  device_count?: number
  total_price: number
  create_time: string
  billing_type?: string
  idc_name?: string
  gpu_models?: Array<z.infer<typeof gpuModelSchema>>
  is_paid?: boolean
}

export type PlatformMonthlyBillRecord = {
  start_time: string
  end_time: string
  total_billing_value: number
  total_discount_value: number
}

export type PlatformRechargeRecord = {
  id: number
  tenant_id: number
  order_id: string
  total_amount: number
  pay_channel?: string | null
  status: string
  create_time: string
  last_update_time?: string
  remark?: string | null
}

export type PlatformBillDetailAmounts = Record<
  string,
  { billing_value?: number; discount_value?: number }
>

export type PlatformBillDetailRecord = {
  start_time: string
  end_time: string
  amounts: PlatformBillDetailAmounts
  total_amount?: { billing_value?: number; discount_value?: number }
}

async function fetchAllPages<T>(
  label: string,
  traceId: string,
  fetchPage: (page: number) => Promise<{ count?: number; results: T[] }>,
): Promise<T[]> {
  const all: T[] = []
  let page = 1

  while (true) {
    crmLog('suanli-billing-api', `${label} page`, { traceId, page })
    let batch: { count?: number; results: T[] }
    try {
      batch = await fetchPage(page)
    } catch (e) {
      crmError('suanli-billing-api', `${label} page failed`, e, { traceId, page })
      parseApiError(e)
    }

    const results = batch.results ?? []
    all.push(...results)

    if (results.length < PAGE_SIZE) break
    if (batch.count != null && all.length >= batch.count) break
    page += 1
    if (page > 500) {
      crmWarn('suanli-billing-api', `${label} page limit`, { traceId, pages: page })
      break
    }
    await delayBillingApi(BILLING_API_PAGE_DELAY_MS, `${label}:page-${page}`)
  }

  crmLog('suanli-billing-api', `${label} done`, { traceId, total: all.length })
  return all
}

export async function fetchPlatformMetalOrders(input: {
  platformTenantId: string
  startDate?: string
  endDate?: string
  traceId: string
}): Promise<PlatformMetalOrderRecord[]> {
  const { start_time, end_time } = toMetalOrderQueryTimes(input.startDate, input.endDate)
  const tenantTid = Number(input.platformTenantId)

  const rows = await fetchAllPages<PlatformMetalOrderRecord>(
    'metal_orders',
    input.traceId,
    async (page) => {
      const data = await throttledPost<unknown>('metal_orders', '/admin/metal_order/list', {
        page,
        page_size: PAGE_SIZE,
        conditional: {
          tenant_tid: tenantTid,
          condition: '',
          idc_ids: '',
          status: '',
          is_paid: true,
          start_time,
          end_time,
        },
      })
      const parsed = paginatedSchema.safeParse(data)
      if (!parsed.success) {
        throw new SuanliBillingApiError('裸金属订单返回格式异常')
      }
      const results = (parsed.data.results ?? []).map((row) => {
        const gpu = z.array(gpuModelSchema).optional().parse(row.gpu_models)
        return {
          order_id: Number(row.order_id),
          order_no: String(row.order_no ?? ''),
          status: String(row.status ?? ''),
          tenant_id: Number(row.tenant_id),
          buy_count: row.buy_count != null ? Number(row.buy_count) : undefined,
          device_count: row.device_count != null ? Number(row.device_count) : undefined,
          total_price: Number(row.total_price ?? 0),
          create_time: String(row.create_time ?? ''),
          billing_type: row.billing_type != null ? String(row.billing_type) : undefined,
          idc_name: row.idc_name != null ? String(row.idc_name) : undefined,
          gpu_models: gpu,
          is_paid: row.is_paid === true,
        } satisfies PlatformMetalOrderRecord
      })
      return { count: parsed.data.count, results }
    },
  )

  return rows.filter((r) => r.order_no)
}

export async function fetchPlatformMonthlyBills(input: {
  platformTenantId: string
  startDate?: string
  endDate?: string
  traceId: string
}): Promise<PlatformMonthlyBillRecord[]> {
  const { start_time, end_time } = toMonthlyBillQueryTimes(input.startDate, input.endDate)
  const params: Record<string, string | number> = {
    tenant_tid: input.platformTenantId,
    range: 'month',
    start_time,
    end_time,
    page: 1,
    page_size: PAGE_SIZE,
  }

  return fetchAllPages<PlatformMonthlyBillRecord>(
    'monthly_bills',
    input.traceId,
    async (page) => {
      const data = await throttledGet<unknown>('monthly_bills', '/admin/tenant/billing_record_list', {
        params: { ...params, page },
      })
      const parsed = paginatedSchema.safeParse(data)
      if (!parsed.success) {
        throw new SuanliBillingApiError('月度账单返回格式异常')
      }
      const results = (parsed.data.results ?? []).map((row) => ({
        start_time: String(row.start_time ?? ''),
        end_time: String(row.end_time ?? ''),
        total_billing_value: Number(row.total_billing_value ?? 0),
        total_discount_value: Number(row.total_discount_value ?? 0),
      }))
      return { count: parsed.data.count, results }
    },
  )
}

export async function fetchPlatformRecharges(input: {
  platformTenantId: string
  startDate?: string
  endDate?: string
  traceId: string
}): Promise<PlatformRechargeRecord[]> {
  const { start_time, end_time } = toRechargeQueryTimes(input.startDate, input.endDate)

  return fetchAllPages<PlatformRechargeRecord>(
    'recharges',
    input.traceId,
    async (page) => {
      const data = await throttledGet<unknown>('recharges', '/admin/tenant/coin_order_list', {
        params: {
          tenant_ids: input.platformTenantId,
          status: 'Completed',
          types: '',
          start_time,
          end_time,
          page,
          page_size: PAGE_SIZE,
          order_type: 'Recharge',
        },
      })
      const parsed = paginatedSchema.safeParse(data)
      if (!parsed.success) {
        throw new SuanliBillingApiError('充值列表返回格式异常')
      }
      const results = (parsed.data.results ?? []).map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenant_id),
        order_id: String(row.order_id ?? ''),
        total_amount: Number(row.total_amount ?? 0),
        pay_channel: row.pay_channel != null ? String(row.pay_channel) : null,
        status: String(row.status ?? ''),
        create_time: String(row.create_time ?? ''),
        last_update_time:
          row.last_update_time != null ? String(row.last_update_time) : undefined,
        remark: row.remark != null ? String(row.remark) : null,
      }))
      return { count: parsed.data.count, results }
    },
  )
}

export async function fetchPlatformBillDetailsForOverview(input: {
  platformTenantId: string
  overviewRows: PlatformMonthlyBillRecord[]
  traceId: string
}): Promise<PlatformBillDetailRecord[]> {
  const details: PlatformBillDetailRecord[] = []

  for (let i = 0; i < input.overviewRows.length; i++) {
    const row = input.overviewRows[i]!
    if (!row.start_time || !row.end_time) continue

    if (i > 0) {
      await delayBillingApi(BILLING_API_DETAIL_DELAY_MS, 'bill_detail:interval')
    }

    crmLog('suanli-billing-api', 'bill_detail', {
      traceId: input.traceId,
      index: i + 1,
      total: input.overviewRows.length,
      start: row.start_time,
      end: row.end_time,
    })
    const { start_time, end_time } = toBillDetailQueryTimes(row.start_time, row.end_time)

    try {
      const data = await throttledGet<unknown>(
        'bill_detail',
        '/admin/tenant/billing_record_detail_list',
        {
          params: {
            tenant_tid: input.platformTenantId,
            start_time,
            end_time,
            range: 'month',
          },
        },
      )
      const parsed = paginatedSchema.safeParse(data)
      if (!parsed.success) {
        crmWarn('suanli-billing-api', 'bill_detail schema mismatch', {
          traceId: input.traceId,
        })
        continue
      }
      for (const item of parsed.data.results ?? []) {
        details.push({
          start_time: String(item.start_time ?? row.start_time),
          end_time: String(item.end_time ?? row.end_time),
          amounts: (item.amounts as PlatformBillDetailAmounts) ?? {},
          total_amount: item.total_amount as PlatformBillDetailRecord['total_amount'],
        })
      }
    } catch (e) {
      crmError('suanli-billing-api', 'bill_detail fetch failed', e, {
        traceId: input.traceId,
        start: row.start_time,
      })
      parseApiError(e)
    }
  }

  return details
}
