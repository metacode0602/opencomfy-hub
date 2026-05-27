import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { supplierActivityDataAccess } from '@/lib/server/dataaccess/supplier/supplier-activity'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: _req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params
  const attachment = await supplierActivityDataAccess.getAttachmentForDownload(id)
  if (!attachment) {
    return NextResponse.json({ error: '附件不存在' }, { status: 404 })
  }

  const encodedName = encodeURIComponent(attachment.fileName)
  return new NextResponse(new Uint8Array(attachment.buffer), {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
      'Content-Length': String(attachment.buffer.length),
    },
  })
}
