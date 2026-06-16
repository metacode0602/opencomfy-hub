import 'server-only'

import type { FeishuRuntimeConfig } from './config'

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis'

type TenantTokenResponse = {
  code: number
  msg: string
  tenant_access_token?: string
  expire?: number
}

type FeishuApiResponse<T> = {
  code: number
  msg: string
  data?: T
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function fetchFeishuTenantAccessToken(config: FeishuRuntimeConfig): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token
  }

  const res = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
    cache: 'no-store',
  })
  const json = (await res.json()) as TenantTokenResponse
  if (json.code !== 0 || !json.tenant_access_token) {
    throw new Error(json.msg || '获取飞书 tenant_access_token 失败')
  }
  cachedToken = {
    token: json.tenant_access_token,
    expiresAt: now + (json.expire ?? 7200) * 1000,
  }
  return json.tenant_access_token
}

export async function feishuApiRequest<T>(
  config: FeishuRuntimeConfig,
  method: 'GET' | 'POST',
  path: string,
  options?: { body?: unknown; query?: Record<string, string | number | undefined> },
): Promise<T> {
  const token = await fetchFeishuTenantAccessToken(config)
  const url = new URL(`${FEISHU_BASE_URL}${path}`)
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value != null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options?.body != null ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })
  const json = (await res.json()) as FeishuApiResponse<T>
  if (json.code !== 0) {
    throw new Error(json.msg || `飞书 API 失败: ${path}`)
  }
  return json.data as T
}
