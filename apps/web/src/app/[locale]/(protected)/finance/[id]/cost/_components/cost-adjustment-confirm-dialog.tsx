"use client"

import { formatMoney } from "@/app/[locale]/(protected)/finance/_lib/display"
import {
  collectCostAdjustmentRows,
  downloadCostAdjustmentExcel,
} from "@/lib/finance/cost-adjustment-export"
import {
  computeAdjustmentAmountFromHistoryEntry,
  formatSignedAdjustmentMoney,
} from "@/lib/finance/cost-row-utils"
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
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Download } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"

type CostAdjustmentConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: PlatformCostMonthly[]
  adjustmentHistories: Record<string, VoucherCardHoursAdjustmentHistoryEntry[]>
  periodCode: string
  onConfirm: () => void
}

const FRACTION_DIGITS = 4

function formatHours(value: string | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: FRACTION_DIGITS,
    maximumFractionDigits: FRACTION_DIGITS,
  })
}

function formatAdjustmentHoursLabel(value: string): string {
  const adj = Number(value)
  if (Number.isNaN(adj)) return value
  const formatted = adj.toLocaleString("zh-CN", {
    minimumFractionDigits: FRACTION_DIGITS,
    maximumFractionDigits: FRACTION_DIGITS,
  })
  return `${adj >= 0 ? "+" : ""}${formatted}`
}

export function CostAdjustmentConfirmDialog({
  open,
  onOpenChange,
  rows,
  adjustmentHistories,
  periodCode,
  onConfirm,
}: CostAdjustmentConfirmDialogProps) {
  const flatRows = useMemo(
    () => collectCostAdjustmentRows(rows, adjustmentHistories),
    [rows, adjustmentHistories],
  )

  function handleDownloadExcel() {
    const ok = downloadCostAdjustmentExcel({
      rows,
      adjustmentHistories,
      periodCode,
    })
    if (ok) {
      toast.success("调账记录 Excel 已下载")
    } else {
      toast.error("暂无调账记录可导出")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[50vw] max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>确认重新生成 · 存在调账记录</DialogTitle>
          <DialogDescription>
            本账期共有 {flatRows.length}{" "}
            条余额卡时调账记录。重新生成成本后将一并删除且不可恢复，建议先下载备份。
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleDownloadExcel}
          >
            <Download className="size-4" />
            下载调账记录 Excel
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">时间</TableHead>
                <TableHead className="whitespace-nowrap">客户经理</TableHead>
                <TableHead className="whitespace-nowrap">机房</TableHead>
                <TableHead className="whitespace-nowrap">卡型</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  调账值
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  调账金额
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  余额卡时（原→新）
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  售出成本（原→新）
                </TableHead>
                <TableHead>调账原因</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatRows.map(({ costRow, history }) => {
                const adjAmount =
                  computeAdjustmentAmountFromHistoryEntry(history)
                return (
                  <TableRow key={history.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {history.created_at.slice(0, 19).replace("T", " ")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {costRow.account_manager ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {costRow.idc_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {costRow.card_type ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatAdjustmentHoursLabel(history.adjustment_hours)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatSignedAdjustmentMoney(adjAmount, FRACTION_DIGITS)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatHours(history.balance_card_hours_before)} →{" "}
                      {formatHours(history.balance_card_hours_after)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatMoney(
                        history.sold_duration_cost_excl_tax_before,
                        FRACTION_DIGITS,
                      )}{" "}
                      →{" "}
                      {formatMoney(
                        history.sold_duration_cost_excl_tax_after,
                        FRACTION_DIGITS,
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {history.reason}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            确认删除调账并继续重新生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
