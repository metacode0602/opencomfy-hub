import type { RetireActionType } from '@/lib/types/datacenter-device-retire'

const DEVICE_UNSUBSCRIBE_ACTIONS = new Set(['设备退订', '非常规下线'])
const BARE_METAL_ACTIONS = new Set(['下架裸金属'])

export function isRetireActionCompatible(
  retireActionType: RetireActionType | null | undefined,
  changeAction: string,
): boolean {
  if (!retireActionType) return true
  if (retireActionType === 'device_unsubscribe') {
    return DEVICE_UNSUBSCRIBE_ACTIONS.has(changeAction)
  }
  if (retireActionType === 'bare_metal_offboard') {
    return BARE_METAL_ACTIONS.has(changeAction)
  }
  return true
}

export function expectedRetireActionLabel(retireActionType: RetireActionType): string {
  if (retireActionType === 'bare_metal_offboard') return '下架裸金属'
  return '设备退订 / 非常规下线'
}

export function resolveRetireLinkKind(changeAction: string): 'retired' | 'touched' {
  if (DEVICE_UNSUBSCRIBE_ACTIONS.has(changeAction)) return 'retired'
  return 'touched'
}

export function resolveLifecycleFromChangelog(params: {
  changeAction: string
  newOps: string
  inMaintenance: boolean
}): string {
  if (params.inMaintenance) return '维护中'
  if (DEVICE_UNSUBSCRIBE_ACTIONS.has(params.changeAction)) return '下线中'
  if (BARE_METAL_ACTIONS.has(params.changeAction)) return '接入中'
  if (params.newOps === '已退订') return '下线中'
  return params.newOps === '预留闲置中' ? '接入中' : '待接入'
}

export type RetireProgressFlags = {
  completion_mode?: 'auto'
  has_action_mismatch?: boolean
  has_over_plan_link?: boolean
  needs_review?: boolean
}

export function mergeRetireProgressFlags(
  current: RetireProgressFlags | null | undefined,
  patch: RetireProgressFlags,
): RetireProgressFlags {
  const next = { ...(current ?? {}), ...patch }
  if (next.has_action_mismatch || next.has_over_plan_link) {
    next.needs_review = true
  }
  return next
}
