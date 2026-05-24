import { contractPricingModeNames, type CooperationMode } from '@/lib/data/types'

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

export const billStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
}
