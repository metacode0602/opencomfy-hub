export const PERSONAL_INCOME_SUMMARY_KINDS = {
  nonProject: 'non_project',
  blacklist: 'blacklist',
} as const

export type PersonalIncomeSummaryKind =
  (typeof PERSONAL_INCOME_SUMMARY_KINDS)[keyof typeof PERSONAL_INCOME_SUMMARY_KINDS]

export function personalIncomeSummaryKindLabel(kind: PersonalIncomeSummaryKind): string {
  switch (kind) {
    case PERSONAL_INCOME_SUMMARY_KINDS.nonProject:
      return '个人收入（非项目租户）'
    case PERSONAL_INCOME_SUMMARY_KINDS.blacklist:
      return '黑名单租户子集'
    default:
      return kind
  }
}

export const PERSONAL_TENANT_BILL_HINT =
  '必填 · 列：租户ID、总消费、券消费、余额消费、总卡时、券卡时、余额卡时、GPU型号、区域（与成本账单详情一致）'

export const PERSONAL_BAREMETAL_HINT =
  '必填 · 列：订单ID、租户ID、机房名称、设备型号、支付状态、最终总额、下单时间（支持 5/31/26 表示 2026-05-31）等'
