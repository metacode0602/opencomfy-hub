"use client"

import type { DemoCostSummaryRow } from "./mock-data"
import { formatMoney, formatText } from "../../../_lib/display"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export function DemoCostSummaryTable({ rows }: { rows: DemoCostSummaryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        暂无成本数据，请先完成「计算成本」。
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>客户经理</TableHead>
            <TableHead>机房</TableHead>
            <TableHead>卡型</TableHead>
            <TableHead className="text-right">余额消费</TableHead>
            <TableHead className="text-right">余额卡时</TableHead>
            <TableHead className="text-right">券卡时</TableHead>
            <TableHead className="text-right">确认收入(不含税)</TableHead>
            <TableHead className="text-right">售出时长成本(不含税)</TableHead>
            <TableHead className="text-right">赠送时长成本(不含税)</TableHead>
            <TableHead className="text-right">毛利</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatText(r.staff_name)}</TableCell>
              <TableCell>{formatText(r.idc_name)}</TableCell>
              <TableCell>{formatText(r.card_type)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(r.balance_consumption)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatText(r.balance_card_hours)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatText(r.voucher_card_hours)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(r.confirmed_revenue_excl_tax)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(r.sold_duration_cost_excl_tax)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(r.gifted_duration_cost_excl_tax)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(r.gross_profit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
