import type { trpc } from '@/lib/trpc/client'

type TrpcUtils = ReturnType<typeof trpc.useUtils>

/** 批次/设备变更后刷新全局运营大盘与资源总览统计 */
export function invalidateGlobalDashboard(utils: TrpcUtils) {
  void utils.dashboard.globalOps.getSnapshot.invalidate()
  void utils.dashboard.globalOps.getPeriod.invalidate()
  void utils.supplier.overview.getStats.invalidate()
}
