import { NextResponse } from 'next/server'

import { handleFeishuApprovalWebhook } from '@/lib/server/dataaccess/integrations/feishu/approval-webhook-handler'
import { handleFeishuBitableRecordWebhook } from '@/lib/server/dataaccess/integrations/feishu/bitable-record-webhook-handler'
import { loadFeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import {
  decryptFeishuPayload,
  verifyFeishuVerificationToken,
} from '@/lib/server/integrations/feishu/webhook-crypto'
import type { FeishuWebhookEnvelope } from '@/lib/server/integrations/feishu/types'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ secret: string }>
}

async function parseWebhookBody(
  rawBody: string,
  config: NonNullable<ReturnType<typeof loadFeishuRuntimeConfig>>,
): Promise<FeishuWebhookEnvelope> {
  const parsed = JSON.parse(rawBody) as FeishuWebhookEnvelope
  if (parsed.encrypt && config.encryptKey) {
    const decrypted = decryptFeishuPayload(config.encryptKey, parsed.encrypt)
    return JSON.parse(decrypted) as FeishuWebhookEnvelope
  }
  return parsed
}

export async function POST(request: Request, context: RouteContext) {
  const config = loadFeishuRuntimeConfig()
  if (!config?.enabled) {
    return NextResponse.json({ error: 'feishu integration disabled' }, { status: 503 })
  }

  const { secret } = await context.params
  if (config.webhookSecret && secret !== config.webhookSecret) {
    return NextResponse.json({ error: 'invalid webhook secret' }, { status: 401 })
  }

  const rawBody = await request.text()
  let envelope: FeishuWebhookEnvelope
  try {
    envelope = await parseWebhookBody(rawBody, config)
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  if (envelope.type === 'url_verification' && envelope.challenge) {
    if (!verifyFeishuVerificationToken(config.verificationToken, envelope.token)) {
      return NextResponse.json({ error: 'invalid verification token' }, { status: 401 })
    }
    return NextResponse.json({ challenge: envelope.challenge })
  }

  if (
    envelope.header?.event_type &&
    !verifyFeishuVerificationToken(config.verificationToken, envelope.header.token)
  ) {
    return NextResponse.json({ error: 'invalid verification token' }, { status: 401 })
  }

  const eventType = envelope.header?.event_type ?? ''
  if (
    eventType === 'approval.approval_instance.updated' ||
    eventType === 'approval_instance' ||
    eventType.includes('approval')
  ) {
    try {
      await handleFeishuApprovalWebhook(envelope)
    } catch {
      // 仍返回 200，避免飞书无限重试；错误已记 job_run
    }
  }

  if (
    eventType.includes('bitable') ||
    eventType === 'drive.file.bitable_record_changed_v1'
  ) {
    try {
      await handleFeishuBitableRecordWebhook(envelope)
    } catch {
      // 仍返回 200
    }
  }

  return NextResponse.json({ ok: true })
}
