import type {
  SupplierImportCommitResult,
  SupplierImportPreviewResult,
} from '@/lib/types/supplier-import'
import type { PlatformSupplierType } from '@/lib/supplier/platform-supplier-import-utils'

export type PlatformSupplierImportSearchParams = {
  types: PlatformSupplierType
  name: string
}

/** 平台 API 导入 preview（在 Excel 预览结果上扩展） */
export type PlatformSupplierImportPreviewResult = Omit<
  SupplierImportPreviewResult,
  'parsedRows'
> & {
  source: 'platform-api'
  searchParams: PlatformSupplierImportSearchParams
}

export type PlatformSupplierImportCommitResult = SupplierImportCommitResult
