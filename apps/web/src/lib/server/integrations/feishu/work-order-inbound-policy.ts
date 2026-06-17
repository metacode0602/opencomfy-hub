import 'server-only'

import type {
  FeishuWorkOrderInboundPolicy,
  FeishuWorkOrderStatusMapping,
  FeishuWorkOrderStatusSemantic,
} from '@/lib/types/feishu-work-order'
import { FEISHU_TERMINAL_BATCH_STATUSES } from './types'

export type ResolveBatchStatusInput = {
  workOrderStatus: string
  statusMapping: FeishuWorkOrderStatusMapping
  batchKind: string
  currentBatchStatus: string
  policy: FeishuWorkOrderInboundPolicy
  autoCompleteEnabled: boolean
  autoCompleteBatchKind: boolean
}

export type ResolveBatchStatusResult = {
  semantic: FeishuWorkOrderStatusSemantic | null
  nextBatchStatus: string
  shouldUpdateBatchStatus: boolean
  isTerminalComplete: boolean
  isTerminalCancel: boolean
}

function inProgressBatchStatus(batchKind: string): string | null {
  switch (batchKind) {
    case 'online':
    case 'order_access':
      return '接入中'
    case 'device_retire':
      return '下架中'
    case 'internal_occupancy':
      return '占用中'
    default:
      return null
  }
}

export function resolveStatusSemantic(
  workOrderStatus: string,
  statusMapping: FeishuWorkOrderStatusMapping,
): FeishuWorkOrderStatusSemantic | null {
  const key = workOrderStatus.trim()
  return statusMapping[key] ?? null
}

export function resolveBatchStatusFromWorkOrder(input: ResolveBatchStatusInput): ResolveBatchStatusResult {
  const semantic = resolveStatusSemantic(input.workOrderStatus, input.statusMapping)
  const isTerminalComplete = semantic === 'completed'
  const isTerminalCancel = semantic === 'cancelled'
  const isTerminal = FEISHU_TERMINAL_BATCH_STATUSES.has(input.currentBatchStatus)

  let nextBatchStatus = input.currentBatchStatus
  let shouldUpdateBatchStatus = false

  if (!semantic) {
    return {
      semantic: null,
      nextBatchStatus,
      shouldUpdateBatchStatus: false,
      isTerminalComplete: false,
      isTerminalCancel: false,
    }
  }

  if (semantic === 'pending_review' || semantic === 'pending_assign') {
    return {
      semantic,
      nextBatchStatus,
      shouldUpdateBatchStatus: false,
      isTerminalComplete: false,
      isTerminalCancel: false,
    }
  }

  if (semantic === 'in_progress') {
    if (!isTerminal && input.policy.auto_sync_in_progress_status !== false) {
      const mapped = inProgressBatchStatus(input.batchKind)
      if (mapped && mapped !== input.currentBatchStatus) {
        nextBatchStatus = mapped
        shouldUpdateBatchStatus = true
      }
    }
    return {
      semantic,
      nextBatchStatus,
      shouldUpdateBatchStatus,
      isTerminalComplete: false,
      isTerminalCancel: false,
    }
  }

  if (semantic === 'completed') {
    if (
      !isTerminal &&
      input.autoCompleteEnabled &&
      input.autoCompleteBatchKind
    ) {
      nextBatchStatus = '已完成'
      shouldUpdateBatchStatus = true
    }
    return {
      semantic,
      nextBatchStatus,
      shouldUpdateBatchStatus,
      isTerminalComplete: true,
      isTerminalCancel: false,
    }
  }

  if (semantic === 'cancelled') {
    if (!isTerminal) {
      nextBatchStatus = '已取消'
      shouldUpdateBatchStatus = true
    }
    return {
      semantic,
      nextBatchStatus,
      shouldUpdateBatchStatus,
      isTerminalComplete: false,
      isTerminalCancel: true,
    }
  }

  return {
    semantic,
    nextBatchStatus,
    shouldUpdateBatchStatus: false,
    isTerminalComplete,
    isTerminalCancel,
  }
}

export function shouldWriteWorkOrderTimeline(
  semantic: FeishuWorkOrderStatusSemantic | null,
  policy: FeishuWorkOrderInboundPolicy,
): boolean {
  if (!semantic) return false
  if (policy.timeline_on_terminal_only) {
    return semantic === 'completed' || semantic === 'cancelled'
  }
  return policy.timeline_on_every_sync !== false
}

export function buildCrossChannelDedupeKey(
  recordId: string,
  workOrderStatus: string,
  occurredAt: Date,
  dedupeWindowSeconds: number,
): string {
  const window = Math.max(1, dedupeWindowSeconds)
  const bucket = Math.floor(occurredAt.getTime() / 1000 / window)
  return `cross:${recordId}:${workOrderStatus.trim()}:${bucket}`
}
