import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: _req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { id } = await params
  const { getProjectActivityAttachmentForDownload } = await import(
    '@/lib/server/dataaccess/crm/project-activity-attachment-download'
  )
  const attachment = await getProjectActivityAttachmentForDownload(id)
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
