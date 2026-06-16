import 'server-only'

import type { FeishuWebhookPolicy } from './types'

export type FeishuRuntimeConfig = {
  enabled: boolean
  appId: string
  appSecret: string
  encryptKey: string | null
  verificationToken: string | null
  webhookSecret: string | null
  defaultApprovalCodes: Record<string, string>
  webhookPolicy: Required<Pick<FeishuWebhookPolicy, 'auto_complete_on_approval' | 'auto_create_enabled'>> &
    Pick<FeishuWebhookPolicy, 'auto_complete_batch_kinds'>
  approvalFormFieldId: string | null
  defaultUserOpenId: string | null
  appBaseUrl: string
}

function parseJsonRecord(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function loadFeishuRuntimeConfig(): FeishuRuntimeConfig | null {
  const appId = process.env.FEISHU_APP_ID?.trim() ?? ''
  const appSecret = process.env.FEISHU_APP_SECRET?.trim() ?? ''
  if (!appId || !appSecret) return null

  const webhookPolicy: FeishuRuntimeConfig['webhookPolicy'] = {
    auto_complete_on_approval: envBool('FEISHU_AUTO_COMPLETE_ON_APPROVAL', true),
    auto_create_enabled: envBool('FEISHU_AUTO_CREATE_ENABLED', true),
  }

  const kindsRaw = process.env.FEISHU_AUTO_COMPLETE_BATCH_KINDS?.trim()
  if (kindsRaw) {
    webhookPolicy.auto_complete_batch_kinds = kindsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  }

  return {
    enabled: envBool('FEISHU_INTEGRATION_ENABLED', true),
    appId,
    appSecret,
    encryptKey: process.env.FEISHU_ENCRYPT_KEY?.trim() || null,
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN?.trim() || null,
    webhookSecret: process.env.FEISHU_WEBHOOK_SECRET?.trim() || null,
    defaultApprovalCodes: parseJsonRecord(process.env.FEISHU_APPROVAL_CODES),
    webhookPolicy,
    approvalFormFieldId: process.env.FEISHU_APPROVAL_FORM_FIELD_ID?.trim() || null,
    defaultUserOpenId: process.env.FEISHU_DEFAULT_USER_OPEN_ID?.trim() || null,
    appBaseUrl: (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, ''),
  }
}

export function isFeishuAutoCreateEnabled(config: FeishuRuntimeConfig | null): boolean {
  return Boolean(config?.enabled && config.webhookPolicy.auto_create_enabled)
}

export function isFeishuAutoCompleteOnApproval(config: FeishuRuntimeConfig | null): boolean {
  return Boolean(config?.enabled && config.webhookPolicy.auto_complete_on_approval)
}

export function getFeishuClientPublicConfig(config: FeishuRuntimeConfig | null) {
  return {
    integrationConfigured: Boolean(config?.enabled),
    autoCreateEnabled: isFeishuAutoCreateEnabled(config),
    autoCompleteOnApproval: isFeishuAutoCompleteOnApproval(config),
    manualWorkOrderRequired: !isFeishuAutoCreateEnabled(config),
  }
}

export function resolveApprovalCode(
  config: FeishuRuntimeConfig,
  batchKind: string,
): string | null {
  const key = batchKind
  return config.defaultApprovalCodes[key]?.trim() || null
}

export function shouldAutoCompleteBatchKind(
  config: FeishuRuntimeConfig,
  batchKind: string,
): boolean {
  if (!config.webhookPolicy.auto_complete_on_approval) return false
  const kinds = config.webhookPolicy.auto_complete_batch_kinds
  if (!kinds?.length) return true
  return kinds.includes(batchKind)
}
