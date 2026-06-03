import { z } from 'zod'
import { getBlackListAPI } from '@/lib/server/integrations/api'
import { formatSuanliOpenApiError } from '@/lib/server/integrations/suanli-api-errors'
import { BLACKLIST_SYNC_PAGE_SIZE, TENANT_BLACKLIST_TYPE } from '@/lib/crm/tenant-blacklist-utils'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'

const blacklistRecordSchema = z.object({
  id: z.number(),
  type: z.string(),
  correlation_id: z.string(),
  status: z.string(),
  create_time: z.string().optional(),
  last_update_time: z.string().optional(),
  remark: z.string().nullable().optional(),
  tenant_name: z.string().nullable().optional(),
  merchant_id: z.number().optional(),
})

const blacklistListDataSchema = z.object({
  results: z.array(blacklistRecordSchema).optional(),
  count: z.number().optional(),
})

export type PlatformBlacklistRecord = z.infer<typeof blacklistRecordSchema>

export class TenantBlacklistApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'TenantBlacklistApiError'
  }
}

export type FetchBlacklistPagesParams = {
  startTime: string
  endTime: string
  pageSize?: number
}

export async function fetchAllBlacklistPages(
  params: FetchBlacklistPagesParams,
): Promise<{ records: PlatformBlacklistRecord[]; platformCount: number }> {
  const pageSize = params.pageSize ?? BLACKLIST_SYNC_PAGE_SIZE
  const records: PlatformBlacklistRecord[] = []
  let page = 1
  let platformCount = 0

  crmLog('tenant-blacklist-api', 'fetch start', {
    startTime: params.startTime,
    endTime: params.endTime,
    pageSize,
  })

  while (true) {
    let raw: unknown
    try {
      raw = await getBlackListAPI({
        status: '',
        types: TENANT_BLACKLIST_TYPE,
        start_time: params.startTime,
        end_time: params.endTime,
        correlation_id: '',
        tenant_name: '',
        page,
        page_size: pageSize,
      })
    } catch (e) {
      crmError('tenant-blacklist-api', 'fetch failed', e, { page })
      throw new TenantBlacklistApiError(
        formatSuanliOpenApiError(e),
        e instanceof Error && 'code' in e ? String((e as { code?: string }).code) : undefined,
      )
    }

    const parsed = blacklistListDataSchema.safeParse(raw)
    if (!parsed.success) {
      crmWarn('tenant-blacklist-api', 'schema mismatch', {
        page,
        issues: parsed.error.issues.slice(0, 3),
      })
      throw new TenantBlacklistApiError('平台黑名单返回数据格式异常')
    }

    const batch = parsed.data.results ?? []
    if (page === 1) {
      platformCount = parsed.data.count ?? batch.length
    }

    records.push(...batch)

    crmLog('tenant-blacklist-api', 'page ok', {
      page,
      batchSize: batch.length,
      totalSoFar: records.length,
      platformCount,
    })

    if (batch.length === 0 || page * pageSize >= platformCount) {
      break
    }
    page += 1
  }

  return { records, platformCount }
}

export function parsePlatformBlacklistTime(raw?: string | null): Date | null {
  if (!raw?.trim()) return null
  const d = new Date(raw.trim().replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}
