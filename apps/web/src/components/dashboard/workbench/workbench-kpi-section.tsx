'use client'

import { Building2, CreditCard, FolderKanban, Wallet } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { trpc } from '@/lib/trpc/client'
import { Skeleton } from '@workspace/ui/components/skeleton'

export function WorkbenchKpiSection() {
  const { data: summary, isLoading } = trpc.crm.dashboard.summary.useQuery()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
    )
  }

  const thisMonthConsumption = summary?.thisMonthConsumption ?? 0
  const consumptionTrend = summary?.trends.thisMonthConsumption

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="活跃客户"
        value={summary?.activeCustomerCount ?? 0}
        icon={Building2}
      />
      <StatCard
        title="运行项目"
        value={summary?.activeProjectCount ?? 0}
        icon={FolderKanban}
      />
      <StatCard
        title="本月消费"
        value={`¥${(thisMonthConsumption / 10000).toFixed(1)}万`}
        description={consumptionTrend != null ? '较上月' : undefined}
        icon={CreditCard}
        trend={
          consumptionTrend != null
            ? { value: Math.abs(consumptionTrend), isPositive: consumptionTrend >= 0 }
            : undefined
        }
      />
      <StatCard
        title="账户余额"
        value={`¥${((summary?.totalBalance ?? 0) / 10000).toFixed(1)}万`}
        description="总余额"
        icon={Wallet}
      />
    </div>
  )
}
