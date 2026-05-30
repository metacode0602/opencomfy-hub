import { db } from '@/lib/db'
import { projectActivityAttachment } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

export async function getProjectActivityAttachmentForDownload(attachmentId: string) {
  const attachment = await db.query.projectActivityAttachment.findFirst({
    where: eq(projectActivityAttachment.id, attachmentId),
  })
  if (!attachment) return null

  const { readProjectActivityFile } = await import('./project-activity-storage')
  const buffer = await readProjectActivityFile(attachment.storageUri)
  return {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType ?? 'application/octet-stream',
    buffer,
  }
}
