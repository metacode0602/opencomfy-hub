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
  /** 变更表工单号关联的业务批次 ID */
  linkedBusinessBatchId?: string | null
  /** 本次回写 onboarding_batch_id 的设备数 */
  boundDeviceCount?: number
}
