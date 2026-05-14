"use client"

import { formatDate, formatMoney, formatText } from "../../_lib/display"
import { listIncomeForPeriod, resolveBillingPeriod } from "@/lib/finance/merge-finance-data"
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
import { useParams } from "next/navigation"
import { useMemo } from "react"

export default function FinancePeriodIncomePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const bundles = useFinanceMockStore((s) => s.bundles)

  const period = useMemo(
    () => (id ? resolveBillingPeriod(id, bundles) : undefined),
    [id, bundles],
  )
  const rows = useMemo(
    () => (id ? listIncomeForPeriod(id, bundles) : []),
    [id, bundles],
  )

  if (!id || !period) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
        <p className="text-muted-foreground">未找到该账期。</p>
        <Button variant="link" asChild className="mt-2 px-0">
          <LocaleLink href="/finance">返回账期列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href="/finance">← 账期列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/cost`}>查看成本</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>收入明细 · {period.period_code}</CardTitle>
          <CardDescription>
            platform_income_monthly（账期 {period.period_start} ~{" "}
            {period.period_end}）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">账期</TableHead>
                  <TableHead className="whitespace-nowrap">项目名称</TableHead>
                  <TableHead className="whitespace-nowrap">客户全称</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    补充消费金额
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    余额消费金额
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    线上裸金属消费金额
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    总消费金额
                  </TableHead>
                  <TableHead className="whitespace-nowrap">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      本期暂无收入明细
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.billing_period_id}
                      </TableCell>
                      <TableCell>{formatText(r.project_name)}</TableCell>
                      <TableCell className="max-w-[200px]">{r.tenant_name}</TableCell>
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
    </div>
  )
}
