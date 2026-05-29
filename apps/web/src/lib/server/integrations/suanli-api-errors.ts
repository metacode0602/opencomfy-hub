/** 将算算力 OpenAPI 错误转为面向运维/用户的说明 */
export function formatSuanliOpenApiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : '平台请求失败'
  if (isSuanliTokenExpiredMessage(raw)) {
    return '算算力 OpenAPI 令牌已过期，请更新环境变量 SUANLI_OPENAPI_TOKEN（及 RSA 密钥）后重启服务'
  }
  return raw
}

export function isSuanliTokenExpiredMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('token expired') ||
    lower.includes('登录已失效') ||
    lower.includes('token invalid') ||
    lower.includes('invalid token')
  )
}
