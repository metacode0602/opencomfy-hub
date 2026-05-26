"use client"

import type { PlatformIncomeMonthly } from "@/lib/types/finance"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
  editable?: boolean
  onSupplementary?: (row: PlatformIncomeMonthly) => void
  onAdjust?: (row: PlatformIncomeMonthly) => void
  supplementaryHistoryCount?: (incomeId: string) => number
  adjustmentHistoryCount?: (incomeId: string) => number
}

export function IncomeDetailTable({
  rows,
  showPeriodColumn = true,
  editable = false,
  onSupplementary,
  onAdjust,
  supplementaryHistoryCount,
  adjustmentHistoryCount,
}: IncomeDetailTableProps) {
  const colSpan = (showPeriodColumn ? 8 : 7) + (editable ? 1 : 0)

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
            {editable && (
              <TableHead className="whitespace-nowrap text-right">操作</TableHead>
            )}
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
                <TableCell className="max-w-[240px]">
                  <div>{formatText(r.customer_full_name)}</div>
                  <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                    租户 {r.tenant_platform_id}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {formatMoney(r.supplementary_consumption)}
                    {(supplementaryHistoryCount?.(r.id) ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {supplementaryHistoryCount!(r.id)} 次
                      </Badge>
                    )}
                  </span>
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
                {editable && (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onSupplementary?.(r)}
                      >
                        补充消费
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onAdjust?.(r)}
                      >
                        调账
                        {(adjustmentHistoryCount?.(r.id) ?? 0) > 0 && (
                          <span className="ml-1 text-muted-foreground">
                            ({adjustmentHistoryCount!(r.id)})
                          </span>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
