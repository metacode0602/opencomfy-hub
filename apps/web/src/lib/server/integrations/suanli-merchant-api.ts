import { z } from 'zod'
import adminInstance from './request'

const PAGE_SIZE = 100

const platformMerchantRecordSchema = z.object({
  id: z.number(),
  merchant_mark: z.string().nullable().optional(),
  create_time: z.string().nullable().optional(),
  tenant_ids: z.array(z.number()).optional(),
  tenant_types: z.array(z.string()).optional(),
  company_name: z.string().nullable().optional(),
  company_description: z.string().nullable().optional(),
  contact_user: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
})

const merchantListDataSchema = z.object({
  results: z.array(platformMerchantRecordSchema).optional(),
  count: z.number().optional(),
})

export type PlatformMerchantApiRecord = z.infer<typeof platformMerchantRecordSchema>

export class SuanliMerchantOpenApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'SuanliMerchantOpenApiError'
  }
}

async function fetchMerchantPage(page: number): Promise<{
  results: PlatformMerchantApiRecord[]
  count: number
}> {
  try {
    const data = await adminInstance.get<unknown>('/admin/merchant/list', {
      params: {
        merchant_mark: '',
        start_time: '',
        end_time: '',
        page,
        page_size: PAGE_SIZE,
      },
    })

    const parsed = merchantListDataSchema.safeParse(data)
    if (!parsed.success) {
      throw new SuanliMerchantOpenApiError('平台返回数据格式异常')
    }

    return {
      results: parsed.data.results ?? [],
      count: parsed.data.count ?? parsed.data.results?.length ?? 0,
    }
  } catch (e) {
    if (e instanceof SuanliMerchantOpenApiError) throw e
    throw new SuanliMerchantOpenApiError(
      e instanceof Error ? e.message : '连接算算力平台失败',
    )
  }
}

/** 分页拉取平台全部商户 */
export async function fetchAllPlatformMerchants(): Promise<PlatformMerchantApiRecord[]> {
  const first = await fetchMerchantPage(1)
  const total = first.count
  const all = [...first.results]

  if (total <= first.results.length) {
    return all
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  for (let page = 2; page <= totalPages; page++) {
    const batch = await fetchMerchantPage(page)
    all.push(...batch.results)
  }

  return all
}

export function derivePlatformMerchantName(record: PlatformMerchantApiRecord): string {
  const company = record.company_name?.trim()
  if (company) return company
  const mark = record.merchant_mark?.trim()
  if (mark) return mark
  return `商户#${record.id}`
}
