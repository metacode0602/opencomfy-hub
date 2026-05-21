import type {
  DatacenterImportCommitResult,
  DatacenterImportPreviewResult,
} from '@/lib/types/datacenter-import'

/** 平台 API 导入 preview（在 Excel 预览结果上扩展） */
export type PlatformDatacenterImportPreviewResult = Omit<
  DatacenterImportPreviewResult,
  'parsedRows'
> & {
  missingPlatformIds: string[]
  source: 'platform-api'
}

export type PlatformDatacenterImportCommitResult = DatacenterImportCommitResult
