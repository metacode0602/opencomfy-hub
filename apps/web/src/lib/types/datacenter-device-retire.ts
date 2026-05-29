import type { DataCenterDevice } from '@/lib/data/types'
import type { DeviceCooperationType } from '@/lib/types/supplier-domain'
import type {
  DeviceRetireCommitResult,
  DeviceRetireReason,
  DeviceRetireRequestMeta,
} from '@/lib/types/device-retire'

/** 机房下架计划行（与上架 planned_lines 对称） */
export type DatacenterRetirePlanLine = {
  gpuCardTypeId: string
  gpuCardTypeCode: string
  gpuCardTypeName: string
  cooperationType: DeviceCooperationType
  plannedQuantity: number
}

/** 本机房某卡型 × 合作类型的可下架台数 */
export type DatacenterRetireAvailability = {
  gpuCardTypeId: string
  gpuCardTypeCode: string
  gpuCardTypeName: string
  cooperationType: DeviceCooperationType
  /** 已上架可下架数量（Mock 或 DB 聚合） */
  listedQuantity: number
}

export type DatacenterRetireContext = {
  dataCenterId: string
  dataCenterName: string
  supplierId: string
  supplierName: string
  /** 本机房有库存的卡型（去重） */
  cardTypes: Array<{ id: string; code: string; name: string }>
  availability: DatacenterRetireAvailability[]
}

export type DatacenterRetirePlanLineDraft = {
  key: string
  gpuCardTypeId: string
  cooperationType: DeviceCooperationType | ''
  quantity: string
}

export type DatacenterRetireListParseStatus = 'ok' | 'error'

/** 下架清单解析行（Mock / 阶段二 preview 共用） */
export type DatacenterRetireListRow = {
  rowNo: number
  gpuCardTypeCode: string
  gpuCardTypeId: string | null
  gpuCardTypeName: string | null
  cooperationType: DeviceCooperationType | null
  externalIp: string | null
  internalIp: string | null
  externalDeviceId: string | null
  assetNo: string | null
  matchedDeviceId: string | null
  parseStatus: DatacenterRetireListParseStatus
  errors: string[]
}

export type DatacenterRetireListParseResult = {
  fileName: string
  rows: DatacenterRetireListRow[]
  summary: {
    total: number
    ok: number
    error: number
  }
  /** 与计划行比对是否完全一致 */
  planMatch: boolean
  planMatchErrors: string[]
}

/** 数量型计划：设备整机退订 vs 裸金属池下架 */
export type RetireActionType = 'device_unsubscribe' | 'bare_metal_offboard'

export type RetirePlanMode = 'line_plan' | 'datacenter_closure'

export const RETIRE_ACTION_TYPE_OPTIONS = [
  {
    value: 'device_unsubscribe' as const,
    label: '设备退订下架',
    description: '整机退订下线；运维变更表填「设备退订」或「非常规下线」',
    changelogActions: ['设备退订', '非常规下线'],
  },
  {
    value: 'bare_metal_offboard' as const,
    label: '设备下架',
    description: '仅退裸金属池；运维变更表填「下架裸金属」',
    changelogActions: ['下架裸金属', '线下裸金属交付', '故障维修'],
  },
] as const

export type DatacenterRetireMeta = {
  reason: DeviceRetireReason
  retireActionType?: RetireActionType
  expectedCompletionDate: string
  workOrderNo: string
  remark?: string
}

export type DatacenterRetirePreviewInput = {
  dataCenterId: string
  meta: DatacenterRetireMeta
  planLines: DatacenterRetirePlanLine[]
  list?: DatacenterRetireListParseResult
}

export type DatacenterRetirePreviewResult = {
  context: DatacenterRetireContext
  meta: DeviceRetireRequestMeta & { workOrderNo: string }
  retirePlanMode: RetirePlanMode
  retireActionType: RetireActionType
  scenarioLabel: string
  planLines: DatacenterRetirePlanLine[]
  totalPlannedQuantity: number
  /** 机房裁撤：commit 时快照的可下架设备总数 */
  datacenterSnapshotQuantity?: number
  list?: DatacenterRetireListParseResult
  valid: boolean
  errors: string[]
  changelogActionHint: string
}

export type DatacenterRetireCommitResult = DeviceRetireCommitResult & {
  batchId: string
  dataCenterId: string
  dataCenterName: string
  workOrderNo: string
  plannedLines: DatacenterRetirePlanLine[]
  totalPlannedQuantity: number
  retirePlanMode: RetirePlanMode
  retireActionType: RetireActionType
  scenarioLabel: string
  changelogActionHint: string
}

export type BuildAvailabilityInput = {
  dataCenterId: string
  gpuInventory: DataCenterDevice[]
}

/** 下架清单 CSV 表头（Mock 阶段） */
export const DATACENTER_RETIRE_LIST_HEADERS = [
  '卡型',
  '合作类型',
  '外网IP',
  '内网IP',
  '设备ID',
  '设备标识',
] as const
