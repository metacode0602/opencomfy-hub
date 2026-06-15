'use client'

import { Building2, CircleDollarSign, CreditCard, FolderKanban, Wallet } from 'lucide-react'
import {
  consumptionTrendCompareLabel,
  consumptionTrendLabel,
} from '@/lib/crm/workbench-date-range'
import { StatCard } from '@/components/dashboard/stat-card'
import { trpc } from '@/lib/trpc/client'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { useWorkbenchPeriod } from './workbench-period-context'

export function WorkbenchKpiSection() {
  const { queryInput } = useWorkbenchPeriod()
  const { data: summary, isLoading } = trpc.crm.dashboard.summary.useQuery({
    preset: queryInput.preset,
    startDate: queryInput.startDate,
    endDate: queryInput.endDate,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
    )
  }

  const periodConsumption = summary?.periodConsumption ?? 0
  const periodRecharge = summary?.periodRecharge ?? 0
  const consumptionTrend =
    summary?.trends.periodConsumption ?? summary?.trends.thisMonthConsumption
  const consumptionTitle = consumptionTrendLabel(queryInput.preset)
  const compareLabel = consumptionTrendCompareLabel(queryInput.preset)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
        title={consumptionTitle}
        value={`¥${(periodConsumption / 10000).toFixed(1)}万`}
        description={consumptionTrend != null ? compareLabel : undefined}
        icon={CreditCard}
        trend={
          consumptionTrend != null
            ? { value: Math.abs(consumptionTrend), isPositive: consumptionTrend >= 0 }
            : undefined
        }
      />
      <StatCard
        title="充值金额"
        value={`¥${(periodRecharge / 10000).toFixed(1)}万`}
        icon={CircleDollarSign}
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
