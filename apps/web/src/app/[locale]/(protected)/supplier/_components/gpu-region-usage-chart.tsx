'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { ChartContainer, type ChartConfig } from '@workspace/ui/components/chart'
import { trpc } from '@/lib/trpc/client'
import type { GpuRegionUsageRow } from '@/lib/types/supplier-overview-api'

const usageChartConfig = {
  elasticUsedCount: {
    label: '弹性服务',
    color: '#22c55e',
  },
  spotUsedCount: {
    label: 'Spot 实例',
    color: '#f59e0b',
  },
  idleCount: {
    label: '空闲',
    color: '#94a3b8',
  },
} satisfies ChartConfig

const capacityChartConfig = {
  totalDeviceCount: {
    label: '设备台数',
    color: '#6366f1',
  },
  totalGpuCount: {
    label: 'GPU 卡数',
    color: '#06b6d4',
  },
} satisfies ChartConfig

type ChartRow = GpuRegionUsageRow & {
  displayName: string
}

function formatAxisTick(value: number) {
  return Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : String(value)
}

function RegionUsageTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
}) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const usedTotal = row.elasticUsedCount + row.spotUsedCount
  const utilization =
    row.totalGpuCount > 0 ? Math.round((usedTotal / row.totalGpuCount) * 1000) / 10 : 0

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md min-w-[220px]">
      <p className="font-medium">{row.dataCenterName ?? row.region}</p>
      {row.dataCenterName ? (
        <p className="text-[10px] text-muted-foreground">{row.region}</p>
      ) : null}
      {row.gpuName ? (
        <p className="mt-1 text-muted-foreground">卡型 {row.gpuName}</p>
      ) : null}
      <div className="mt-2 space-y-1">
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">总量</span>
          <span className="tabular-nums font-medium">{row.totalGpuCount.toLocaleString()} 卡</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">弹性服务</span>
          <span className="tabular-nums">{row.elasticUsedCount.toLocaleString()} 卡</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">Spot</span>
          <span className="tabular-nums">{row.spotUsedCount.toLocaleString()} 卡</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">空闲</span>
          <span className="tabular-nums">{row.idleCount.toLocaleString()} 卡</span>
        </p>
        <p className="flex justify-between gap-4 border-t border-border/60 pt-1">
          <span className="text-muted-foreground">占用率</span>
          <span className="tabular-nums font-medium">{utilization}%</span>
        </p>
      </div>
    </div>
  )
}

function RegionCapacityTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
}) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const cardsPerDevice =
    row.totalDeviceCount > 0
      ? Math.round((row.totalGpuCount / row.totalDeviceCount) * 10) / 10
      : null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md min-w-[220px]">
      <p className="font-medium">{row.dataCenterName ?? row.region}</p>
      {row.dataCenterName ? (
        <p className="text-[10px] text-muted-foreground">{row.region}</p>
      ) : null}
      {row.gpuName ? (
        <p className="mt-1 text-muted-foreground">卡型 {row.gpuName}</p>
      ) : null}
      <div className="mt-2 space-y-1">
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">设备台数</span>
          <span className="tabular-nums font-medium">
            {row.totalDeviceCount.toLocaleString()} 台
          </span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">GPU 卡数</span>
          <span className="tabular-nums font-medium">{row.totalGpuCount.toLocaleString()} 卡</span>
        </p>
        {cardsPerDevice != null ? (
          <p className="flex justify-between gap-4 border-t border-border/60 pt-1">
            <span className="text-muted-foreground">均卡/台</span>
            <span className="tabular-nums">{cardsPerDevice} 卡</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ChartLoading({ label }: { label: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

function ChartError({ message }: { message: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center px-4 text-center text-sm text-destructive">
      加载失败：{message}
    </div>
  )
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function GpuRegionUsageChart() {
  const { data, isLoading, isError, error } = trpc.supplier.overview.getGpuRegionOverview.useQuery()

  const chartData = useMemo<ChartRow[]>(() => {
    return (data?.rows ?? []).map((row) => ({
      ...row,
      displayName: row.dataCenterName ?? row.region,
    }))
  }, [data?.rows])

  const totalGpu = chartData.reduce((sum, row) => sum + row.totalGpuCount, 0)
  const totalUsed = chartData.reduce(
    (sum, row) => sum + row.elasticUsedCount + row.spotUsedCount,
    0,
  )
  const overallUtilization =
    totalGpu > 0 ? Math.round((totalUsed / totalGpu) * 1000) / 10 : null

  const sharedBody = isLoading ? (
    <ChartLoading label="正在加载区域资源数据…" />
  ) : isError ? (
    <ChartError message={error?.message ?? '未知错误'} />
  ) : chartData.length === 0 ? (
    <ChartEmpty message="暂无可展示的区域数据，请确认机房已维护容器实例区域与 GPU 卡型" />
  ) : null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">区域 GPU 卡占用</CardTitle>
          <CardDescription>
            各容器实例区域弹性服务与 Spot 占用分布
            {data?.meta
              ? ` · ${data.meta.regionCount} 个区域 · ${data.meta.gpuNameCount} 种卡型`
              : ''}
            {overallUtilization != null ? ` · 整体占用 ${overallUtilization}%` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sharedBody ?? (
            <ChartContainer
              config={usageChartConfig}
              className="aspect-auto h-[320px] w-full min-w-0"
              initialDimension={{ width: 480, height: 320 }}
            >
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                barCategoryGap="38%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="displayName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={formatAxisTick}
                  width={44}
                />
                <Tooltip content={<RegionUsageTooltip />} />
                <Legend
                  formatter={(value) =>
                    usageChartConfig[value as keyof typeof usageChartConfig]?.label ?? value
                  }
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Bar
                  dataKey="elasticUsedCount"
                  name="elasticUsedCount"
                  stackId="usage"
                  fill="var(--color-elasticUsedCount)"
                  maxBarSize={22}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="spotUsedCount"
                  name="spotUsedCount"
                  stackId="usage"
                  fill="var(--color-spotUsedCount)"
                  maxBarSize={22}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="idleCount"
                  name="idleCount"
                  stackId="usage"
                  fill="var(--color-idleCount)"
                  maxBarSize={22}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">区域设备与卡总量</CardTitle>
          <CardDescription>各区域物理设备台数与 GPU 卡数对比</CardDescription>
        </CardHeader>
        <CardContent>
          {sharedBody ?? (
            <ChartContainer
              config={capacityChartConfig}
              className="aspect-auto h-[320px] w-full min-w-0"
              initialDimension={{ width: 480, height: 320 }}
            >
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                barCategoryGap="38%"
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="displayName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={formatAxisTick}
                  width={44}
                />
                <Tooltip content={<RegionCapacityTooltip />} />
                <Legend
                  formatter={(value) =>
                    capacityChartConfig[value as keyof typeof capacityChartConfig]?.label ?? value
                  }
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Bar
                  dataKey="totalDeviceCount"
                  name="totalDeviceCount"
                  fill="var(--color-totalDeviceCount)"
                  maxBarSize={16}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="totalGpuCount"
                  name="totalGpuCount"
                  fill="var(--color-totalGpuCount)"
                  maxBarSize={16}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
