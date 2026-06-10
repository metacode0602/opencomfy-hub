import { NextResponse } from 'next/server'
import { z } from 'zod'

import { normalizeAppRole } from '@/lib/auth/app-role'
import { auth } from '@/lib/auth'
import { opportunitySourceSchema } from '@/lib/server/routers/crm/schemas'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { opportunityImportDataAccess } from '@/lib/server/dataaccess/crm/opportunity-import'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const rowOverrideSchema = z.object({
  rowIndex: z.number().int().positive(),
  opportunitySource: opportunitySourceSchema.nullable().optional(),
  accountManagerStaffId: z.string().nullable().optional(),
  deliveryManagerStaffId: z.string().nullable().optional(),
  projectManagerStaffId: z.string().nullable().optional(),
  preSalesStaffId: z.string().nullable().optional(),
  effectiveFrom: dateSchema.optional(),
  selected: z.boolean().optional(),
})

const bodySchema = z.object({
  previewToken: z.string().min(1),
  allowCreateStaff: z.boolean().default(true),
  rowIndexes: z.array(z.number().int().positive()).optional(),
  rowOverrides: z.array(rowOverrideSchema).optional(),
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }
  if (normalizeAppRole(session.user.role) !== 'admin') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
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

  const createdByStaffId = await staffDataAccess.resolveStaffIdForAuthUser(session.user)

  try {
    const result = await opportunityImportDataAccess.commit(
      parsed.data.previewToken,
      {
        allowCreateStaff: parsed.data.allowCreateStaff,
        rowIndexes: parsed.data.rowIndexes,
        rowOverrides: parsed.data.rowOverrides,
        createdByStaffId,
      },
      session.user,
    )
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : '导入失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
