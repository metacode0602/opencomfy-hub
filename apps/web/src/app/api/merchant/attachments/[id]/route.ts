import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { resolveMerchantDataScope, assertMerchantInScope } from '@/lib/server/auth/merchant-data-scope'
import { resolveMerchantIdForAttachment } from '@/lib/server/dataaccess/merchant/merchant-scope-helpers'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: _req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params
  const merchantId = await resolveMerchantIdForAttachment(id)
  if (!merchantId) {
    return NextResponse.json({ error: '附件不存在' }, { status: 404 })
  }

  try {
    const merchantScope = await resolveMerchantDataScope(session.user)
    await assertMerchantInScope(merchantScope, merchantId)
  } catch (error) {
    const message = error instanceof Error ? error.message : '无权访问'
    const status = message === '商户不存在' ? 404 : 403
    return NextResponse.json({ error: message }, { status })
  }

  const { merchantActivityDataAccess } = await import(
    '@/lib/server/dataaccess/merchant/merchant-activity'
  )
  const { merchantRechargeDataAccess } = await import(
    '@/lib/server/dataaccess/merchant/merchant-recharge'
  )

  let attachment =
    (await merchantActivityDataAccess.getAttachmentForDownload(id)) ??
    (await merchantRechargeDataAccess.getAttachmentForDownload(id))

  if (!attachment) {
    return NextResponse.json({ error: '附件不存在' }, { status: 404 })
  }

  const encodedName = encodeURIComponent(attachment.fileName)
  const isInline =
    attachment.mimeType.startsWith('image/') || attachment.mimeType === 'application/pdf'

  return new NextResponse(new Uint8Array(attachment.buffer), {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': isInline
        ? `inline; filename*=UTF-8''${encodedName}`
        : `attachment; filename*=UTF-8''${encodedName}`,
      'Content-Length': String(attachment.buffer.length),
    },
  })
}
