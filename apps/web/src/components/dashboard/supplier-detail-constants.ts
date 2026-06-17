import { contractPricingModeNames, type CooperationMode } from '@/lib/data/types'
import { Ban, CheckCircle2, PauseCircle, type LucideIcon } from 'lucide-react'

export const cooperationModeLabels: Record<CooperationMode, string> = contractPricingModeNames

export const statusNames: Record<string, string> = {
  negotiating: '洽谈中',
  cooperating: '合作中',
  suspended: '已暂停',
  terminated: '已终止',
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
  draft: '草稿',
  pending: '待签署',
  active: '生效中',
  expired: '已过期',
  confirmed: '已确认',
  paid: '已结算',
}

export const dcStatusColors: Record<string, string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

export type DataCenterCooperationStatus = 'active' | 'pause' | 'inactive'

export const dcCooperationStatusNames: Record<DataCenterCooperationStatus, string> = {
  active: '合作中',
  pause: '合作暂停',
  inactive: '合作终止',
}

export const dcCooperationStatusColors: Record<DataCenterCooperationStatus, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  pause: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export const dcCooperationStatusIcons: Record<DataCenterCooperationStatus, LucideIcon> = {
  active: CheckCircle2,
  pause: PauseCircle,
  inactive: Ban,
}

export const dcCooperationStatusConfirmDescriptions: Record<DataCenterCooperationStatus, string> = {
  active: '恢复与该机房的合作关系，机房将标记为合作中。',
  pause: '暂停与该机房的合作，机房将标记为合作暂停。',
  inactive: '终止与该机房的合作，机房将标记为合作终止。',
}

export const billStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
}
