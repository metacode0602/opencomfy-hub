import type {
  DatacenterImportCommitResult,
  DatacenterImportPreviewResult,
} from '@/lib/types/datacenter-import'

export type PlatformDatacenterImportSearchParams = {
  tenantIds: string[]
  name: string
}

/** 平台 API 导入 preview（在 Excel 预览结果上扩展） */
export type PlatformDatacenterImportPreviewResult = Omit<
  DatacenterImportPreviewResult,
  'parsedRows'
> & {
  source: 'platform-api'
  searchParams: PlatformDatacenterImportSearchParams
}

export type PlatformDatacenterImportCommitResult = DatacenterImportCommitResult
