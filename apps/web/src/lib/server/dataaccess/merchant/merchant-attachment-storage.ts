import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  LOCAL_STORAGE_SUBDIRS,
  LOCAL_STORAGE_URI_PREFIX,
  resolveModuleStoragePath,
  sanitizeStorageFileName,
  type LocalStorageSubdir,
} from '../local-storage-root'

function resolveLocalPath(subdir: LocalStorageSubdir, relativePath: string): string {
  return resolveModuleStoragePath(subdir, relativePath)
}

export async function saveLocalMerchantFile(input: {
  subdir: LocalStorageSubdir
  merchantId: string
  parentId: string
  fileName: string
  buffer: Buffer
}): Promise<string> {
  const rel = path
    .join(
      input.merchantId,
      input.parentId,
      `${crypto.randomUUID()}_${sanitizeStorageFileName(input.fileName)}`,
    )
    .replace(/\\/g, '/')
  const abs = resolveLocalPath(input.subdir, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, input.buffer)
  return `${LOCAL_STORAGE_URI_PREFIX}${input.subdir}/${rel}`
}

export async function readLocalMerchantFile(storageUri: string): Promise<Buffer> {
  if (!storageUri.startsWith(LOCAL_STORAGE_URI_PREFIX)) {
    throw new Error('无效的本地存储 URI')
  }
  const rest = storageUri.slice(LOCAL_STORAGE_URI_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) throw new Error('无效的本地存储 URI')
  const subdir = rest.slice(0, slash) as LocalStorageSubdir
  const rel = rest.slice(slash + 1)
  return readFile(resolveLocalPath(subdir, rel))
}

export async function saveMerchantAttachmentFile(input: {
  kind: 'activity' | 'recharge'
  merchantId: string
  parentId: string
  fileName: string
  buffer: Buffer
  mimeType?: string
}): Promise<string> {
  const driver = process.env.SUPPLIER_ACTIVITY_STORAGE_DRIVER?.trim().toLowerCase()
  const subdir =
    input.kind === 'activity'
      ? LOCAL_STORAGE_SUBDIRS.merchantActivityAttachments
      : LOCAL_STORAGE_SUBDIRS.merchantRechargeAttachments

  if (driver === 'oss') {
    const { saveMerchantAttachmentToOss } = await import('./merchant-attachment-oss')
    return saveMerchantAttachmentToOss({ ...input, subdirKey: input.kind })
  }

  return saveLocalMerchantFile({
    subdir,
    merchantId: input.merchantId,
    parentId: input.parentId,
    fileName: input.fileName,
    buffer: input.buffer,
  })
}

export async function readMerchantAttachmentFile(storageUri: string): Promise<Buffer> {
  if (storageUri.startsWith(LOCAL_STORAGE_URI_PREFIX)) {
    return readLocalMerchantFile(storageUri)
  }
  const { readMerchantAttachmentFromOss } = await import('./merchant-attachment-oss')
  return readMerchantAttachmentFromOss(storageUri)
}
