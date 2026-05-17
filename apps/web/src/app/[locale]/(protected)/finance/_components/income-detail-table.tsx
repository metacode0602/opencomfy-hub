"use client"

import type { PlatformIncomeMonthly } from "@/lib/types/finance"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { formatDate, formatMoney, formatText } from "../_lib/display"

type IncomeDetailTableProps = {
  rows: PlatformIncomeMonthly[]
  showPeriodColumn?: boolean
}

export function IncomeDetailTable({
  rows,
  showPeriodColumn = true,
}: IncomeDetailTableProps) {
  const colSpan = showPeriodColumn ? 8 : 7

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {showPeriodColumn && (
              <TableHead className="whitespace-nowrap">账期</TableHead>
            )}
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
                colSpan={colSpan}
                className="text-center text-muted-foreground"
              >
                本期暂无收入明细
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                {showPeriodColumn && (
                  <TableCell className="font-mono text-xs">
                    {r.billing_period_id}
                  </TableCell>
                )}
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
  )
}
