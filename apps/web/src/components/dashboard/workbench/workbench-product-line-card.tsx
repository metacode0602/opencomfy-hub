'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { productLineNames } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WORKBENCH_CHART_COLORS, WORKBENCH_TOOLTIP_STYLE } from './chart-utils'

export function WorkbenchProductLineCard() {
  const { data: productLineRaw = [], isLoading } =
    trpc.crm.analytics.productLineBreakdown.useQuery({})

  const productLineData = productLineRaw.map((entry, index) => ({
    name: productLineNames[entry.name] ?? entry.name,
    value: entry.value,
    color: WORKBENCH_CHART_COLORS[index % WORKBENCH_CHART_COLORS.length]!,
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">产品线消费分布</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : productLineData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            本月暂无消费数据
          </div>
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productLineData} layout="vertical">
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  tickFormatter={(value) => `${value / 10000}万`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  width={90}
                />
                <Tooltip
                  contentStyle={WORKBENCH_TOOLTIP_STYLE}
                  labelStyle={{ color: '#fafafa' }}
                  formatter={(value) => [`¥${Number(value ?? 0).toLocaleString()}`, '消费金额']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {productLineData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
