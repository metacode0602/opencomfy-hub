import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  LOCAL_STORAGE_SUBDIRS,
  LOCAL_STORAGE_URI_PREFIX,
  resolveModuleStoragePath,
  sanitizeStorageFileName,
} from '../local-storage-root'

function resolveLocalPath(relativePath: string): string {
  return resolveModuleStoragePath(
    LOCAL_STORAGE_SUBDIRS.projectActivityAttachments,
    relativePath,
  )
}

export async function saveLocalProjectActivityFile(input: {
  projectId: string
  activityId: string
  fileName: string
  buffer: Buffer
}): Promise<string> {
  const rel = path
    .join(
      input.projectId,
      input.activityId,
      `${crypto.randomUUID()}_${sanitizeStorageFileName(input.fileName)}`,
    )
    .replace(/\\/g, '/')
  const abs = resolveLocalPath(rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, input.buffer)
  return `${LOCAL_STORAGE_URI_PREFIX}${rel}`
}

export async function readLocalProjectActivityFile(storageUri: string): Promise<Buffer> {
  const rel = storageUri.slice(LOCAL_STORAGE_URI_PREFIX.length)
  return readFile(resolveLocalPath(rel))
}
