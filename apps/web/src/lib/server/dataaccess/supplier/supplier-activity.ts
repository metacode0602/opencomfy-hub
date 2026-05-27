import { db } from '@/lib/db'
import { mapSupplierActivityRow } from '@/lib/server/mappers/supply'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import type { SupplierActivity, SupplierActivityAttachment } from '@/lib/types/supplier-domain'
import { supplier, supplierActivity, supplierActivityAttachment, userStaff } from '@workspace/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import {
  readSupplierActivityFile,
  resolveSupplierActivityDownloadUrl,
  saveSupplierActivityFile,
} from './supplier-activity-storage'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5

function newId() {
  return crypto.randomUUID()
}

export type SupplierActivityFileInput = {
  fileName: string
  mimeType: string
  fileBase64: string
}

function mapAttachmentRow(
  row: typeof supplierActivityAttachment.$inferSelect,
): SupplierActivityAttachment {
  return {
    id: row.id,
    name: row.fileName,
    size: row.fileSize ?? 0,
    type: row.mimeType ?? 'application/octet-stream',
    url: resolveSupplierActivityDownloadUrl(row.id),
  }
}

async function resolveAuthorContext(user: {
  id: string
  email?: string | null
  phoneNumber?: string | null
  name?: string | null
}) {
  const staffId = await staffDataAccess.resolveStaffIdForAuthUser(user)
  if (!staffId) {
    throw new Error('当前账号未关联员工信息，无法发布动态')
  }

  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { id: true, displayName: true },
  })
  if (!staff) {
    throw new Error('员工信息不存在')
  }

  return {
    staffId,
    authorName: staff.displayName,
    authorRole: 'business' as const,
  }
}

export const supplierActivityDataAccess = {
  async listBySupplierId(params: {
    supplierId: string
    limit?: number
  }): Promise<SupplierActivity[]> {
    const limit = params.limit ?? 100
    supplierLog('supplier-activity', 'listBySupplierId start', {
      supplierId: params.supplierId,
      limit,
    })

    const rows = await db
      .select()
      .from(supplierActivity)
      .where(eq(supplierActivity.supplierId, params.supplierId))
      .orderBy(desc(supplierActivity.occurredAt))
      .limit(limit)

    if (rows.length === 0) return []

    const activityIds = rows.map((row) => row.id)
    const attachmentRows = await db
      .select()
      .from(supplierActivityAttachment)
      .where(inArray(supplierActivityAttachment.activityId, activityIds))

    const attachmentsByActivity = new Map<string, SupplierActivityAttachment[]>()
    for (const attachment of attachmentRows) {
      const list = attachmentsByActivity.get(attachment.activityId) ?? []
      list.push(mapAttachmentRow(attachment))
      attachmentsByActivity.set(attachment.activityId, list)
    }

    return rows.map((row) => {
      const activity = mapSupplierActivityRow(row)
      const attachments = attachmentsByActivity.get(row.id)
      return attachments?.length ? { ...activity, attachments } : activity
    })
  },

  async createComment(input: {
    supplierId: string
    comment: string
    files: SupplierActivityFileInput[]
    user: { id: string; email?: string | null; name?: string | null }
  }): Promise<SupplierActivity> {
    const comment = input.comment.trim()
    const files = input.files ?? []

    if (!comment && files.length === 0) {
      throw new Error('请输入评论内容或上传文件')
    }
    if (files.length > MAX_FILES) {
      throw new Error(`最多上传 ${MAX_FILES} 个文件`)
    }

    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, input.supplierId),
      columns: { id: true },
    })
    if (!supplierRow) {
      throw new Error('供应商不存在')
    }

    const author = await resolveAuthorContext(input.user)
    const activityId = newId()
    const now = new Date()
    const hasFiles = files.length > 0
    const type = hasFiles && !comment ? 'file' : 'comment'
    const title = hasFiles && !comment ? '上传文件' : '添加评论'
    const description = comment || files.map((file) => file.fileName).join('、')

    await db.insert(supplierActivity).values({
      id: activityId,
      supplierId: input.supplierId,
      type,
      title,
      description,
      authorStaffId: author.staffId,
      authorName: author.authorName,
      authorRole: author.authorRole,
      occurredAt: now,
      createdAt: now,
    })

    const attachments: SupplierActivityAttachment[] = []
    for (const file of files) {
      const buffer = Buffer.from(file.fileBase64, 'base64')
      if (buffer.length === 0) {
        throw new Error(`文件 ${file.fileName} 为空`)
      }
      if (buffer.length > MAX_FILE_BYTES) {
        throw new Error(`文件 ${file.fileName} 超过 20MB 限制`)
      }

      const storageUri = await saveSupplierActivityFile({
        supplierId: input.supplierId,
        activityId,
        fileName: file.fileName,
        buffer,
        mimeType: file.mimeType,
      })

      const attachmentId = newId()
      await db.insert(supplierActivityAttachment).values({
        id: attachmentId,
        activityId,
        fileName: file.fileName,
        fileSize: buffer.length,
        mimeType: file.mimeType || null,
        storageUri,
      })

      attachments.push({
        id: attachmentId,
        name: file.fileName,
        size: buffer.length,
        type: file.mimeType || 'application/octet-stream',
        url: resolveSupplierActivityDownloadUrl(attachmentId),
      })
    }

    const row = await db.query.supplierActivity.findFirst({
      where: eq(supplierActivity.id, activityId),
    })
    if (!row) throw new Error('创建活动失败')

    const activity = mapSupplierActivityRow(row)
    return attachments.length > 0 ? { ...activity, attachments } : activity
  },

  async getAttachmentForDownload(attachmentId: string) {
    const attachment = await db.query.supplierActivityAttachment.findFirst({
      where: eq(supplierActivityAttachment.id, attachmentId),
    })
    if (!attachment) return null

    const buffer = await readSupplierActivityFile(attachment.storageUri)
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType ?? 'application/octet-stream',
      buffer,
    }
  },
}
