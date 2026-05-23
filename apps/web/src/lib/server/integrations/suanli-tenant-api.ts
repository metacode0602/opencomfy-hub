import { z } from 'zod'
import type { PlatformTenantApiRecord } from '@/lib/types/platform-tenant-import'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'

import adminInstance from './request'

const BATCH_SIZE = 100

/** 平台部分数值字段以 string 返回（如 limit_coin: '-200000000000'） */
function preprocessNumeric(val: unknown): number | null {
  if (val == null || val === '') return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }
  return null
}

const flexibleNumericNullable = z.preprocess(
  preprocessNumeric,
  z.number().nullable().optional(),
)
const flexibleNumericOptional = flexibleNumericNullable.transform((v) => v ?? undefined)

const platformTenantRecordSchema = z.object({
  id: z.number(),
  tenant_type: z.string().nullable().optional(),
  tenant_name: z.string(),
  admin_id: z.number().optional(),
  create_time: z.string().optional(),
  merchant_id: z.number().optional(),
  coin: flexibleNumericOptional,
  billing_type: z.string().nullable().optional(),
  strategy_type: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  company_description: z.string().nullable().optional(),
  contact_user: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  admin_phone: z.string().nullable().optional(),
  admin_nickname: z.string().nullable().optional(),
  limit_coin: flexibleNumericNullable,
  insufficient_balance: z.union([z.string(), z.boolean(), z.number()]).nullable().optional(),
  merchant_mark: z.string().nullable().optional(),
})

const tenantListDataSchema = z.object({
  results: z.array(platformTenantRecordSchema).optional(),
  count: z.number().optional(),
})

export class SuanliOpenApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'SuanliOpenApiError'
  }
}

async function fetchTenantBatch(
  ids: string[],
  traceId: string,
): Promise<PlatformTenantApiRecord[]> {
  const pageSize = Math.max(20, ids.length)

  crmLog('suanli-api', 'request tenant list', {
    traceId,
    idCount: ids.length,
    pageSize,
  })

  try {
    const data = await adminInstance.get<unknown>('/admin/tenant/list', {
      params: {
        tenant_type: '',
        tenant_name: '',
        remark: '',
        tenant_tids: ids.join(','),
        start_time: '',
        end_time: '',
        page: 1,
        page_size: pageSize,
      },
    })
    const parsed = tenantListDataSchema.safeParse(data)
    if (!parsed.success) {
      crmWarn('suanli-api', 'response schema mismatch', {
        traceId,
        issues: parsed.error.issues.slice(0, 3),
      })
      throw new SuanliOpenApiError('平台返回数据格式异常')
    }

    const results = parsed.data.results ?? []
    crmLog('suanli-api', 'tenant list ok', {
      traceId,
      requested: ids.length,
      returned: results.length,
      count: parsed.data.count,
    })
    return results
  } catch (e) {
    if (e instanceof SuanliOpenApiError) throw e
    crmError('suanli-api', 'fetch failed', e, { traceId, idCount: ids.length })
    throw new SuanliOpenApiError(
      e instanceof Error ? e.message : '连接算算力平台失败',
    )
  }
}

/** 按平台租户 ID 批量拉取（自动拆批） */
export async function fetchPlatformTenantsByIds(
  platformTenantIds: string[],
): Promise<Map<string, PlatformTenantApiRecord>> {
  const traceId = crypto.randomUUID().slice(0, 8)
  const uniqueIds = [...new Set(platformTenantIds)]
  const map = new Map<string, PlatformTenantApiRecord>()

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE)
    const results = await fetchTenantBatch(batch, traceId)
    for (const row of results) {
      map.set(String(row.id), row)
    }
  }

  return map
}

/** 平台 coin/limit_coin（点数）→ 人民币元 */
export const PLATFORM_COIN_DIVISOR = 1_000_000

/** 平台 coin/limit_coin（点数）→ 元，入库前除以 1_000_000 */
export function platformCoinToYuan(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  return value / PLATFORM_COIN_DIVISOR
}

/** 解析平台 create_time → Date */
export function parsePlatformRegisteredAt(
  raw: string | null | undefined,
): Date | null {
  if (!raw?.trim()) return null
  const normalized = raw.trim().replace(' +00:00', 'Z').replace(' ', 'T')
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 解析 insufficient_balance → overdue_at */
export function parsePlatformOverdueAt(
  raw: string | boolean | number | null | undefined,
): Date | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'boolean') return null
  if (typeof raw === 'number') {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = raw.trim()
  if (!s) return null
  if (s === 'true' || s === 'false') return null
  const d = new Date(s.replace(/\//g, '-'))
  return Number.isNaN(d.getTime()) ? null : d
}

export function resolveTenantName(record: PlatformTenantApiRecord): string {
  const name = record.tenant_name?.trim()
  if (name) return name
  const phone = record.admin_phone?.trim()
  if (phone) return phone
  return `租户-${record.id}`
}
