"use client"

import { mockBillingPeriods, mockPlatformCostMonthly, mockPlatformIncomeMonthly } from "@/lib/data/finance-mock"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useFinanceMockStore } from "@/lib/stores/finance-mock-store"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { IconPlus } from "@tabler/icons-react"
import { useMemo } from "react"
import { formatDate, formatMoney, formatText } from "../_lib/display"

export function FinanceOverview() {
  const bundles = useFinanceMockStore((s) => s.bundles)

  const periods = useMemo(
    () => [
      ...mockBillingPeriods,
      ...bundles.map((b) => b.period),
    ],
    [bundles],
  )

  const incomeRows = useMemo(
    () => [
      ...mockPlatformIncomeMonthly,
      ...bundles.flatMap((b) => b.income),
    ],
    [bundles],
  )

  const costRows = useMemo(
    () => [
      ...mockPlatformCostMonthly,
      ...bundles.flatMap((b) => b.cost),
    ],
    [bundles],
  )

  return (
    <div className="space-y-6 bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>账期列表</CardTitle>
            <CardDescription>
              平台全部账期（含内置 mock 与本地「添加账期」生成的记录）；可按账期查看收入明细与成本毛利明细
            </CardDescription>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <LocaleLink href="/finance/create">
              <IconPlus className="size-4" />
              添加账期
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">账期编码</TableHead>
                  <TableHead className="whitespace-nowrap">账期开始</TableHead>
                  <TableHead className="whitespace-nowrap">账期结束</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    账期总收入
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    账期总成本
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    补充收入
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    余额收入
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    裸金属收入
                  </TableHead>
                  <TableHead className="w-[200px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>平台月度收入明细</CardTitle>
          <CardDescription>
            platform_income_monthly（合并内置数据与导入账期生成的 mock 行）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[min(480px,50vh)] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">账期 ID</TableHead>
                  <TableHead className="whitespace-nowrap">项目名称</TableHead>
                  <TableHead className="whitespace-nowrap">客户全称</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    补充消费
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    余额消费
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    裸金属消费
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    总消费
                  </TableHead>
                  <TableHead className="whitespace-nowrap">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      暂无收入明细
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {r.billing_period_id}
                      </TableCell>
                      <TableCell>{formatText(r.project_name)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {r.tenant_name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.supplementary_consumption)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.balance_consumption)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.bare_metal_consumption)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(r.total_consumption)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {formatDate(r.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>平台月度成本</CardTitle>
          <CardDescription>
            platform_cost_monthly（合并内置数据与导入账期生成的 mock 行）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[min(480px,50vh)] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">账期 ID</TableHead>
                  <TableHead className="whitespace-nowrap">类型</TableHead>
                  <TableHead className="whitespace-nowrap">机房</TableHead>
                  <TableHead className="whitespace-nowrap">卡型</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    余额消费
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    已售时长成本
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">毛利</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      暂无成本明细
                    </TableCell>
                  </TableRow>
                ) : (
                  costRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {r.billing_period_id}
                      </TableCell>
                      <TableCell>{r.type === "sum" ? "汇总" : "分项"}</TableCell>
                      <TableCell>{formatText(r.idc_name)}</TableCell>
                      <TableCell>{formatText(r.card_type)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.balance_consumption)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.sold_duration_cost_excl_tax)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.gross_profit)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
