import { db } from '@/lib/db'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import {
  mapMerchantActivityAttachment,
  mapMerchantActivityRow,
} from '@/lib/server/mappers/merchant'
import type { MerchantActivity } from '@/lib/types/merchant'
import {
  merchant,
  merchantActivity,
  merchantActivityAttachment,
  userStaff,
} from '@workspace/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { saveMerchantAttachmentFile } from './merchant-attachment-storage'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5

function newId() {
  return crypto.randomUUID()
}

async function resolveAuthor(user: {
  id: string
  email?: string | null
  name?: string | null
}) {
  const staffId = await staffDataAccess.resolveStaffIdForAuthUser(user)
  if (!staffId) throw new Error('当前账号未关联员工信息')
  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { id: true, displayName: true },
  })
  if (!staff) throw new Error('员工信息不存在')
  return { staffId, authorName: staff.displayName }
}

export type MerchantActivityFileInput = {
  fileName: string
  mimeType: string
  fileBase64: string
}

export const merchantActivityDataAccess = {
  async listByMerchantId(params: {
    merchantId: string
    limit?: number
  }): Promise<MerchantActivity[]> {
    const limit = params.limit ?? 100
    const rows = await db
      .select()
      .from(merchantActivity)
      .where(eq(merchantActivity.merchantId, params.merchantId))
      .orderBy(desc(merchantActivity.occurredAt))
      .limit(limit)

    if (rows.length === 0) return []

    const activityIds = rows.map((r) => r.id)
    const attachmentRows = await db
      .select()
      .from(merchantActivityAttachment)
      .where(inArray(merchantActivityAttachment.activityId, activityIds))

    const byActivity = new Map<string, ReturnType<typeof mapMerchantActivityAttachment>[]>()
    for (const att of attachmentRows) {
      const list = byActivity.get(att.activityId) ?? []
      list.push(mapMerchantActivityAttachment(att))
      byActivity.set(att.activityId, list)
    }

    return rows.map((row) => {
      const activity = mapMerchantActivityRow(row)
      const attachments = byActivity.get(row.id)
      return attachments?.length ? { ...activity, attachments } : activity
    })
  },

  async createComment(input: {
    merchantId: string
    comment: string
    files: MerchantActivityFileInput[]
    user: { id: string; email?: string | null; name?: string | null }
  }): Promise<MerchantActivity> {
    const comment = input.comment.trim()
    const files = input.files ?? []
    if (!comment && files.length === 0) throw new Error('请输入评论内容或上传文件')
    if (files.length > MAX_FILES) throw new Error(`最多上传 ${MAX_FILES} 个文件`)

    const merchantRow = await db.query.merchant.findFirst({
      where: eq(merchant.id, input.merchantId),
      columns: { id: true },
    })
    if (!merchantRow) throw new Error('商户不存在')

    const author = await resolveAuthor(input.user)
    const activityId = newId()
    const now = new Date()
    const hasFiles = files.length > 0
    const type = comment ? 'comment' : 'file'
    const firstLine = comment.split('\n')[0] ?? ''
    const title = comment ? firstLine.slice(0, 120) : `上传 ${files.length} 个附件`

    await db.insert(merchantActivity).values({
      id: activityId,
      merchantId: input.merchantId,
      type,
      title,
      description: comment || undefined,
      authorStaffId: author.staffId,
      authorName: author.authorName,
      authorRole: 'staff',
      occurredAt: now,
      createdAt: now,
    })

    const attachments = []
    for (const file of files) {
      const buffer = Buffer.from(file.fileBase64, 'base64')
      if (buffer.length === 0) throw new Error(`文件 ${file.fileName} 为空`)
      if (buffer.length > MAX_FILE_BYTES) throw new Error(`文件 ${file.fileName} 超过 20MB`)

      const storageUri = await saveMerchantAttachmentFile({
        kind: 'activity',
        merchantId: input.merchantId,
        parentId: activityId,
        fileName: file.fileName,
        buffer,
        mimeType: file.mimeType,
      })

      const attachmentId = newId()
      await db.insert(merchantActivityAttachment).values({
        id: attachmentId,
        activityId,
        fileName: file.fileName,
        fileSize: buffer.length,
        mimeType: file.mimeType || null,
        storageUri,
      })
      attachments.push(mapMerchantActivityAttachment({
        id: attachmentId,
        activityId,
        fileName: file.fileName,
        fileSize: buffer.length,
        mimeType: file.mimeType || null,
        storageUri,
      }))
    }

    const row = await db.query.merchantActivity.findFirst({
      where: eq(merchantActivity.id, activityId),
    })
    if (!row) throw new Error('创建活动失败')
    const activity = mapMerchantActivityRow(row)
    return attachments.length ? { ...activity, attachments } : activity
  },

  async getAttachmentForDownload(attachmentId: string) {
    const activityAtt = await db.query.merchantActivityAttachment.findFirst({
      where: eq(merchantActivityAttachment.id, attachmentId),
    })
    if (activityAtt) {
      const { readMerchantAttachmentFile } = await import('./merchant-attachment-storage')
      const buffer = await readMerchantAttachmentFile(activityAtt.storageUri)
      return {
        buffer,
        fileName: activityAtt.fileName,
        mimeType: activityAtt.mimeType ?? 'application/octet-stream',
      }
    }
    return null
  },
}
