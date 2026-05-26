'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { trpc } from '@/lib/trpc/client'

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899'] as const

/** 趋势图固定四条线：弹性服务、云主机、Job、存储 */
const CONSUMPTION_TREND_CATEGORIES = [
  {
    key: 'elastic_service',
    label: '弹性服务',
    productLines: ['elastic_service', 'serverless', 'pod_deployment', 'pod_development'],
  },
  {
    key: 'cloud_vm',
    label: '云主机',
    productLines: ['cloud_vm'],
  },
  {
    key: 'job',
    label: 'Job',
    productLines: ['job', 'pod_job'],
  },
  {
    key: 'storage',
    label: '存储',
    productLines: [
      'image_registry',
      'object_storage',
      'shared_storage',
      'harbor',
      'share_storage',
      'juicefs',
    ],
  },
] as const

type TrendCategoryKey = (typeof CONSUMPTION_TREND_CATEGORIES)[number]['key']

const TREND_CATEGORY_KEYS = CONSUMPTION_TREND_CATEGORIES.map((c) => c.key)

const PRODUCT_LINE_TO_TREND_CATEGORY = new Map<string, TrendCategoryKey>(
  CONSUMPTION_TREND_CATEGORIES.flatMap((category) =>
    category.productLines.map((pl) => [pl, category.key]),
  ),
)

const TREND_CATEGORY_LABELS = Object.fromEntries(
  CONSUMPTION_TREND_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<TrendCategoryKey, string>

type CategoryBreakdown = {
  amount: number
  voucherAmount: number
  balanceAmount: number
}

type ChartRow = {
  usageDate: string
  dateLabel: string
} & Record<TrendCategoryKey, number>

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

function formatMoney(n: number) {
  return `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function trendCategoryLabel(code: string) {
  return TREND_CATEGORY_LABELS[code as TrendCategoryKey] ?? code
}

function safeGradientId(categoryKey: string) {
  return `trend-${categoryKey.replace(/[^a-zA-Z0-9]/g, '_')}`
}

function emptyCategoryBreakdown(): CategoryBreakdown {
  return { amount: 0, voucherAmount: 0, balanceAmount: 0 }
}

function buildTrendData(
  rows: Array<{
    usageDate: string
    productLine: string
    amount: number
    voucherAmount: number
    balanceAmount: number
  }>,
) {
  const breakdownByDate = new Map<string, Map<TrendCategoryKey, CategoryBreakdown>>()

  for (const row of rows) {
    const category = PRODUCT_LINE_TO_TREND_CATEGORY.get(row.productLine)
    if (!category) continue

    if (!breakdownByDate.has(row.usageDate)) {
      breakdownByDate.set(row.usageDate, new Map())
    }
    const byCategory = breakdownByDate.get(row.usageDate)!
    const prev = byCategory.get(category) ?? emptyCategoryBreakdown()
    byCategory.set(category, {
      amount: prev.amount + row.amount,
      voucherAmount: prev.voucherAmount + row.voucherAmount,
      balanceAmount: prev.balanceAmount + row.balanceAmount,
    })
  }

  const sortedDates = [...breakdownByDate.keys()].sort()

  const chartData: ChartRow[] = sortedDates.map((usageDate) => {
    const byCategory = breakdownByDate.get(usageDate)!
    const point = {
      usageDate,
      dateLabel: usageDate.slice(5),
    } as ChartRow
    for (const key of TREND_CATEGORY_KEYS) {
      point[key] = byCategory.get(key)?.amount ?? 0
    }
    return point
  })

  return {
    chartData,
    trendCategories: [...TREND_CATEGORY_KEYS],
    breakdownByDate,
  }
}

function ConsumptionTrendTooltip({
  active,
  payload,
  label,
  breakdownByDate,
  trendCategories,
}: TooltipProps<number, string> & {
  breakdownByDate: Map<string, Map<TrendCategoryKey, CategoryBreakdown>>
  trendCategories: TrendCategoryKey[]
}) {
  if (!active || !payload?.length) return null

  const usageDate =
    (payload[0]?.payload as ChartRow | undefined)?.usageDate ??
    (typeof label === 'string' && label.includes('-') ? label : null)

  if (!usageDate) return null

  const byCategory = breakdownByDate.get(usageDate)
  if (!byCategory) return null

  const displayDate = new Date(`${usageDate}T00:00:00`).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  })

  let dayTotal = 0
  let dayVoucher = 0
  let dayBalance = 0

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md text-xs min-w-[200px]">
      <p className="font-medium mb-2">{displayDate}</p>
      <div className="space-y-2">
        {trendCategories.map((category) => {
          const b = byCategory.get(category)
          if (!b || b.amount === 0) return null
          dayTotal += b.amount
          dayVoucher += b.voucherAmount
          dayBalance += b.balanceAmount
          const colorIndex = trendCategories.indexOf(category) % LINE_COLORS.length
          return (
            <div key={category} className="border-t border-border/60 pt-1.5 first:border-0 first:pt-0">
              <p className="font-medium flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: LINE_COLORS[colorIndex] }}
                />
                {trendCategoryLabel(category)}
              </p>
              <p className="text-muted-foreground mt-0.5">总消费 {formatMoney(b.amount)}</p>
              <p className="text-muted-foreground">算力券 {formatMoney(b.voucherAmount)}</p>
              <p className="text-muted-foreground">余额消费 {formatMoney(b.balanceAmount)}</p>
            </div>
          )
        })}
      </div>
      {trendCategories.length > 1 && dayTotal > 0 ? (
        <div className="mt-2 pt-2 border-t border-border font-medium">
          <p>当日合计 {formatMoney(dayTotal)}</p>
          <p className="text-muted-foreground font-normal">券 {formatMoney(dayVoucher)} · 余额{' '}
            {formatMoney(dayBalance)}
          </p>
        </div>
      ) : null}
    </div>
  )
}

interface ProjectConsumptionTrendChartProps {
  projectId: string
}

export function ProjectConsumptionTrendChart({ projectId }: ProjectConsumptionTrendChartProps) {
  const [usageMonth, setUsageMonth] = useState(currentUsageMonth)

  const { data: allRows = [], isLoading } = trpc.crm.projects.listDailyConsumptions.useQuery({
    projectId,
  })

  const monthOptions = useMemo(() => {
    const months = new Set(allRows.map((r) => r.usageMonth))
    const current = currentUsageMonth()
    months.add(current)
    return [...months].sort((a, b) => b.localeCompare(a))
  }, [allRows])

  const monthRows = useMemo(
    () => allRows.filter((r) => r.usageMonth === usageMonth),
    [allRows, usageMonth],
  )

  const { chartData, trendCategories, breakdownByDate } = useMemo(
    () => buildTrendData(monthRows),
    [monthRows],
  )

  const monthTotal = useMemo(
    () =>
      chartData.reduce(
        (acc, row) => ({
          amount: acc.amount + TREND_CATEGORY_KEYS.reduce((sum, key) => sum + row[key], 0),
          voucher: acc.voucher,
          balance: acc.balance,
        }),
        { amount: 0, voucher: 0, balance: 0 },
      ),
    [chartData],
  )

  const hasTrendData = useMemo(
    () => chartData.some((row) => TREND_CATEGORY_KEYS.some((key) => row[key] > 0)),
    [chartData],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">消费趋势</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            按天展示弹性服务、云主机、Job、存储消费
            {monthTotal.amount > 0
              ? ` · ${usageMonth} 合计 ${formatMoney(monthTotal.amount)}`
              : ''}
          </p>
        </div>
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
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full min-w-0">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              加载中…
            </div>
          ) : chartData.length === 0 || !hasTrendData ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center px-4">
              该月暂无消费数据，请同步租户账单或选择其他月份
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                {trendCategories.map((category, i) => {
                  const color = LINE_COLORS[i % LINE_COLORS.length]!
                  const id = safeGradientId(category)
                  return (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  )
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis
                dataKey="dateLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                width={48}
              />
              <Tooltip
                content={
                  <ConsumptionTrendTooltip
                    breakdownByDate={breakdownByDate}
                    trendCategories={trendCategories}
                  />
                }
              />
              <Legend
                formatter={(value) => trendCategoryLabel(String(value))}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              {trendCategories.map((category, i) => {
                const color = LINE_COLORS[i % LINE_COLORS.length]!
                return (
                  <Area
                    key={category}
                    type="monotone"
                    dataKey={category}
                    name={category}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${safeGradientId(category)})`}
                    fillOpacity={1}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )
              })}
            </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
