"use client"

import { formatMoney } from "@/app/[locale]/(protected)/finance/_lib/display"
import {
  deriveCostFieldsAfterVoucherAdjustment,
  resolveUnitPricePerHour,
  validateHoursInput,
} from "@/lib/finance/cost-row-utils"
import { useFinanceCostOpsStore } from "@/lib/stores/finance-cost-ops-store"
import type { PlatformCostMonthly } from "@/lib/types/finance"
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
  displayRow: PlatformCostMonthly | null
  baseRow: PlatformCostMonthly | null
}

function parseHours(value: string | null | undefined): number {
  if (value == null || value === "") return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

function formatHours(value: string | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export function VoucherCardHoursAdjustmentDialog({
  open,
  onOpenChange,
  displayRow: row,
  baseRow,
}: VoucherCardHoursAdjustmentDialogProps) {
  const applyVoucherAdjustment = useFinanceCostOpsStore(
    (s) => s.applyVoucherCardHoursAdjustment,
  )
  const getHistory = useFinanceCostOpsStore((s) => s.getVoucherAdjustmentHistory)

  const [adjustmentHours, setAdjustmentHours] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setAdjustmentHours("")
    setReason("")
    setError(null)
  }, [open, row])

  const unitPrice = useMemo(
    () => (row ? resolveUnitPricePerHour(row) : null),
    [row],
  )

  const originalHours = row ? parseHours(row.voucher_card_hours) : 0
  const adjustmentNum = Number(adjustmentHours.trim() || "0")
  const finalHours = Math.max(0, originalHours - adjustmentNum)

  const preview = useMemo(() => {
    if (!row || unitPrice == null) return null
    if (Number.isNaN(adjustmentNum) || adjustmentHours.trim() === "") {
      return null
    }
    return deriveCostFieldsAfterVoucherAdjustment({
      row,
      adjustmentHours: adjustmentNum,
      unitPricePerHour: unitPrice,
    })
  }, [row, unitPrice, adjustmentNum, adjustmentHours])

  const history = row ? getHistory(row.id) : []

  function handleSubmit() {
    if (!row || !baseRow) return

    if (unitPrice == null) {
      setError("未找到该机房的卡型单价，无法调账")
      return
    }

    const hoursErr = validateHoursInput(adjustmentHours)
    if (hoursErr) {
      setError(hoursErr)
      return
    }

    const adj = Number(adjustmentHours.trim())
    if (adj === 0) {
      setError("调账卡时需大于 0")
      return
    }
    if (adj > originalHours) {
      setError(`调账卡时不能超过原券卡时（${formatHours(row.voucher_card_hours)}）`)
      return
    }

    if (!reason.trim()) {
      setError("请填写调账原因")
      return
    }

    applyVoucherAdjustment({
      baseRow,
      adjustmentHours: adj,
      reason,
      unitPricePerHour: unitPrice,
    })
    toast.success("券卡时调账已保存")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>券卡时调账</DialogTitle>
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
                    ? `¥${unitPrice.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/卡时`
                    : "未配置"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                赠送时长成本（不含税）= 单价 ×（原值 − 调账值）÷ 1.06；毛利 = 确认收入（不含税）−
                售出时长成本（不含税）− 赠送时长成本（不含税）
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">原值（券卡时）</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatHours(row.voucher_card_hours)}
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
                  placeholder="扣减卡时"
                />
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">最终值</p>
                <p className="text-lg font-semibold tabular-nums">
                  {adjustmentHours.trim() !== "" && !Number.isNaN(adjustmentNum)
                    ? formatHours(String(finalHours))
                    : formatHours(row.voucher_card_hours)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  赠送时长成本（不含税）
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {preview
                    ? formatMoney(preview.giftedDurationCostExclTax)
                    : formatMoney(row.gifted_duration_cost_excl_tax)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">毛利</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {preview
                    ? formatMoney(preview.grossProfit)
                    : formatMoney(row.gross_profit)}
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
                placeholder="说明本次券卡时调账原因"
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {row && history.length > 0 && (
          <div className="min-h-0 flex-1 space-y-2">
            <p className="text-sm font-medium">调账历史</p>
            <ScrollArea className="h-[min(220px,30vh)] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">时间</TableHead>
                    <TableHead className="text-right">券卡时（原→新）</TableHead>
                    <TableHead className="text-right">赠送成本（原→新）</TableHead>
                    <TableHead>原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...history].reverse().map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {h.created_at.slice(0, 19).replace("T", " ")}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatHours(h.voucher_card_hours_before)} →{" "}
                        {formatHours(h.voucher_card_hours_after)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatMoney(h.gifted_duration_cost_excl_tax_before)} →{" "}
                        {formatMoney(h.gifted_duration_cost_excl_tax_after)}
                      </TableCell>
                      <TableCell className="max-w-[120px] text-xs">
                        {h.reason}
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
          <Button onClick={handleSubmit} disabled={!row}>
            保存调账
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
