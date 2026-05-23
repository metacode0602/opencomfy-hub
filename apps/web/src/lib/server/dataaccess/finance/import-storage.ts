import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_').slice(0, 200)
}

export function getFinanceImportStorageRoot(): string {
  return (
    process.env.FINANCE_IMPORT_STORAGE_ROOT ??
    path.join(process.cwd(), '.data', 'finance-imports')
  )
}

export function resolveStoragePath(relativePath: string): string {
  const root = getFinanceImportStorageRoot()
  const abs = path.resolve(root, relativePath)
  if (!abs.startsWith(path.resolve(root))) {
    throw new Error('非法存储路径')
  }
  return abs
}

export async function saveImportSourceFile(input: {
  billingPeriodId: string
  fileType: string
  batchId: string
  fileName: string
  buffer: Buffer
}): Promise<string> {
  const rel = path
    .join(
      input.billingPeriodId,
      input.fileType,
      `${input.batchId}_${sanitizeFileName(input.fileName)}`,
    )
    .replace(/\\/g, '/')
  const abs = resolveStoragePath(rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, input.buffer)
  return rel
}

export async function saveImportErrorReport(input: {
  billingPeriodId: string
  fileType: string
  batchId: string
  buffer: Buffer
}): Promise<string> {
  const rel = path
    .join(input.billingPeriodId, input.fileType, `${input.batchId}_errors.xlsx`)
    .replace(/\\/g, '/')
  const abs = resolveStoragePath(rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, input.buffer)
  return rel
}

export async function readStorageFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveStoragePath(relativePath))
}

export async function deleteStorageFile(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return
  try {
    await unlink(resolveStoragePath(relativePath))
  } catch {
    /* ignore missing */
  }
}

export async function deletePeriodImportDirectory(billingPeriodId: string): Promise<void> {
  const abs = resolveStoragePath(billingPeriodId)
  try {
    await rm(abs, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
