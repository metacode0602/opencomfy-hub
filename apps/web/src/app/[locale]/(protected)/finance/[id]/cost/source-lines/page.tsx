"use client"

import { formatMoney, formatText } from "../../../_lib/display"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
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
import { cn } from "@workspace/ui/lib/utils"
import { useParams } from "next/navigation"
import { useMemo } from "react"

const kindLabels: Record<string, string> = {
  flex: "弹性",
  baremetal: "裸金属",
}

export default function FinanceCostSourceLinesPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data: period } = trpc.finance.periods.getById.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  )

  const { data: rows = [], isLoading } = trpc.finance.periods.listCostSourceLines.useQuery(
    { billingPeriodId: id ?? "" },
    { enabled: Boolean(id) },
  )

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const staffCmp = (a.staff_name ?? "").localeCompare(b.staff_name ?? "", "zh-CN")
        if (staffCmp !== 0) return staffCmp
        const tenantCmp = (a.tenant_name ?? a.tenant_platform_id).localeCompare(
          b.tenant_name ?? b.tenant_platform_id,
          "zh-CN",
        )
        if (tenantCmp !== 0) return tenantCmp
        return a.id.localeCompare(b.id)
      }),
    [rows],
  )

  if (!id) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">无效账期 ID</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">加载中…</p>
      </div>
    )
  }

  return (
    <div className="bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/cost`}>← 成本毛利</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href="/finance">账期列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/cost/tenant-bindings`}>租户项目映射</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            成本中间表 · {period?.period_code ?? id}
          </CardTitle>
          <CardDescription>
            billing_period_cost_source_line（{sortedRows.length} 行）
            {period
              ? ` · 账期 ${period.period_start} ~ ${period.period_end}`
              : null}
            · 用于校验租户消费、卡时、机房卡型与价格分成是否正确
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              暂无中间表数据。请先在账期创建页完成成本计算。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-24">来源</TableHead>
                    <TableHead className="min-w-28">租户 ID</TableHead>
                    <TableHead className="min-w-28">平台租户 ID</TableHead>
                    <TableHead className="min-w-32">租户名称</TableHead>
                    <TableHead className="min-w-28 text-right">总消费</TableHead>
                    <TableHead className="min-w-28 text-right">券消费</TableHead>
                    <TableHead className="min-w-28 text-right">余额消费</TableHead>
                    <TableHead className="min-w-24 text-right">总卡时</TableHead>
                    <TableHead className="min-w-24 text-right">券卡时</TableHead>
                    <TableHead className="min-w-24 text-right">余额卡时</TableHead>
                    <TableHead className="min-w-24">GPU 卡型</TableHead>
                    <TableHead className="min-w-24">区域</TableHead>
                    <TableHead className="min-w-32">机房名称</TableHead>
                    <TableHead className="min-w-40">价格/分成</TableHead>
                    <TableHead className="min-w-28">客户经理</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs font-medium",
                            r.kind === "flex"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {kindLabels[r.kind] ?? r.kind}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatText(r.tenant_id)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatText(r.tenant_platform_id)}
                      </TableCell>
                      <TableCell>{formatText(r.tenant_name)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.total_consumption)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.voucher_consumption)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.balance_consumption)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.total_card_hours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.voucher_card_hours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.balance_card_hours)}
                      </TableCell>
                      <TableCell>{formatText(r.gpu_card_type_name)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatText(r.region)}
                      </TableCell>
                      <TableCell>{formatText(r.data_center_name)}</TableCell>
                      <TableCell className="text-xs">
                        {formatText(r.pricing_label)}
                      </TableCell>
                      <TableCell>{formatText(r.staff_name)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
