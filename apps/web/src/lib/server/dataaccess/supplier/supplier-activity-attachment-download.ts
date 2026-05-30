import { db } from '@/lib/db'
import { supplierActivityAttachment } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

export async function getSupplierActivityAttachmentForDownload(attachmentId: string) {
  const attachment = await db.query.supplierActivityAttachment.findFirst({
    where: eq(supplierActivityAttachment.id, attachmentId),
  })
  if (!attachment) return null

  const { readSupplierActivityFile } = await import('./supplier-activity-storage')
  const buffer = await readSupplierActivityFile(attachment.storageUri)
  return {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType ?? 'application/octet-stream',
    buffer,
  }
}
