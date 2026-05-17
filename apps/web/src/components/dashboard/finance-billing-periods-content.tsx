'use client'

import { useMemo, useState } from 'react'
import { Calendar, Plus, Receipt, Search, TrendingUp } from 'lucide-react'
import { mockBillingPeriods } from '@/lib/data/finance-mock'
import { LocaleLink } from '@/lib/i18n/navigation'
import { formatMoney } from '@/app/[locale]/(protected)/finance/_lib/display'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

function sumDecimal(values: string[]): number {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0)
}

export function FinanceBillingPeriodsContent() {
  const [search, setSearch] = useState('')

  const filteredPeriods = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mockBillingPeriods
    return mockBillingPeriods.filter(
      (p) =>
        p.period_code.toLowerCase().includes(q) ||
        p.period_start.includes(q) ||
        p.period_end.includes(q),
    )
  }, [search])

  const periodCount = mockBillingPeriods.length
  const totalIncome = sumDecimal(mockBillingPeriods.map((p) => p.total_income))
  const totalGrossProfit = sumDecimal(
    mockBillingPeriods.map(
      (p) => String((Number(p.total_income) || 0) - (Number(p.total_cost) || 0)),
    ),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账期管理</h1>
          <p className="text-muted-foreground">
            管理全部账期，按账期查看收入明细与成本毛利明细
          </p>
        </div>
        <Button asChild>
          <LocaleLink href="/finance/create">
            <Plus className="w-4 h-4 mr-2" />
            添加账期
          </LocaleLink>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">账期总数</p>
                <p className="text-2xl font-bold">{periodCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              平台已录入的全部 billing_period
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">累计总收入</p>
                <p className="text-2xl font-bold">¥{formatMoney(String(totalIncome))}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              各账期 total_income 合计
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">累计毛利</p>
                <p className="text-2xl font-bold">¥{formatMoney(String(totalGrossProfit))}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              总收入减总成本（各账期汇总）
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索账期编码、开始或结束日期..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing period list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账期编码</TableHead>
                <TableHead>账期开始</TableHead>
                <TableHead>账期结束</TableHead>
                <TableHead className="text-right">账期总收入</TableHead>
                <TableHead className="text-right">账期总成本</TableHead>
                <TableHead className="text-right">补充收入</TableHead>
                <TableHead className="text-right">余额收入</TableHead>
                <TableHead className="text-right">裸金属收入</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPeriods.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    未找到匹配的账期
                  </TableCell>
                </TableRow>
              ) : (
                filteredPeriods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.period_code}</TableCell>
                    <TableCell className="tabular-nums">{p.period_start}</TableCell>
                    <TableCell className="tabular-nums">{p.period_end}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.total_income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.total_cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.supplementary)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.balance_income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.baremetal_income)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/finance/${p.id}/income`}>
                            收入
                          </LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/finance/${p.id}/cost`}>
                            成本
                          </LocaleLink>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
