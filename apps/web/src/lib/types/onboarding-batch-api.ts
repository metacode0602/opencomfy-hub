import type {
  DeviceCooperationType,
  OnboardingBatch,
  OnboardingBatchPlanLine,
  OnboardingParsedRow,
} from '@/lib/types/supplier-domain'

export type OnboardingBatchCreateInput = {
  batchKind: 'online' | 'order_access'
  supplierId: string
  dataCenterId: string
  contractId?: string
  accessMethod: string
  plannedReadyAt?: string
  onlineReason?: string
  orderNo?: string
  remark?: string
  uploadList: boolean
  planLines: Array<{
    gpuCardTypeId?: string
    gpuCardTypeCode: string
    cooperationType: DeviceCooperationType
    plannedQuantity: number
  }>
  operatorStaffId?: string | null
}

export type OnboardingBatchCreateResult = {
  batchId: string
  batchCode: string
  workOrderNo: string
  plannedDeviceCount: number
}

export type OnboardingBatchListItem = OnboardingBatch

export type OnboardingBatchProgress = {
  planned: number
  linked: number
  onboarding: number
  online: number
  planLines: Array<
    OnboardingBatchPlanLine & {
      linked: number
      online: number
    }
  >
}

export type OnboardingBatchParseListResult = {
  rowCount: number
  okCount: number
  rows: OnboardingParsedRow[]
}

export type OnboardingBatchCommitListResult = {
  committedCount: number
}

export type OnboardingBatchDetailDevice = {
  id: string
  sn: string
  asset_no: string
  lifecycle_status: string
  onboarding_substage: string
  external_ip: string | null
  card_type_code: string | null
}

export type OnboardingBatchDetailTask = {
  id: string
  onboarding_batch_id: string
  device_id: string | null
  device_sn: string | null
  task_type: string
  assignee_id: string
  assignee_name: string | null
  task_status: string
  started_at: string | null
  finished_at: string | null
}

export type OnboardingBatchDetailPage = {
  batch: OnboardingBatchListItem
  contractNo: string | null
  progress: OnboardingBatchProgress
  devices: OnboardingBatchDetailDevice[]
  tasks: OnboardingBatchDetailTask[]
}
