import { db } from '@/lib/db'
import type { Activity, Attachment } from '@/lib/data/types'
import { mapActivityRow } from '@/lib/server/mappers/crm'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import {
  crmProject,
  projectActivity,
  projectActivityAttachment,
  projectStaffAssignment,
  userStaff,
} from '@workspace/db/schema'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import {
  readProjectActivityFile,
  resolveProjectActivityDownloadUrl,
  saveProjectActivityFile,
} from './project-activity-storage'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5

function newId() {
  return crypto.randomUUID()
}

type ActivityAuthorRole = Activity['authorRole']

const ROLE_TYPE_TO_AUTHOR: Record<string, ActivityAuthorRole> = {
  pre_sales: 'pre_sales',
  account_manager: 'account_manager',
  delivery_manager: 'account_manager',
  project_manager: 'account_manager',
}

export type ProjectActivityFileInput = {
  fileName: string
  mimeType: string
  fileBase64: string
}

async function resolveAuthorContext(projectId: string, user: {
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

  const assignment = await db.query.projectStaffAssignment.findFirst({
    where: and(
      eq(projectStaffAssignment.projectId, projectId),
      eq(projectStaffAssignment.userStaffId, staffId),
      isNull(projectStaffAssignment.effectiveTo),
    ),
    columns: { roleType: true },
  })

  const authorRole = assignment
    ? (ROLE_TYPE_TO_AUTHOR[assignment.roleType] ?? 'account_manager')
    : 'account_manager'

  return {
    staffId,
    authorName: staff.displayName,
    authorRole,
  }
}

function mapAttachmentRow(row: typeof projectActivityAttachment.$inferSelect): Attachment {
  return {
    id: row.id,
    name: row.fileName,
    size: row.fileSize ?? 0,
    type: row.mimeType ?? 'application/octet-stream',
    url: resolveProjectActivityDownloadUrl(row.id),
  }
}

export const projectActivitiesDataAccess = {
  async listByProject(projectId: string): Promise<Activity[]> {
    const rows = await db
      .select()
      .from(projectActivity)
      .where(eq(projectActivity.projectId, projectId))
      .orderBy(desc(projectActivity.createdAt))

    if (rows.length === 0) return []

    const activityIds = rows.map((row) => row.id)
    const attachmentRows = await db
      .select()
      .from(projectActivityAttachment)
      .where(inArray(projectActivityAttachment.activityId, activityIds))

    const attachmentsByActivity = new Map<string, Attachment[]>()
    for (const attachment of attachmentRows) {
      const list = attachmentsByActivity.get(attachment.activityId) ?? []
      list.push(mapAttachmentRow(attachment))
      attachmentsByActivity.set(attachment.activityId, list)
    }

    return rows.map((row) => {
      const activity = mapActivityRow(row)
      const attachments = attachmentsByActivity.get(row.id)
      return attachments?.length ? { ...activity, attachments } : activity
    })
  },

  async createComment(input: {
    projectId: string
    comment: string
    files: ProjectActivityFileInput[]
    user: { id: string; email?: string | null; name?: string | null }
  }): Promise<Activity> {
    const comment = input.comment.trim()
    const files = input.files ?? []

    if (!comment && files.length === 0) {
      throw new Error('请输入评论内容或上传文件')
    }
    if (files.length > MAX_FILES) {
      throw new Error(`最多上传 ${MAX_FILES} 个文件`)
    }

    const project = await db.query.crmProject.findFirst({
      where: eq(crmProject.id, input.projectId),
      columns: { id: true },
    })
    if (!project) {
      throw new Error('项目不存在')
    }

    const author = await resolveAuthorContext(input.projectId, input.user)
    const activityId = newId()
    const hasFiles = files.length > 0
    const type: Activity['type'] = hasFiles && !comment ? 'file' : 'comment'
    const title = hasFiles && !comment ? '上传文件' : '添加评论'
    const description =
      comment ||
      files.map((file) => file.fileName).join('、')

    await db.insert(projectActivity).values({
      id: activityId,
      projectId: input.projectId,
      type,
      title,
      description,
      authorName: author.authorName,
      authorStaffId: author.staffId,
      authorRole: author.authorRole,
      metadata: null,
    })

    const attachments: Attachment[] = []
    for (const file of files) {
      const buffer = Buffer.from(file.fileBase64, 'base64')
      if (buffer.length === 0) {
        throw new Error(`文件 ${file.fileName} 为空`)
      }
      if (buffer.length > MAX_FILE_BYTES) {
        throw new Error(`文件 ${file.fileName} 超过 20MB 限制`)
      }

      const storageUri = await saveProjectActivityFile({
        projectId: input.projectId,
        activityId,
        fileName: file.fileName,
        buffer,
        mimeType: file.mimeType,
      })

      const attachmentId = newId()
      await db.insert(projectActivityAttachment).values({
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
        url: resolveProjectActivityDownloadUrl(attachmentId),
      })
    }

    const row = await db.query.projectActivity.findFirst({
      where: eq(projectActivity.id, activityId),
    })
    if (!row) throw new Error('创建活动失败')

    const activity = mapActivityRow(row)
    return attachments.length > 0 ? { ...activity, attachments } : activity
  },

  async getAttachmentForDownload(attachmentId: string) {
    const attachment = await db.query.projectActivityAttachment.findFirst({
      where: eq(projectActivityAttachment.id, attachmentId),
    })
    if (!attachment) return null

    const buffer = await readProjectActivityFile(attachment.storageUri)
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType ?? 'application/octet-stream',
      buffer,
    }
  },
}
