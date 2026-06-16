import 'server-only'

import { feishuApiRequest } from './feishu-http'
import type { FeishuRuntimeConfig } from './config'

export type FeishuBitableField = {
  field_id: string
  field_name: string
  type: number
  ui_type?: string
}

export type FeishuBitableRecord = {
  record_id: string
  fields: Record<string, unknown>
  last_modified_time?: number
}

type ListFieldsResponse = {
  items?: FeishuBitableField[]
  has_more?: boolean
  page_token?: string
}

type ListRecordsResponse = {
  items?: FeishuBitableRecord[]
  has_more?: boolean
  page_token?: string
  total?: number
}

const MAX_RECORDS_PER_SYNC = 5000

export async function listFeishuBitableFields(
  config: FeishuRuntimeConfig,
  appToken: string,
  tableId: string,
): Promise<FeishuBitableField[]> {
  const items: FeishuBitableField[] = []
  let pageToken: string | undefined

  do {
    const data = await feishuApiRequest<ListFieldsResponse>(
      config,
      'GET',
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/fields`,
      { query: { page_size: 100, page_token: pageToken } },
    )
    items.push(...(data.items ?? []))
    pageToken = data.has_more ? data.page_token : undefined
  } while (pageToken)

  return items
}

export async function listFeishuBitableRecords(input: {
  config: FeishuRuntimeConfig
  appToken: string
  tableId: string
  viewId?: string | null
  filterFormula?: string | null
  maxRecords?: number
}): Promise<FeishuBitableRecord[]> {
  const maxRecords = input.maxRecords ?? MAX_RECORDS_PER_SYNC
  const items: FeishuBitableRecord[] = []
  let pageToken: string | undefined

  do {
    const data = await feishuApiRequest<ListRecordsResponse>(
      input.config,
      'GET',
      `/bitable/v1/apps/${encodeURIComponent(input.appToken)}/tables/${encodeURIComponent(input.tableId)}/records`,
      {
        query: {
          page_size: Math.min(500, maxRecords - items.length),
          page_token: pageToken,
          view_id: input.viewId ?? undefined,
          filter: input.filterFormula ?? undefined,
        },
      },
    )
    items.push(...(data.items ?? []))
    if (items.length >= maxRecords) break
    pageToken = data.has_more ? data.page_token : undefined
  } while (pageToken)

  return items.slice(0, maxRecords)
}

export function extractFeishuBitableFieldText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => extractFeishuBitableFieldText(item))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.name === 'string') return obj.name
    if (typeof obj.value === 'string' || typeof obj.value === 'number') return String(obj.value)
    if (Array.isArray(obj.users)) {
      return obj.users
        .map((u) => extractFeishuBitableFieldText(u))
        .filter(Boolean)
        .join(', ')
    }
    if (obj.date != null) return String(obj.date)
  }
  return ''
}

export function formatFeishuBitableDateValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    }
  }
  return extractFeishuBitableFieldText(value)
}
