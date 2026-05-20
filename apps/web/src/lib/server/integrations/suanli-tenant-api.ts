import { z } from 'zod'
import type { PlatformTenantApiRecord } from '@/lib/types/platform-tenant-import'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'

const REQUEST_TIMEOUT_MS = 15_000
const BATCH_SIZE = 100

const platformTenantRecordSchema = z.object({
  id: z.number(),
  tenant_type: z.string().nullable().optional(),
  tenant_name: z.string(),
  admin_id: z.number().optional(),
  create_time: z.string().optional(),
  merchant_id: z.number().optional(),
  coin: z.number().optional(),
  billing_type: z.string().nullable().optional(),
  strategy_type: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  company_description: z.string().nullable().optional(),
  contact_user: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  admin_phone: z.string().nullable().optional(),
  admin_nickname: z.string().nullable().optional(),
  limit_coin: z.number().nullable().optional(),
  insufficient_balance: z.union([z.string(), z.boolean(), z.number()]).nullable().optional(),
  merchant_mark: z.string().nullable().optional(),
})

const tenantListResponseSchema = z.object({
  code: z.union([z.string(), z.number()]),
  message: z.string().optional(),
  data: z
    .object({
      results: z.array(platformTenantRecordSchema).optional(),
      count: z.number().optional(),
    })
    .optional(),
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

function getBaseUrl(): string {
  return (
    process.env.SUANLI_OPENAPI_BASE_URL?.trim() || 'https://openapi.suanli.cn'
  ).replace(/\/$/, '')
}

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const token = process.env.SUANLI_OPENAPI_TOKEN?.trim()
  const cookie = process.env.SUANLI_OPENAPI_COOKIE?.trim()
  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  }
  if (cookie) {
    headers.Cookie = cookie
  }
  return headers
}

function isApiSuccess(code: string | number): boolean {
  return String(code) === '0000' || String(code) === '0'
}

async function fetchTenantBatch(
  ids: string[],
  traceId: string,
): Promise<PlatformTenantApiRecord[]> {
  const baseUrl = getBaseUrl()
  const pageSize = Math.max(20, ids.length)
  const params = new URLSearchParams({
    tenant_type: '',
    tenant_name: '',
    remark: '',
    tenant_tids: ids.join(','),
    start_time: '',
    end_time: '',
    page: '1',
    page_size: String(pageSize),
  })
  const url = `${baseUrl}/api/admin/tenant/list?${params.toString()}`

  const token = process.env.SUANLI_OPENAPI_TOKEN?.trim()
  const cookie = process.env.SUANLI_OPENAPI_COOKIE?.trim()
  if (!token && !cookie) {
    throw new SuanliOpenApiError(
      '未配置算算力 OpenAPI 凭证，请在服务端设置 SUANLI_OPENAPI_TOKEN 或 SUANLI_OPENAPI_COOKIE',
    )
  }

  crmLog('suanli-api', 'request tenant list', {
    traceId,
    idCount: ids.length,
    pageSize,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: buildAuthHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new SuanliOpenApiError(
        `平台接口 HTTP ${res.status}：${res.statusText || '请求失败'}`,
      )
    }

    const json: unknown = await res.json()
    const parsed = tenantListResponseSchema.safeParse(json)
    if (!parsed.success) {
      crmWarn('suanli-api', 'response schema mismatch', {
        traceId,
        issues: parsed.error.issues.slice(0, 3),
      })
      throw new SuanliOpenApiError('平台返回数据格式异常')
    }

    const body = parsed.data
    if (!isApiSuccess(body.code)) {
      throw new SuanliOpenApiError(
        body.message?.trim() || '平台接口返回失败',
        String(body.code),
      )
    }

    const results = body.data?.results ?? []
    crmLog('suanli-api', 'tenant list ok', {
      traceId,
      requested: ids.length,
      returned: results.length,
      count: body.data?.count,
    })
    return results
  } catch (e) {
    if (e instanceof SuanliOpenApiError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new SuanliOpenApiError('连接算算力平台超时（15s），请稍后重试')
    }
    crmError('suanli-api', 'fetch failed', e, { traceId, idCount: ids.length })
    throw new SuanliOpenApiError(
      e instanceof Error ? e.message : '连接算算力平台失败',
    )
  } finally {
    clearTimeout(timer)
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

/** 平台 coin/limit_coin → 元（可通过 SUANLI_COIN_UNIT=fen 按分换算） */
export function platformCoinToYuan(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  const unit = (process.env.SUANLI_COIN_UNIT ?? 'yuan').toLowerCase()
  if (unit === 'fen' || unit === 'cent') {
    return value / 100
  }
  return value
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
