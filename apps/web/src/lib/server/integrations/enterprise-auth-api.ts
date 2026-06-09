import { z } from 'zod'
import { getEnterpriseAuthListAPI } from '@/lib/server/integrations/api'
import { formatSuanliOpenApiError } from '@/lib/server/integrations/suanli-api-errors'
import { crmError, crmLog } from '@/lib/server/dataaccess/crm/logger'

export const ENTERPRISE_AUTH_SYNC_PAGE_SIZE = 100

const enterpriseAuthRecordSchema = z.object({
  audit_id: z.number(),
  tenant_id: z.number(),
  company_name: z.string(),
  company_code: z.string(),
  create_time: z.string().optional(),
  audit_status: z.string(),
  rejected_reason: z.string().nullable().optional(),
  operating_time: z.string().nullable().optional(),
  admin_id: z.number().nullable().optional(),
  admin_phone: z.string().nullable().optional(),
  admin_nickname: z.string().nullable().optional(),
})

const enterpriseAuthListDataSchema = z.object({
  results: z.array(enterpriseAuthRecordSchema).optional(),
  count: z.number().optional(),
})

export type PlatformEnterpriseAuthRecord = z.infer<typeof enterpriseAuthRecordSchema>

export class EnterpriseAuthApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'EnterpriseAuthApiError'
  }
}

export async function fetchAllEnterpriseAuthPages(): Promise<{
  records: PlatformEnterpriseAuthRecord[]
  platformCount: number
}> {
  const pageSize = ENTERPRISE_AUTH_SYNC_PAGE_SIZE
  const records: PlatformEnterpriseAuthRecord[] = []
  let page = 1
  let platformCount = 0

  crmLog('enterprise-auth-api', 'fetch start', { pageSize })

  while (true) {
    let raw: unknown
    try {
      raw = await getEnterpriseAuthListAPI({
        page,
        page_size: pageSize,
        company_name: '',
        company_code: '',
      })
    } catch (e) {
      crmError('enterprise-auth-api', 'fetch failed', e, { page })
      throw new EnterpriseAuthApiError(
        formatSuanliOpenApiError(e),
        e instanceof Error && 'code' in e ? String((e as { code?: string }).code) : undefined,
      )
    }

    const parsed = enterpriseAuthListDataSchema.safeParse(raw)
    if (!parsed.success) {
      throw new EnterpriseAuthApiError('平台企业认证返回数据格式异常')
    }

    const batch = parsed.data.results ?? []
    if (page === 1) {
      platformCount = parsed.data.count ?? batch.length
    }

    records.push(...batch)

    crmLog('enterprise-auth-api', 'page ok', {
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

export function parsePlatformEnterpriseAuthTime(raw?: string | null): Date | null {
  if (!raw?.trim()) return null
  const d = new Date(raw.trim().replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}
