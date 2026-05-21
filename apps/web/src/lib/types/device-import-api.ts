import type { OnboardingImportStatus } from '@/lib/types/supplier-domain'

export interface DeviceImportBatchSummary {
  id: string
  code: string
  kind: 'device_inventory' | 'device_changelog' | 'fault_records'
  importStatus: OnboardingImportStatus | string
  committedCount: number
  parsedSuccessCount: number
  committedAt: string | null
  parsedAt: string | null
  createdAt: string
}

export interface DeviceImportContext {
  inventoryBatches: DeviceImportBatchSummary[]
  changelogBatches: DeviceImportBatchSummary[]
  faultBatches: DeviceImportBatchSummary[]
  changeLogCount: number
}

export interface DeviceImportCommitResult {
  batchId: string
  batchCode: string
  committedCount: number
  skippedCount: number
  warnings: string[]
}
