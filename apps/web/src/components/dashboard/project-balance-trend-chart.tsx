'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { ChartContainer, type ChartConfig } from '@workspace/ui/components/chart'
import { Input } from '@workspace/ui/components/input'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { shanghaiUsageMonth } from '@/lib/crm/balance-snapshot-utils'
import { trpc } from '@/lib/trpc/client'
import type {
  BalanceSnapshotGranularity,
  ProjectBalanceSnapshotTenant,
} from '@/lib/types/balance-snapshot'

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7'] as const

function currentUsageDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function defaultDateRange(): { from: string; to: string } {
  const to = currentUsageDate()
  return { from: `${shanghaiUsageMonth()}-01`, to }
}

function normalizeDateRange(from: string, to: string) {
  return from <= to ? { from, to } : { from: to, to: from }
}

function formatMoney(n: number) {
  return `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildChartRows(
  points: Array<{ bucketStart: string; label: string; values: Record<string, number> }>,
  tenants: ProjectBalanceSnapshotTenant[],
) {
  return points.map((point) => {
    const row: Record<string, string | number> = {
      bucketStart: point.bucketStart,
      label: point.label,
    }
    for (const tenant of tenants) {
      const value = point.values[tenant.id]
      if (value != null) row[tenant.id] = value
    }
    return row
  })
}

type BalanceTooltipEntry = {
  dataKey?: string | number
  value?: number | string
  color?: string
}

function BalanceTrendTooltip({
  active,
  payload,
  label,
  tenants,
}: {
  active?: boolean
  payload?: BalanceTooltipEntry[]
  label?: string | number
  tenants: ProjectBalanceSnapshotTenant[]
}) {
  if (!active || !payload?.length) return null

  const entries = payload.filter((p) => p.value != null && !Number.isNaN(Number(p.value)))

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md text-xs min-w-[180px]">
      <p className="font-medium mb-2">{label}</p>
      <div className="space-y-1.5">
        {entries.map((entry, i) => {
          const tenant = tenants.find((t) => t.id === entry.dataKey)
          const color = LINE_COLORS[i % LINE_COLORS.length]
          return (
            <p key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {tenant?.name ?? entry.dataKey}
              </span>
              <span className="font-medium tabular-nums">{formatMoney(Number(entry.value))}</span>
            </p>
          )
        })}
      </div>
    </div>
  )
}

interface ProjectBalanceTrendChartProps {
  projectId: string
}

export function ProjectBalanceTrendChart({ projectId }: ProjectBalanceTrendChartProps) {
  const initialRange = defaultDateRange()
  const [granularity, setGranularity] = useState<BalanceSnapshotGranularity>('day')
  const [usageDateFrom, setUsageDateFrom] = useState(initialRange.from)
  const [usageDateTo, setUsageDateTo] = useState(initialRange.to)

  const dateRange = useMemo(
    () => normalizeDateRange(usageDateFrom, usageDateTo),
    [usageDateFrom, usageDateTo],
  )

  const { data, isLoading } = trpc.crm.projects.listBalanceSnapshots.useQuery({
    projectId,
    granularity,
    usageDateFrom: dateRange.from,
    usageDateTo: dateRange.to,
  })

  const tenants = data?.tenants ?? []
  const chartData = useMemo(
    () => buildChartRows(data?.points ?? [], tenants),
    [data?.points, tenants],
  )

  const hasData = useMemo(
    () =>
      chartData.some((row) =>
        tenants.some((t) => row[t.id] != null && typeof row[t.id] === 'number'),
      ),
    [chartData, tenants],
  )

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    tenants.forEach((tenant, i) => {
      config[tenant.id] = {
        label: tenant.name,
        color: LINE_COLORS[i % LINE_COLORS.length]!,
      }
    })
    return config
  }, [tenants])

  const rangeLabel =
    dateRange.from === dateRange.to
      ? dateRange.from
      : `${dateRange.from} ~ ${dateRange.to}`

  const subtitle =
    granularity === 'day'
      ? `按天展示关联租户账户余额 · ${rangeLabel}`
      : `按小时展示关联租户账户余额 · ${rangeLabel}`

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">余额变动</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={granularity}
            onValueChange={(v) => setGranularity(v as BalanceSnapshotGranularity)}
          >
            <TabsList>
              <TabsTrigger value="day">按天</TabsTrigger>
              <TabsTrigger value="hour">按小时</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              type="date"
              className="h-9 w-[150px] text-sm"
              value={usageDateFrom}
              max={usageDateTo}
              onChange={(e) => setUsageDateFrom(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Input
              type="date"
              className="h-9 w-[150px] text-sm"
              value={usageDateTo}
              min={usageDateFrom}
              onChange={(e) => setUsageDateTo(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full min-w-0">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              加载中…
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center px-4">
              项目未关联计费租户，无法展示余额变动
            </div>
          ) : chartData.length === 0 || !hasData ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground text-center px-4">
              <p>该时段暂无余额快照数据</p>
              <p className="text-xs">请开启余额快照采集或在设置中手动采集</p>
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-full w-full min-w-0"
              initialDimension={{ width: 800, height: 260 }}
            >
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(v) =>
                    Math.abs(v) >= 10000
                      ? `${(v / 10000).toFixed(0)}万`
                      : Math.abs(v) >= 1000
                        ? `${(v / 1000).toFixed(0)}k`
                        : String(v)
                  }
                  width={52}
                />
                <Tooltip content={<BalanceTrendTooltip tenants={tenants} />} />
                <Legend
                  formatter={(value) => tenants.find((t) => t.id === value)?.name ?? String(value)}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                {tenants.map((tenant) => (
                  <Line
                    key={tenant.id}
                    type="monotone"
                    dataKey={tenant.id}
                    name={tenant.id}
                    stroke={`var(--color-${tenant.id})`}
                    strokeWidth={2}
                    dot={granularity === 'hour' ? { r: 2 } : false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </div>
        {tenants.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {tenants.map((t) => (
              <span key={t.id}>
                {t.name} 当前 {formatMoney(t.currentBalance)}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
