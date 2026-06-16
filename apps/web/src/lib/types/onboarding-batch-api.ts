import type { DeviceCooperationType, OnboardingParsedRow } from '@/lib/types/supplier-domain'
import type {
  InternalTestHoldDepartment,
  InternalTestHoldSettlement,
} from '@/lib/types/supplier-domain'
import type { OnboardingBatchRow } from '@workspace/db/schema'

/** `planned_lines_json` 存储结构，字段与 `onboarding_batch_plan_line` 表一致 */
export type OnboardingBatchPlannedLineJson = {
  gpuCardTypeId: string
  gpuCardTypeCode: string
  cooperationType: DeviceCooperationType
  plannedQuantity: number
}

export type OnboardingBatchCreateInput = {
  batchKind: 'online' | 'order_access' | 'internal_occupancy'
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
  /** 飞书审批工单号（手工模式必填；自动建单时可省略） */
  workOrderNo?: string
  operatorStaffId?: string | null
  /** internal_occupancy：占用登记字段，写入 internal_test_hold */
  userName?: string
  department?: InternalTestHoldDepartment
  settlementMode?: InternalTestHoldSettlement
  holdFrom?: string
  holdUntil?: string | null
}

export type OnboardingBatchCreateResult = {
  batchId: string
  batchCode: string
  workOrderNo: string
  plannedDeviceCount: number
}

export type OnboardingBatchListItem = OnboardingBatchRow

export type OnboardingBatchProgress = {
  planned: number
  /** 已触达设备数（v2.2）；与 linked 同义，保留 linked 兼容旧 UI */
  touched: number
  linked: number
  onboarding: number
  online: number
  planLines: Array<
    OnboardingBatchPlannedLineJson & {
      touched: number
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
  assetNo: string | null
  lifecycleStatus: string
  onboardingSubstage: string | null
  externalIp: string | null
  internalIp: string | null
  cooperationType: string | null
  devicePurpose: string | null
  cardTypeCode: string | null
}

export type OnboardingBatchDetailTask = {
  id: string
  onboardingBatchId: string
  supplierDeviceId: string | null
  deviceSn: string | null
  taskType: string
  assigneeStaffId: string
  assigneeName: string | null
  taskStatus: string
  startedAt: Date | null
  finishedAt: Date | null
}

export type OnboardingBatchLinkedHold = {
  id: string
  userName: string
  department: InternalTestHoldDepartment
  settlementMode: InternalTestHoldSettlement
  gpuCardTypeId: string
  cardTypeCode: string
  cardTypeName: string
  unitCount: number
  holdFrom: Date
  holdUntil: Date | null
  remark: string | null
}

export type OnboardingBatchDetailPage = {
  batch: OnboardingBatchListItem
  contractNo: string | null
  progress: OnboardingBatchProgress
  devices: OnboardingBatchDetailDevice[]
  tasks: OnboardingBatchDetailTask[]
  linkedHolds: OnboardingBatchLinkedHold[]
}

export type OnboardingBatchDatacenterDeviceChangeLog = {
  id: string
  occurredAt: Date
  changeAction: string
  changeContent: string | null
  description: string | null
  ticketNo: string | null
  importRowNo: number | null
  previousLifecycleStatus: string | null
  newLifecycleStatus: string | null
  previousOpsStatus: string | null
  newOpsStatus: string | null
  businessOnboardingBatchId: string | null
  linkedToCurrentBatch: boolean
}

export type OnboardingBatchDatacenterDevice = {
  id: string
  sn: string
  externalDeviceId: string | null
  assetNo: string | null
  internalIp: string | null
  externalIp: string | null
  gpuCount: number
  cardTypeCode: string
  cardTypeName: string
  opsStatus: string
  lifecycleStatus: string
  cooperationType: string
  devicePurpose: string | null
  inMaintenance: boolean
  linkedToBatch: boolean
  changeLogs: OnboardingBatchDatacenterDeviceChangeLog[]
}

export type OnboardingBatchDatacenterDevicesResult = {
  dataCenterName: string
  idcCode: string
  totalDevices: number
  linkedDevices: number
  devices: OnboardingBatchDatacenterDevice[]
}
