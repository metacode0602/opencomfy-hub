import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { billingTenantsDataAccess } from '@/lib/server/dataaccess/crm/billing-tenants'
import { FinanceError } from '@/lib/server/dataaccess/finance/errors'

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }
  if (session.user.role === 'user') {
    return NextResponse.json({ error: '暂无权限操作' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '无效的表单数据' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 })
  }

  const name = file.name.toLowerCase()
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    return NextResponse.json({ error: '仅支持 .xlsx / .xls 文件' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '文件不能超过 10MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await billingTenantsDataAccess.importFromExcel(buffer, file.name)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof FinanceError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const message = e instanceof Error ? e.message : '导入失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
