'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { trpc } from '@/lib/trpc/client'
import type {
  BalanceSnapshotGranularity,
  ProjectBalanceSnapshotTenant,
} from '@/lib/types/balance-snapshot'

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7'] as const

function currentUsageMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return y && m ? `${y}-${m}` : new Date().toISOString().slice(0, 7)
}

function currentUsageDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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
  const [granularity, setGranularity] = useState<BalanceSnapshotGranularity>('day')
  const [usageMonth, setUsageMonth] = useState(currentUsageMonth)
  const [usageDate, setUsageDate] = useState(currentUsageDate)

  const { data, isLoading } = trpc.crm.projects.listBalanceSnapshots.useQuery({
    projectId,
    granularity,
    usageMonth: granularity === 'day' ? usageMonth : undefined,
    usageDate: granularity === 'hour' ? usageDate : undefined,
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

  const monthOptions = useMemo(() => {
    const months = new Set<string>()
    months.add(currentUsageMonth())
    months.add(usageMonth)
    return [...months].sort((a, b) => b.localeCompare(a))
  }, [usageMonth])

  const dateOptions = useMemo(() => {
    const dates = new Set<string>()
    dates.add(currentUsageDate())
    dates.add(usageDate)
    for (let i = 1; i <= 6; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.add(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d),
      )
    }
    return [...dates].sort((a, b) => b.localeCompare(a))
  }, [usageDate])

  const subtitle =
    granularity === 'day'
      ? `按天展示关联租户账户余额 · ${usageMonth}`
      : `按小时展示关联租户账户余额 · ${usageDate}`

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
          {granularity === 'day' ? (
            <Select value={usageMonth} onValueChange={setUsageMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="月份" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={usageDate} onValueChange={setUsageDate}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="日期" />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            <ResponsiveContainer width="100%" height="100%">
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
                {tenants.map((tenant, i) => {
                  const color = LINE_COLORS[i % LINE_COLORS.length]!
                  return (
                    <Line
                      key={tenant.id}
                      type="monotone"
                      dataKey={tenant.id}
                      name={tenant.id}
                      stroke={color}
                      strokeWidth={2}
                      dot={granularity === 'hour' ? { r: 2 } : false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
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
