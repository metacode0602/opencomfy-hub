"use client"

import {
  COST_TAX_DIVISOR,
  formatSignedAdjustmentMoney,
  sumAdjustmentAmountsFromHistories,
} from "@/lib/finance/cost-row-utils"
import { parseMoney } from "@/lib/finance/income-row-utils"
import { groupCostByStaff } from "@/lib/finance/cost-group-utils"
import type {
  PlatformCostMonthly,
  VoucherCardHoursAdjustmentHistoryEntry,
} from "@/lib/types/finance"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, ChevronRight, Info } from "lucide-react"
import * as React from "react"
import { formatMoney, formatText } from "../../../_lib/display"

type GrossProfitDetailState = {
  row: PlatformCostMonthly
  adjustmentAmount: number
}

function rowDetailLabel(row: PlatformCostMonthly): string {
  if (row.type === "sum" && !row.staff_id) {
    return "账期合计"
  }
  if (row.type === "sum") {
    return `客户经理汇总 · ${formatText(row.staff_name ?? row.account_manager)}`
  }
  return `${formatText(row.idc_name)} · ${formatText(row.card_type)}`
}

function GrossProfitDetailDialog({
  detail,
  onClose,
}: {
  detail: GrossProfitDetailState | null
  onClose: () => void
}) {
  const row = detail?.row
  const balanceConsumption = row ? parseMoney(row.balance_consumption) : 0
  const confirmed = row ? parseMoney(row.confirmed_revenue_excl_tax) : 0
  const sold = row ? parseMoney(row.sold_duration_cost_excl_tax) : 0
  const gifted = row ? parseMoney(row.gifted_duration_cost_excl_tax) : 0
  const gross = row ? parseMoney(row.gross_profit) : 0
  const computedGross = confirmed - sold - gifted
  const adjustmentAmount = detail?.adjustmentAmount ?? 0
  const balanceBeforeAdjustment = balanceConsumption - adjustmentAmount

  return (
    <Dialog open={detail != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>毛利计算明细</DialogTitle>
          <DialogDescription>
            {row ? rowDetailLabel(row) : ""}
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border bg-muted/40 p-3 space-y-1">
              <p className="font-medium">计算公式</p>
              <p className="text-muted-foreground">
                余额卡时调账金额 = Σ(调账值 × 单价)，调账值为正则加、为负则减
              </p>
              <p className="text-muted-foreground">
                余额消费 = 调账前余额消费 + 余额卡时调账金额
              </p>
              <p className="text-muted-foreground">
                确认收入（不含税）= 余额消费 ÷ {COST_TAX_DIVISOR}
              </p>
              <p className="text-muted-foreground">
                毛利 = 确认收入（不含税）− 售出时长成本（不含税）− 赠送时长成本（不含税）
              </p>
            </div>
            <div className="rounded-md border divide-y">
              {adjustmentAmount !== 0 && (
                <>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-muted-foreground">调账前余额消费</span>
                    <span className="tabular-nums font-medium">
                      {formatMoney(String(balanceBeforeAdjustment))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-muted-foreground">余额卡时调账</span>
                    <span
                      className={cn(
                        "tabular-nums font-medium",
                        adjustmentAmount > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive",
                      )}
                    >
                      {formatSignedAdjustmentMoney(adjustmentAmount)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-muted-foreground">余额消费</span>
                <span className="text-right">
                  {adjustmentAmount !== 0 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatMoney(String(balanceBeforeAdjustment))}{" "}
                      {formatSignedAdjustmentMoney(adjustmentAmount)}
                    </span>
                  )}
                  <span className="tabular-nums font-medium">
                    {adjustmentAmount !== 0 ? "= " : ""}
                    {formatMoney(row.balance_consumption)}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-muted-foreground">
                  确认收入（不含税）
                </span>
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {formatMoney(row.balance_consumption)} ÷ {COST_TAX_DIVISOR}
                  </span>
                  <span className="tabular-nums font-medium">
                    = {formatMoney(row.confirmed_revenue_excl_tax)}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-muted-foreground">
                  售出时长成本（不含税）
                </span>
                <span className="tabular-nums font-medium">
                  −{formatMoney(row.sold_duration_cost_excl_tax)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-muted-foreground">
                  赠送时长成本（不含税）
                </span>
                <span className="tabular-nums font-medium">
                  −{formatMoney(row.gifted_duration_cost_excl_tax)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/30">
                <span className="font-medium">毛利</span>
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {formatMoney(row.confirmed_revenue_excl_tax)} −{" "}
                    {formatMoney(row.sold_duration_cost_excl_tax)} −{" "}
                    {formatMoney(row.gifted_duration_cost_excl_tax)}
                  </span>
                  <span className="tabular-nums font-semibold">
                    = {formatMoney(row.gross_profit)}
                  </span>
                </span>
              </div>
            </div>
            {Math.abs(computedGross - gross) > 0.01 && (
              <p className="text-xs text-muted-foreground">
                验算：{formatMoney(String(computedGross))}（与展示值存在四舍五入差异）
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CostRowCells({
  r,
  editable,
  onVoucherAdjust,
  voucherAdjustmentHistoryCount,
  adjustmentAmountTotal,
  onGrossProfitDetail,
}: {
  r: PlatformCostMonthly
  editable?: boolean
  onVoucherAdjust?: (row: PlatformCostMonthly) => void
  voucherAdjustmentHistoryCount?: (costId: string) => number
  adjustmentAmountTotal?: number
  onGrossProfitDetail?: (
    row: PlatformCostMonthly,
    adjustmentAmount: number,
  ) => void
}) {
  const accountManagerLabel =
    r.type === "sum" && !r.staff_id
      ? "合计"
      : formatText(r.staff_name ?? r.account_manager)

  return (
    <>
      <TableCell>{accountManagerLabel}</TableCell>
      <TableCell className="font-mono text-xs">
        {formatText(r.supplier_unit_cost_id)}
      </TableCell>
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
        <div className="inline-flex items-center justify-end gap-0.5">
          <span>{formatMoney(r.gross_profit)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="查看毛利计算公式"
            onClick={() =>
              onGrossProfitDetail?.(r, adjustmentAmountTotal ?? 0)
            }
          >
            <Info className="size-3.5" />
          </Button>
        </div>
      </TableCell>
      {editable && (
        <TableCell className="text-right">
          {r.type === "record" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onVoucherAdjust?.(r)}
            >
              余额卡时调账
              {(voucherAdjustmentHistoryCount?.(r.id) ?? 0) > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({voucherAdjustmentHistoryCount!(r.id)})
                </span>
              )}
            </Button>
          ) : adjustmentAmountTotal != null && adjustmentAmountTotal !== 0 ? (
            <span className="text-xs tabular-nums">
              调账合计 {formatSignedAdjustmentMoney(adjustmentAmountTotal)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
    </>
  )
}

const BASE_COL_COUNT = 14

type CostGroupedTableProps = {
  rows: PlatformCostMonthly[]
  editable?: boolean
  onVoucherAdjust?: (row: PlatformCostMonthly) => void
  voucherAdjustmentHistoryCount?: (costId: string) => number
  adjustmentHistories?: Record<string, VoucherCardHoursAdjustmentHistoryEntry[]>
}

export function CostGroupedTable({
  rows,
  editable = false,
  onVoucherAdjust,
  voucherAdjustmentHistoryCount,
  adjustmentHistories = {},
}: CostGroupedTableProps) {
  const colCount = BASE_COL_COUNT + (editable ? 1 : 0)
  const { staffGroups: groups, periodSumRow } = React.useMemo(
    () => groupCostByStaff(rows),
    [rows],
  )
  const adjustmentAmountByStaff = React.useMemo(() => {
    const byStaff = new Map<string, number>()
    let periodTotal = 0
    for (const r of rows) {
      if (r.type !== "record") continue
      const amount = sumAdjustmentAmountsFromHistories(
        adjustmentHistories[r.id] ?? [],
      )
      if (amount === 0) continue
      periodTotal += amount
      if (r.staff_id) {
        byStaff.set(r.staff_id, (byStaff.get(r.staff_id) ?? 0) + amount)
      }
    }
    return { byStaff, periodTotal }
  }, [rows, adjustmentHistories])
  const [openStaff, setOpenStaff] = React.useState<Set<string>>(() => new Set())
  const [grossProfitDetail, setGrossProfitDetail] =
    React.useState<GrossProfitDetailState | null>(null)

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
                colSpan={colCount}
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

  const openGrossProfitDetail = React.useCallback(
    (row: PlatformCostMonthly, adjustmentAmount: number) => {
      setGrossProfitDetail({ row, adjustmentAmount })
    },
    [],
  )

  return (
    <>
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 p-2" aria-label="展开分项" />
            <TableHead className="whitespace-nowrap">客户经理</TableHead>
            <TableHead className="whitespace-nowrap">成本单价版本</TableHead>
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
            {editable && (
              <TableHead className="whitespace-nowrap text-right">操作</TableHead>
            )}
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
                    <CostRowCells
                      r={parentRow}
                      editable={editable}
                      onVoucherAdjust={onVoucherAdjust}
                      voucherAdjustmentHistoryCount={
                        voucherAdjustmentHistoryCount
                      }
                      adjustmentAmountTotal={
                        adjustmentAmountByStaff.byStaff.get(g.staffId) ?? 0
                      }
                      onGrossProfitDetail={openGrossProfitDetail}
                    />
                  ) : (
                    <>
                      <TableCell className="font-medium">
                        {g.accountManager}
                      </TableCell>
                      <TableCell
                        colSpan={BASE_COL_COUNT - 2 + (editable ? 1 : 0)}
                        className="text-muted-foreground text-sm"
                      >
                        无汇总行，共 {g.recordRows.length} 条分项
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
                      <CostRowCells
                        r={r}
                        editable={editable}
                        onVoucherAdjust={onVoucherAdjust}
                        voucherAdjustmentHistoryCount={
                          voucherAdjustmentHistoryCount
                        }
                        adjustmentAmountTotal={sumAdjustmentAmountsFromHistories(
                          adjustmentHistories[r.id] ?? [],
                        )}
                        onGrossProfitDetail={openGrossProfitDetail}
                      />
                    </TableRow>
                  ))}
              </React.Fragment>
            )
          })}
          {periodSumRow && (
            <TableRow className="bg-muted/50 font-medium">
              <TableCell className="p-1" />
              <CostRowCells
                r={periodSumRow}
                editable={editable}
                adjustmentAmountTotal={adjustmentAmountByStaff.periodTotal}
                onGrossProfitDetail={openGrossProfitDetail}
              />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
    <GrossProfitDetailDialog
      detail={grossProfitDetail}
      onClose={() => setGrossProfitDetail(null)}
    />
    </>
  )
}
