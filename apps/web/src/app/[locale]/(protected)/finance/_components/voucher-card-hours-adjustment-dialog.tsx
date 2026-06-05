"use client"

import { formatMoney } from "@/app/[locale]/(protected)/finance/_lib/display"
import {
  computeAdjustmentAmountFromHistoryEntry,
  computeBalanceAdjustmentAmount,
  deriveCostFieldsAfterBalanceAdjustment,
  formatSignedAdjustmentMoney,
  resolveUnitPricePerHour,
  validateSignedHoursInput,
} from "@/lib/finance/cost-row-utils"
import { parseMoney } from "@/lib/finance/income-row-utils"
import { trpc } from "@/lib/trpc/client"
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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type VoucherCardHoursAdjustmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: PlatformCostMonthly | null
  history: VoucherCardHoursAdjustmentHistoryEntry[]
  onSaved: () => void
}

function parseHours(value: string | null | undefined): number {
  if (value == null || value === "") return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
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

function formatAdjustmentHoursLabel(value: number | string): string {
  const adj = Number(value)
  if (Number.isNaN(adj)) return String(value)
  const formatted = adj.toLocaleString("zh-CN", {
    minimumFractionDigits: FRACTION_DIGITS,
    maximumFractionDigits: FRACTION_DIGITS,
  })
  return `${adj >= 0 ? "+" : ""}${formatted}`
}

export function VoucherCardHoursAdjustmentDialog({
  open,
  onOpenChange,
  row,
  history,
  onSaved,
}: VoucherCardHoursAdjustmentDialogProps) {
  const mutation = trpc.finance.periods.applyBalanceCardHoursAdjustment.useMutation({
    onSuccess: () => {
      toast.success("余额卡时调账已保存")
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const [adjustmentHours, setAdjustmentHours] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [historyDetail, setHistoryDetail] =
    useState<VoucherCardHoursAdjustmentHistoryEntry | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setAdjustmentHours("")
    setReason("")
    setError(null)
    setHistoryDetail(null)
  }, [open, row])

  const unitPrice = useMemo(
    () => (row ? resolveUnitPricePerHour(row) : null),
    [row],
  )

  const originalHours = row ? parseHours(row.balance_card_hours) : 0
  const adjustmentNum = Number(adjustmentHours.trim() || "0")
  const finalHours = Math.max(0, originalHours + adjustmentNum)

  const preview = useMemo(() => {
    if (!row || unitPrice == null) return null
    if (Number.isNaN(adjustmentNum) || adjustmentHours.trim() === "") {
      return null
    }
    return deriveCostFieldsAfterBalanceAdjustment({
      row,
      adjustmentHours: adjustmentNum,
      unitPricePerHour: unitPrice,
    })
  }, [row, unitPrice, adjustmentNum, adjustmentHours])

  function handleSubmit() {
    if (!row) return

    if (unitPrice == null) {
      setError("未找到该机房的卡型单价，无法调账")
      return
    }

    const hoursErr = validateSignedHoursInput(adjustmentHours)
    if (hoursErr) {
      setError(hoursErr)
      return
    }

    const adj = Number(adjustmentHours.trim())
    if (originalHours + adj < 0) {
      setError(
        `调账后余额卡时不能为负（原值 ${formatHours(row.balance_card_hours)}，调账值 ${formatAdjustmentHoursLabel(adj)}）`,
      )
      return
    }
    const adjustmentAmount = computeBalanceAdjustmentAmount(adj, unitPrice)
    if (parseMoney(row.balance_consumption) + adjustmentAmount < 0) {
      setError(
        `调账后余额消费不能为负（当前 ${formatMoney(row.balance_consumption, FRACTION_DIGITS)}，本次调账金额 ${formatSignedAdjustmentMoney(adjustmentAmount, FRACTION_DIGITS)}）`,
      )
      return
    }

    if (!reason.trim()) {
      setError("请填写调账原因")
      return
    }

    mutation.mutate({
      costId: row.id,
      adjustmentHours: adj,
      reason: reason.trim(),
      unitPricePerHour: unitPrice,
    })
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>余额卡时调账</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.account_manager} · ${row.idc_name ?? "—"} · ${row.card_type ?? "—"}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="grid shrink-0 gap-4 py-2">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">
                机房卡型单价（卡时/分成）
                <span className="ml-2 font-medium text-foreground tabular-nums">
                  {unitPrice != null
                    ? `¥${unitPrice.toLocaleString("zh-CN", { minimumFractionDigits: FRACTION_DIGITS, maximumFractionDigits: FRACTION_DIGITS })}/卡时`
                    : "未配置"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                调账金额 = 调账值 × 单价；余额消费 = 原余额消费 + 调账金额（调账值为正加、为负减）；售出时长成本
                = 单价 ×（原值 + 调账值）÷ 1.06；毛利 = 确认收入 − 售出时长成本 − 赠送时长成本
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">原值（余额卡时）</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatHours(row.balance_card_hours)}
                </p>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <Label htmlFor="voucher-adj-hours">调账值</Label>
                <Input
                  id="voucher-adj-hours"
                  type="text"
                  inputMode="decimal"
                  value={adjustmentHours}
                  onChange={(e) => {
                    setAdjustmentHours(e.target.value)
                    setError(null)
                  }}
                  placeholder="如 +10 或 -5"
                />
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">最终值</p>
                <p className="text-lg font-semibold tabular-nums">
                  {adjustmentHours.trim() !== "" && !Number.isNaN(adjustmentNum)
                    ? formatHours(String(finalHours))
                    : formatHours(row.balance_card_hours)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">余额消费</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {preview
                    ? formatMoney(preview.balanceConsumptionAfter, FRACTION_DIGITS)
                    : formatMoney(row.balance_consumption, FRACTION_DIGITS)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  售出时长成本（不含税）
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {preview
                    ? formatMoney(preview.soldDurationCostExclTax, FRACTION_DIGITS)
                    : formatMoney(row.sold_duration_cost_excl_tax, FRACTION_DIGITS)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">毛利</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {preview
                    ? formatMoney(preview.grossProfit, FRACTION_DIGITS)
                    : formatMoney(row.gross_profit, FRACTION_DIGITS)}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="voucher-adj-reason">调账原因</Label>
              <Textarea
                id="voucher-adj-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError(null)
                }}
                placeholder="说明本次余额卡时调账原因"
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {row && history.length > 0 && (
          <div className="min-h-0 flex-1 space-y-2">
            <p className="text-sm font-medium">
              调账历史
              <span className="ml-2 font-normal text-muted-foreground">
                点击行查看原因
              </span>
            </p>
            <ScrollArea className="h-[min(220px,30vh)] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">时间</TableHead>
                    <TableHead className="text-right">调账值</TableHead>
                    <TableHead className="text-right">余额卡时（原→新）</TableHead>
                    <TableHead className="text-right">售出成本（原→新）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...history].reverse().map((h) => (
                      <TableRow
                        key={h.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setHistoryDetail(h)}
                      >
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">
                          {h.created_at.slice(0, 19).replace("T", " ")}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatAdjustmentHoursLabel(h.adjustment_hours)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatHours(h.balance_card_hours_before)} →{" "}
                          {formatHours(h.balance_card_hours_after)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatMoney(
                            h.sold_duration_cost_excl_tax_before,
                            FRACTION_DIGITS,
                          )}{" "}
                          →{" "}
                          {formatMoney(
                            h.sold_duration_cost_excl_tax_after,
                            FRACTION_DIGITS,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!row || mutation.isPending}
          >
            {mutation.isPending ? "保存中…" : "保存调账"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={historyDetail != null}
      onOpenChange={(next) => {
        if (!next) setHistoryDetail(null)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>调账详情</DialogTitle>
          <DialogDescription>
            {historyDetail
              ? historyDetail.created_at.slice(0, 19).replace("T", " ")
              : ""}
          </DialogDescription>
        </DialogHeader>
        {historyDetail && (
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-3 gap-2 rounded-md border p-3">
              <div>
                <p className="text-xs text-muted-foreground">调账值</p>
                <p className="font-medium tabular-nums">
                  {formatAdjustmentHoursLabel(historyDetail.adjustment_hours)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">单价</p>
                <p className="font-medium tabular-nums">
                  ¥
                  {Number(historyDetail.unit_price_per_hour).toLocaleString(
                    "zh-CN",
                    {
                      minimumFractionDigits: FRACTION_DIGITS,
                      maximumFractionDigits: FRACTION_DIGITS,
                    },
                  )}
                  /卡时
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">调账金额</p>
                <p className="font-medium tabular-nums">
                  {formatMoney(
                    String(
                      computeAdjustmentAmountFromHistoryEntry(historyDetail),
                    ),
                    FRACTION_DIGITS,
                  )}
                </p>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">余额卡时</p>
              <p className="mt-1 tabular-nums">
                {formatHours(historyDetail.balance_card_hours_before)} →{" "}
                {formatHours(historyDetail.balance_card_hours_after)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">售出时长成本（不含税）</p>
              <p className="mt-1 tabular-nums">
                {formatMoney(
                  historyDetail.sold_duration_cost_excl_tax_before,
                  FRACTION_DIGITS,
                )}{" "}
                →{" "}
                {formatMoney(
                  historyDetail.sold_duration_cost_excl_tax_after,
                  FRACTION_DIGITS,
                )}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">毛利</p>
              <p className="mt-1 tabular-nums">
                {formatMoney(historyDetail.gross_profit_before, FRACTION_DIGITS)}{" "}
                →{" "}
                {formatMoney(historyDetail.gross_profit_after, FRACTION_DIGITS)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">调账原因</p>
              <p className="mt-1 whitespace-pre-wrap break-words">
                {historyDetail.reason}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setHistoryDetail(null)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
