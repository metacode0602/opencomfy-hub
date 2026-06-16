import 'server-only'

export function isFeishuBitableSyncEnabled(): boolean {
  const raw = process.env.FEISHU_BITABLE_SYNC_ENABLED?.trim()
  if (raw != null && raw !== '') {
    return raw === '1' || raw.toLowerCase() === 'true'
  }
  const integrationRaw = process.env.FEISHU_INTEGRATION_ENABLED?.trim()
  if (integrationRaw != null && integrationRaw !== '') {
    return integrationRaw === '1' || integrationRaw.toLowerCase() === 'true'
  }
  return true
}

export function getFeishuBitableSyncCron(): string {
  return process.env.FEISHU_BITABLE_SYNC_CRON?.trim() || '15 * * * *'
}

export function getFeishuBitableSyncTimezone(): string {
  return process.env.FEISHU_BITABLE_SYNC_TIMEZONE?.trim() || 'Asia/Shanghai'
}
