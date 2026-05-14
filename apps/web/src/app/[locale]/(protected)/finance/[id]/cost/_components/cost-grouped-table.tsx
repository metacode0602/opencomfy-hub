"use client"

import type { PlatformCostMonthly } from "@/lib/types/finance"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, ChevronRight } from "lucide-react"
import * as React from "react"
import { formatDate, formatMoney, formatText } from "../../../_lib/display"

type StaffCostGroup = {
  staffId: string
  accountManager: string
  sumRow: PlatformCostMonthly | null
  recordRows: PlatformCostMonthly[]
}

function groupCostByStaff(rows: PlatformCostMonthly[]): StaffCostGroup[] {
  const map = new Map<
    string,
    { sum: PlatformCostMonthly | null; records: PlatformCostMonthly[] }
  >()

  for (const r of rows) {
    let g = map.get(r.staff_id)
    if (!g) {
      g = { sum: null, records: [] }
      map.set(r.staff_id, g)
    }
    if (r.type === "sum") g.sum = r
    else g.records.push(r)
  }

  const groups: StaffCostGroup[] = []
  for (const [staffId, g] of map) {
    if (!g.sum && g.records.length === 0) continue
    const accountManager =
      g.sum?.account_manager ?? g.records[0]?.account_manager ?? ""
    groups.push({
      staffId,
      accountManager,
      sumRow: g.sum,
      recordRows: [...g.records].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    })
  }

  return groups.sort((a, b) =>
    a.accountManager.localeCompare(b.accountManager, "zh-CN"),
  )
}

function CostRowCells({ r }: { r: PlatformCostMonthly }) {
  return (
    <>
      <TableCell className="font-mono text-xs">{r.billing_period_id}</TableCell>
      <TableCell className="font-mono text-xs">
        {formatText(r.supplier_unit_cost_id)}
      </TableCell>
      <TableCell>{r.account_manager}</TableCell>
      <TableCell>{formatText(r.idc_name)}</TableCell>
      <TableCell>{formatText(r.idc_code)}</TableCell>
      <TableCell>{formatText(r.card_type)}</TableCell>
      <TableCell>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium",
            r.type === "sum"
              ? "bg-primary/15 text-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {r.type === "sum" ? "汇总" : "分项"}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(r.balance_consumption)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(r.balance_card_hours)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(r.voucher_card_hours)}
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
      <TableCell className="whitespace-nowrap text-xs tabular-nums">
        {formatDate(r.created_at)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs tabular-nums">
        {formatDate(r.updated_at)}
      </TableCell>
    </>
  )
}

const COL_COUNT = 17

export function CostGroupedTable({ rows }: { rows: PlatformCostMonthly[] }) {
  const groups = React.useMemo(() => groupCostByStaff(rows), [rows])
  const [openStaff, setOpenStaff] = React.useState<Set<string>>(() => new Set())

  const toggle = (staffId: string) => {
    setOpenStaff((prev) => {
      const next = new Set(prev)
      if (next.has(staffId)) next.delete(staffId)
      else next.add(staffId)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={COL_COUNT}
                className="text-center text-muted-foreground"
              >
                本期暂无成本明细
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 p-2" aria-label="展开分项" />
            <TableHead className="whitespace-nowrap">账期</TableHead>
            <TableHead className="whitespace-nowrap">成本单价版本</TableHead>
            <TableHead className="whitespace-nowrap">客户经理</TableHead>
            <TableHead className="whitespace-nowrap">机房名称</TableHead>
            <TableHead className="whitespace-nowrap">机房编码</TableHead>
            <TableHead className="whitespace-nowrap">卡型</TableHead>
            <TableHead className="whitespace-nowrap">行类型</TableHead>
            <TableHead className="whitespace-nowrap text-right">余额消费</TableHead>
            <TableHead className="whitespace-nowrap text-right">余额卡时</TableHead>
            <TableHead className="whitespace-nowrap text-right">券卡时</TableHead>
            <TableHead className="whitespace-nowrap text-right">
              确认收入（不含税）
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">
              售出时长成本（不含税）
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">
              赠送时长成本（不含税）
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">毛利</TableHead>
            <TableHead className="whitespace-nowrap">创建时间</TableHead>
            <TableHead className="whitespace-nowrap">更新时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => {
            const expanded = openStaff.has(g.staffId)
            const hasRecords = g.recordRows.length > 0
            const parentRow = g.sumRow

            return (
              <React.Fragment key={g.staffId}>
                <TableRow className="bg-card">
                  <TableCell className="p-1 align-middle">
                    {hasRecords ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-expanded={expanded}
                        aria-label={expanded ? "收起分项" : "展开分项"}
                        onClick={() => toggle(g.staffId)}
                      >
                        {expanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </Button>
                    ) : (
                      <span className="inline-flex size-8 items-center justify-center text-muted-foreground">
                        ·
                      </span>
                    )}
                  </TableCell>
                  {parentRow ? (
                    <CostRowCells r={parentRow} />
                  ) : (
                    <>
                      <TableCell colSpan={16} className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {g.accountManager}
                        </span>
                        <span className="ml-2 text-sm">
                          （无汇总行，共 {g.recordRows.length} 条分项）
                        </span>
                      </TableCell>
                    </>
                  )}
                </TableRow>

                {expanded &&
                  hasRecords &&
                  g.recordRows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="border-l-2 border-l-primary/40 bg-muted/30"
                    >
                      <TableCell />
                      <CostRowCells r={r} />
                    </TableRow>
                  ))}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
