import type {
  DatacenterDockingScope,
  SupplyChainLeadAuthorRole,
  SupplyChainLeadStatus,
  SupplyChainLeadType,
} from './types'

export const LEAD_TYPE_LABELS: Record<SupplyChainLeadType, string> = {
  supplier: '供应商',
  datacenter: '机房',
}

export const LEAD_STATUS_LABELS: Record<SupplyChainLeadStatus, string> = {
  new: '新建',
  contacting: '接洽中',
  evaluating: '评估中',
  negotiating: '商务谈判',
  converted: '已转正',
  lost: '已流失',
}

export const LEAD_STATUS_COLORS: Record<SupplyChainLeadStatus, string> = {
  new: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  contacting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  evaluating: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  negotiating: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export const LEAD_PRIORITY_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
} as const

export const LEAD_PRIORITY_COLORS = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
} as const

export function getAuthorRoleLabel(role: SupplyChainLeadAuthorRole): string {
  switch (role) {
    case 'supply':
      return '供应链'
    case 'business':
      return '商务'
    case 'ops':
      return '运维'
    case 'system':
      return '系统'
    default:
      return role
  }
}

export const DOCKING_SCOPE_LABELS: Record<DatacenterDockingScope, string> = {
  spot_only: '仅Spot',
  bare_metal_only: '仅裸金属',
  spot_and_bare_metal: 'Spot+仅裸金属',
  normal: '正常',
}

export const DOCKING_SCOPE_COLORS: Record<DatacenterDockingScope, string> = {
  spot_only: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  bare_metal_only: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  spot_and_bare_metal: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  normal: 'bg-green-500/20 text-green-400 border-green-500/30',
}

export const LEAD_STAGE_STEPS: { key: SupplyChainLeadStatus; name: string }[] = [
  { key: 'new', name: '新建' },
  { key: 'contacting', name: '接洽中' },
  { key: 'evaluating', name: '评估中' },
  { key: 'negotiating', name: '商务谈判' },
  { key: 'converted', name: '已转正' },
]
