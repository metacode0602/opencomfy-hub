import type { trpc } from '@/lib/trpc/client'

type TrpcUtils = ReturnType<typeof trpc.useUtils>

/** CRM 工作台相关 query 失效 */
export function invalidateCrmWorkbench(utils: TrpcUtils) {
  void utils.crm.dashboard.summary.invalidate()
  void utils.crm.dashboard.recentProjects.invalidate()
  void utils.crm.dashboard.recentActivities.invalidate()
  void utils.crm.dashboard.pendingBills.invalidate()
  void utils.crm.analytics.consumptionTrend.invalidate()
  void utils.crm.analytics.productLineBreakdown.invalidate()
}
