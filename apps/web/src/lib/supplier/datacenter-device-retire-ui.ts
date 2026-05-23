import {
  getDeviceRetireReasonLabel,
  type DeviceRetireReason,
} from '@/lib/types/device-retire'
import type {
  DatacenterRetireAvailability,
  DatacenterRetireCommitResult,
  DatacenterRetireContext,
  DatacenterRetireListParseResult,
  DatacenterRetireMeta,
  DatacenterRetirePlanLine,
  DatacenterRetirePreviewResult,
  RetireActionType,
  RetirePlanMode,
} from '@/lib/types/datacenter-device-retire'
import { RETIRE_ACTION_TYPE_OPTIONS } from '@/lib/types/datacenter-device-retire'

let uiMockBatchSeq = 1

export function resolveRetirePlanMode(reason: DeviceRetireReason): RetirePlanMode {
  return reason === 'dc_closure' ? 'datacenter_closure' : 'line_plan'
}

export function resolveRetireActionType(
  reason: DeviceRetireReason,
  actionType: RetireActionType | '',
): RetireActionType {
  if (reason === 'dc_closure') return 'device_unsubscribe'
  return actionType === 'bare_metal_offboard' ? 'bare_metal_offboard' : 'device_unsubscribe'
}

export function getRetireScenarioLabel(
  planMode: RetirePlanMode,
  actionType: RetireActionType,
): string {
  if (planMode === 'datacenter_closure') return '机房裁撤'
  const opt = RETIRE_ACTION_TYPE_OPTIONS.find((o) => o.value === actionType)
  return opt?.label ?? '设备退订下架'
}

export function getChangelogActionHint(actionType: RetireActionType): string {
  const opt = RETIRE_ACTION_TYPE_OPTIONS.find((o) => o.value === actionType)
  return opt?.changelogActions.join(' / ') ?? '设备退订'
}

export function sumDatacenterRetireAvailability(
  availability: DatacenterRetireAvailability[],
): number {
  return availability.reduce((s, row) => s + row.listedQuantity, 0)
}

export function buildClientDatacenterRetirePreview(params: {
  context: DatacenterRetireContext
  meta: DatacenterRetireMeta
  retireActionType: RetireActionType
  planLines: DatacenterRetirePlanLine[]
  list?: DatacenterRetireListParseResult
}): DatacenterRetirePreviewResult {
  const errors: string[] = []
  const planMode = resolveRetirePlanMode(params.meta.reason)
  const actionType = resolveRetireActionType(params.meta.reason, params.retireActionType)
  const snapshotQty = sumDatacenterRetireAvailability(params.context.availability)

  if (!params.meta.workOrderNo.trim()) {
    errors.push('请填写飞书审批工单号')
  }
  if (!params.meta.expectedCompletionDate) {
    errors.push('请选择期望完成日期')
  }

  if (planMode === 'datacenter_closure') {
    if (params.planLines.length > 0) {
      errors.push('机房裁撤不需要下架计划行')
    }
    if (params.list) {
      errors.push('机房裁撤不需要上传清单')
    }
    if (snapshotQty <= 0) {
      errors.push('本机房当前无可下架设备，请确认库存后再发起裁撤')
    }
  } else {
    if (params.planLines.length === 0) {
      errors.push('请至少添加一行下架计划')
    }
    if (params.list) {
      if (params.list.summary.error > 0) {
        errors.push(`清单有 ${params.list.summary.error} 行解析错误，请修正后重新上传`)
      }
      if (!params.list.planMatch) {
        errors.push(...params.list.planMatchErrors)
      }
    }
  }

  const totalPlannedQuantity =
    planMode === 'datacenter_closure'
      ? snapshotQty
      : params.planLines.reduce((s, l) => s + l.plannedQuantity, 0)

  return {
    context: params.context,
    meta: {
      reason: params.meta.reason,
      reasonLabel: getDeviceRetireReasonLabel(params.meta.reason),
      expectedCompletionDate: params.meta.expectedCompletionDate,
      workOrderNo: params.meta.workOrderNo.trim(),
      remark: params.meta.remark?.trim() ?? '',
    },
    retirePlanMode: planMode,
    retireActionType: actionType,
    scenarioLabel: getRetireScenarioLabel(planMode, actionType),
    planLines: planMode === 'datacenter_closure' ? [] : params.planLines,
    totalPlannedQuantity,
    datacenterSnapshotQuantity: planMode === 'datacenter_closure' ? snapshotQty : undefined,
    list: planMode === 'datacenter_closure' ? undefined : params.list,
    valid: errors.length === 0,
    errors,
    changelogActionHint: getChangelogActionHint(actionType),
  }
}

export function buildClientDatacenterRetireCommit(
  preview: DatacenterRetirePreviewResult,
): DatacenterRetireCommitResult {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const batchCode = `RET-${date}-${String(uiMockBatchSeq++).padStart(3, '0')}`

  return {
    batchCount: 1,
    retiredCount: 0,
    skippedCount: 0,
    batchCodes: [batchCode],
    batchId: `ui-draft-${batchCode}`,
    meta: preview.meta,
    dataCenterId: preview.context.dataCenterId,
    dataCenterName: preview.context.dataCenterName,
    workOrderNo: preview.meta.workOrderNo,
    plannedLines: preview.planLines,
    totalPlannedQuantity: preview.totalPlannedQuantity,
    retirePlanMode: preview.retirePlanMode,
    retireActionType: preview.retireActionType,
    scenarioLabel: preview.scenarioLabel,
    changelogActionHint: preview.changelogActionHint,
  }
}
