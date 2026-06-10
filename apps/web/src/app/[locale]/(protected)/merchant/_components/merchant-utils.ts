import type {
  MerchantAccessMode,
  MerchantActivityType,
  MerchantRegionStatus,
  MerchantRechargeSource,
  MerchantRechargeStatus,
  MerchantStatus,
  MerchantType,
  TenantMerchantBindingRole,
} from '@/lib/types/merchant'

export const merchantAccessModeLabels: Record<MerchantAccessMode, string> = {
  oem: 'OEM',
  api: 'API',
  iframe: 'IFrame',
}

export const merchantRechargeStatusLabels: Record<MerchantRechargeStatus, string> = {
  pending: '待支付',
  completed: '已完成',
  cancelled: '已取消',
}

export const merchantRechargeSourceLabels: Record<MerchantRechargeSource, string> = {
  manual: '手工录入',
  platform_sync: '平台同步',
}

export const merchantActivityTypeLabels: Record<MerchantActivityType, string> = {
  info_updated: '信息变更',
  recharge_created: '充值',
  recharge_updated: '充值变更',
  region_added: '区域配置',
  platform_sync: '平台同步',
  status_changed: '状态变更',
  comment: '评论',
  file: '附件',
}

export const RECHARGE_STATUS_BADGE: Record<MerchantRechargeStatus, string> = {
  pending: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  completed: 'border-green-500/40 text-green-700 dark:text-green-300',
  cancelled: 'border-muted-foreground/30 text-muted-foreground',
}

export const merchantTypeLabels: Record<MerchantType, string> = {
  platform_direct: '平台直营',
  partner: '合作伙伴',
}

export const merchantStatusLabels: Record<MerchantStatus, string> = {
  active: '正常',
  inactive: '停用',
  suspended: '暂停',
}

export const merchantRegionStatusLabels: Record<MerchantRegionStatus, string> = {
  open: '开放',
  closed: '关闭',
  maintenance: '维护中',
}

export const bindingRoleLabels: Record<TenantMerchantBindingRole, string> = {
  platform_primary: '平台主绑定',
  commercial: '商务附加',
  historical: '历史',
}

export const MERCHANT_STATUS_BADGE: Record<MerchantStatus, string> = {
  active: 'border-green-500/40 text-green-700 dark:text-green-300',
  inactive: 'border-muted-foreground/30 text-muted-foreground',
  suspended: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
}

export const REGION_STATUS_BADGE: Record<MerchantRegionStatus, string> = {
  open: 'border-green-500/40 text-green-700 dark:text-green-300',
  closed: 'border-muted-foreground/30 text-muted-foreground',
  maintenance: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatQuota(quota: number | null, used: number): string {
  if (quota === null) return '不限'
  const remaining = Math.max(0, quota - used)
  return `${used} / ${quota}（剩余 ${remaining}）`
}

export function quotaUsagePercent(quota: number | null, used: number): number {
  if (quota === null || quota <= 0) return 0
  return Math.min(100, Math.round((used / quota) * 100))
}
