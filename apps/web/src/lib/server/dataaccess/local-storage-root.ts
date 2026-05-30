'server only'

import path from 'node:path'

/** 本地文件存储根目录，由环境变量 DATA_DIR 配置，默认 {cwd}/.data */
const DEFAULT_DATA_DIR = '.data'

/** 各模块在 DATA_DIR 下的子目录 */
export const LOCAL_STORAGE_SUBDIRS = {
  financeImports: 'finance-imports',
  supplierActivityAttachments: 'supplier-activity-attachments',
  projectActivityAttachments: 'project-activity-attachments',
} as const

export type LocalStorageSubdir =
  (typeof LOCAL_STORAGE_SUBDIRS)[keyof typeof LOCAL_STORAGE_SUBDIRS]

export const LOCAL_STORAGE_URI_PREFIX = 'local://'

export function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim()
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(configured)
  }
  return path.resolve(DEFAULT_DATA_DIR)
}

export function getModuleStorageRoot(subdir: LocalStorageSubdir): string {
  return path.join(getDataDir(), subdir)
}

export function resolveModuleStoragePath(
  subdir: LocalStorageSubdir,
  relativePath: string,
): string {
  const root = getModuleStorageRoot(subdir)
  const abs = path.join(root, relativePath)
  const normalizedRoot = `${path.resolve(/* turbopackIgnore: true */ root)}${path.sep}`
  if (!path.resolve(/* turbopackIgnore: true */ abs).startsWith(normalizedRoot)) {
    throw new Error('非法存储路径')
  }
  return abs
}

export function sanitizeStorageFileName(name: string): string {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_').slice(0, 200)
}
