'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { ChartContainer, type ChartConfig } from '@workspace/ui/components/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { trpc } from '@/lib/trpc/client'
import type {
  GpuResourceTrendPoint,
  GpuResourceTrendRange,
  GpuResourceTrendRegionPoint,
} from '@/lib/types/supplier-overview-api'

const chartConfig = {
  totalCount: {
    label: '总量',
    color: '#6366f1',
  },
  usedCount: {
    label: '使用量',
    color: '#22c55e',
  },
} satisfies ChartConfig

const RANGE_OPTIONS: Array<{ value: GpuResourceTrendRange; label: string }> = [
  { value: '24h', label: '近 24 小时' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
]

type ChartRow = {
  timestamp: string
  label: string
  totalCount: number
  usedCount: number
}

type TooltipEntry = {
  payload?: ChartRow
}

function RegionBreakdownList({ regions }: { regions: GpuResourceTrendRegionPoint[] }) {
  const visible = regions.filter((r) => r.totalCount > 0 || r.usedCount > 0)
  if (visible.length === 0) {
    return <p className="text-muted-foreground">暂无区域明细</p>
  }

  return (
    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-border/60 pt-2">
      {visible.map((region) => (
        <div
          key={region.region}
          className="flex items-start justify-between gap-3 text-[11px] leading-5"
        >
          <span className="min-w-0 text-muted-foreground">
            <span className="block truncate font-medium text-foreground">
              {region.dataCenterName ?? region.region}
            </span>
            {region.dataCenterName ? (
              <span className="block truncate text-[10px]">{region.region}</span>
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums text-right">
            <span className="block text-foreground">{region.totalCount.toLocaleString()} 卡</span>
            <span className="block text-muted-foreground">
              使用 {region.usedCount.toLocaleString()} 卡
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function GpuResourceTrendTooltip({
  active,
  payload,
  breakdownByTimestamp,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  breakdownByTimestamp: Map<string, GpuResourceTrendPoint>
}) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  const breakdown = breakdownByTimestamp.get(point.timestamp)
  if (!breakdown) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md text-xs min-w-[240px] max-w-[320px]">
      <p className="font-medium mb-2">{breakdown.label}</p>
      <div className="space-y-1.5">
        <p className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: chartConfig.totalCount.color }}
            />
            总量
          </span>
          <span className="font-medium tabular-nums">{breakdown.totalCount.toLocaleString()} 卡</span>
        </p>
        <p className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: chartConfig.usedCount.color }}
            />
            使用量
          </span>
          <span className="font-medium tabular-nums">{breakdown.usedCount.toLocaleString()} 卡</span>
        </p>
      </div>
      <RegionBreakdownList regions={breakdown.regions} />
    </div>
  )
}

export function GpuResourceTrendChart() {
  const [range, setRange] = useState<GpuResourceTrendRange>('24h')

  const { data, isLoading, isError, error } = trpc.supplier.overview.getGpuResourceTrend.useQuery({
    range,
  })

  const { chartData, breakdownByTimestamp } = useMemo(() => {
    const points = data?.points ?? []
    const breakdownByTimestamp = new Map(points.map((point) => [point.timestamp, point]))
    const chartData: ChartRow[] = points.map((point) => ({
      timestamp: point.timestamp,
      label: point.label,
      totalCount: point.totalCount,
      usedCount: point.usedCount,
    }))
    return { chartData, breakdownByTimestamp }
  }, [data?.points])

  const latest = chartData.at(-1)
  const utilization =
    latest && latest.totalCount > 0
      ? Math.round((latest.usedCount / latest.totalCount) * 1000) / 10
      : null

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base">卡资源时序</CardTitle>
          <CardDescription>
            全机房 GPU 总量与使用量趋势
            {data?.meta
              ? ` · ${data.meta.regionCount} 个区域 · ${data.meta.gpuNameCount} 种卡型`
              : ''}
            {utilization != null ? ` · 当前利用率 ${utilization}%` : ''}
          </CardDescription>
        </div>
        <Select value={range} onValueChange={(value) => setRange(value as GpuResourceTrendRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="时间范围" />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在加载卡资源时序…
          </div>
        ) : isError ? (
          <div className="flex h-[320px] items-center justify-center px-4 text-center text-sm text-destructive">
            加载失败：{error?.message ?? '未知错误'}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            暂无可展示的时序数据，请确认机房已维护容器实例区域与 GPU 卡型
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full min-w-0"
            initialDimension={{ width: 800, height: 320 }}
          >
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(value) =>
                    Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : String(value)
                  }
                  width={48}
                />
                <Tooltip
                  content={<GpuResourceTrendTooltip breakdownByTimestamp={breakdownByTimestamp} />}
                />
                <Legend
                  formatter={(value) =>
                    chartConfig[value as keyof typeof chartConfig]?.label ?? value
                  }
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalCount"
                  name="totalCount"
                  stroke="var(--color-totalCount)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="usedCount"
                  name="usedCount"
                  stroke="var(--color-usedCount)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
