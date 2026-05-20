import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { projectImportDataAccess } from '@/lib/server/dataaccess/crm/project-import'

const bodySchema = z.object({
  previewToken: z.string().min(1),
  allowCreateStaff: z.boolean().default(true),
  rowIndexes: z.array(z.number().int().positive()).optional(),
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }
  if (session.user.role === 'user') {
    return NextResponse.json({ error: '暂无权限操作' }, { status: 403 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: '无效的 JSON 请求体' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '请求参数无效' }, { status: 400 })
  }

  try {
    const result = await projectImportDataAccess.commit(parsed.data.previewToken, {
      allowCreateStaff: parsed.data.allowCreateStaff,
      rowIndexes: parsed.data.rowIndexes,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : '导入失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
