'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LocaleLink } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import { MerchantDetailNav } from './merchant-detail-nav'
import { formatMoney } from './merchant-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { ChartContainer, type ChartConfig } from '@workspace/ui/components/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

const chartConfig = {
  amount: { label: '总消费', color: '#6366f1' },
  balanceAmount: { label: '实付', color: '#22c55e' },
} satisfies ChartConfig

export function MerchantConsumptionContent({ merchantId }: { merchantId: string }) {
  const merchantQuery = trpc.merchant.getById.useQuery({ id: merchantId })
  const summaryQuery = trpc.merchant.consumption.summary.useQuery({ merchantId })
  const dailyQuery = trpc.merchant.consumption.daily.useQuery({ merchantId, recentDays: 30 })
  const tenantRankQuery = trpc.merchant.consumption.tenantRank.useQuery({ merchantId })

  const summary = summaryQuery.data
  const daily = dailyQuery.data ?? []
  const tenantRank = tenantRankQuery.data ?? []

  const chartData = useMemo(
    () =>
      daily.map((d) => ({
        date: d.usageDate.slice(5),
        fullDate: d.usageDate,
        amount: d.amount,
        balanceAmount: d.balanceAmount,
      })),
    [daily],
  )

  if (merchantQuery.isLoading || summaryQuery.isLoading) {
    return <p className="text-muted-foreground py-8">加载中…</p>
  }

  const merchant = merchantQuery.data
  if (!merchant) {
    return <p className="text-muted-foreground">商户不存在</p>
  }

  if (summaryQuery.isError) {
    return (
      <p className="text-muted-foreground py-8">
        {summaryQuery.error.message || '加载消耗概览失败'}
      </p>
    )
  }

  if (!summary) {
    return <p className="text-muted-foreground py-8">暂无消耗数据</p>
  }

  const isDefaultMerchant = merchant.isDefault

  return (
    <div className="space-y-6">
      <MerchantDetailNav merchant={merchant} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="本月总消费" value={`¥${formatMoney(summary.monthAmount)}`} />
        <SummaryCard label="算力券消费" value={`¥${formatMoney(summary.monthVoucherAmount)}`} />
        <SummaryCard label="实付消费" value={`¥${formatMoney(summary.monthBalanceAmount)}`} />
        <SummaryCard label="关联租户" value={String(summary.activeTenantCount)} />
      </div>

      {!isDefaultMerchant && summary.compareGongjiAmount != null ? (
        <Card>
          <CardContent className="p-4 text-sm">
            <span className="text-muted-foreground">与默认商户同口径对比：</span>
            <span className="ml-2 font-medium tabular-nums">
              默认商户 ¥{formatMoney(summary.compareGongjiAmount)}
            </span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">本商户</span>
            <span className="ml-1 font-medium tabular-nums">
              ¥{formatMoney(summary.monthAmount)}
            </span>
            {summary.compareGongjiAmount > 0 ? (
              <span className="ml-2 text-muted-foreground">
                （约为默认商户的{' '}
                {((summary.monthAmount / summary.compareGongjiAmount) * 100).toFixed(1)}%）
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">近 30 日消耗趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">加载趋势数据…</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无近 30 日消耗数据</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  formatter={(value) => [`¥${formatMoney(Number(value))}`, '']}
                  labelFormatter={(_, payload) => {
                    const fullDate = payload?.[0]?.payload?.fullDate
                    return fullDate ? String(fullDate) : ''
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--color-amount)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="balanceAmount"
                  stroke="var(--color-balanceAmount)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">租户消耗排行</CardTitle>
        </CardHeader>
        {tenantRankQuery.isLoading ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            加载租户排行…
          </CardContent>
        ) : tenantRank.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            暂无关联租户或本月消耗数据
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租户</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>主绑定</TableHead>
                <TableHead className="text-right">本月消费</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantRank.map((row) => (
                <TableRow key={row.tenantId}>
                  <TableCell className="font-medium text-sm">{row.tenantName}</TableCell>
                  <TableCell className="text-sm">{row.customerName}</TableCell>
                  <TableCell className="text-sm">{row.isPrimary ? '是' : '否'}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    ¥{formatMoney(row.monthAmount)}
                  </TableCell>
                  <TableCell>
                    {row.customerId ? (
                      <LocaleLink
                        href={`/crm/customers/${row.customerId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        客户
                      </LocaleLink>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
