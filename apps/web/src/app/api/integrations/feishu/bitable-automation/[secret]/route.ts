import { NextResponse } from 'next/server'

import { handleFeishuBitableAutomationInbound } from '@/lib/server/dataaccess/integrations/feishu/bitable-automation-inbound-handler'
import { feishuWorkOrderConfigDataAccess } from '@/lib/server/dataaccess/integrations/feishu/work-order-config'
import {
  resolveAutomationToken,
  resolveAutomationWebhookSecret,
} from '@/lib/server/dataaccess/integrations/feishu/sync-work-order-inbound'
import { loadFeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import type { FeishuBitableAutomationInboundPayload } from '@/lib/types/feishu-work-order'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ secret: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const runtime = loadFeishuRuntimeConfig()
  if (!runtime?.enabled) {
    return NextResponse.json({ error: 'feishu integration disabled' }, { status: 503 })
  }

  const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
  if (!woConfig?.enabled) {
    return NextResponse.json({ error: 'work order config disabled' }, { status: 503 })
  }

  const expectedSecret = resolveAutomationWebhookSecret(woConfig)
  const { secret } = await context.params
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'invalid automation secret' }, { status: 401 })
  }

  const expectedToken = resolveAutomationToken(woConfig)
  if (expectedToken) {
    const receivedToken = request.headers.get('x-feishu-automation-token')
    if (receivedToken !== expectedToken) {
      return NextResponse.json({ error: 'invalid automation token' }, { status: 401 })
    }
  }

  let payload: FeishuBitableAutomationInboundPayload
  try {
    payload = (await request.json()) as FeishuBitableAutomationInboundPayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  try {
    const result = await handleFeishuBitableAutomationInbound(payload)
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        code: result.code,
      })
    }
    return NextResponse.json({
      ok: true,
      batchId: result.batchId,
      nextBatchStatus: result.nextBatchStatus,
    })
  } catch {
    return NextResponse.json({ ok: false, code: 'internal_error' })
  }
}
