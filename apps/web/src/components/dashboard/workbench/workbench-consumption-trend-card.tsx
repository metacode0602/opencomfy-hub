'use client'

import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { formatWorkbenchPeriodLabel } from '@/lib/crm/workbench-date-range'
import { trpc } from '@/lib/trpc/client'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { WORKBENCH_TOOLTIP_STYLE } from './chart-utils'
import { useWorkbenchPeriod } from './workbench-period-context'

export function WorkbenchConsumptionTrendCard() {
  const { queryInput } = useWorkbenchPeriod()
  const { data: consumptionTrend = [], isLoading } = trpc.crm.analytics.consumptionTrend.useQuery(
    {
      startDate: queryInput.startDate,
      endDate: queryInput.endDate,
    },
  )

  const chartData = consumptionTrend.map((row) => ({
    label: 'date' in row ? row.date.slice(5) : row.month.slice(5),
    consumption: row.consumption,
  }))

  const subtitle = formatWorkbenchPeriodLabel(queryInput.startDate, queryInput.endDate)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-medium">消费趋势</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="workbenchColorConsumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  tickFormatter={(value) => `${value / 10000}万`}
                />
                <Tooltip
                  contentStyle={WORKBENCH_TOOLTIP_STYLE}
                  labelStyle={{ color: '#fafafa' }}
                  formatter={(value) => [`¥${Number(value ?? 0).toLocaleString()}`, '消费金额']}
                />
                <Area
                  type="monotone"
                  dataKey="consumption"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#workbenchColorConsumption)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
