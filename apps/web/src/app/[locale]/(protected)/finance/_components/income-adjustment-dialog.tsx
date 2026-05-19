"use client"

import { formatMoney } from "@/app/[locale]/(protected)/finance/_lib/display"
import { toMoneyString, validateMoneyInput } from "@/lib/finance/income-row-utils"
import { useFinanceIncomeOpsStore } from "@/lib/stores/finance-income-ops-store"
import type { PlatformIncomeMonthly } from "@/lib/types/finance"
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
import { useEffect, useState } from "react"
import { toast } from "sonner"

type IncomeAdjustmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  displayRow: PlatformIncomeMonthly | null
  baseRow: PlatformIncomeMonthly | null
}

function formatOptionalMoney(value: string | null): string {
  return formatMoney(value)
}

export function IncomeAdjustmentDialog({
  open,
  onOpenChange,
  displayRow: row,
  baseRow,
}: IncomeAdjustmentDialogProps) {
  const applyIncomeAdjustment = useFinanceIncomeOpsStore(
    (s) => s.applyIncomeAdjustment,
  )
  const getHistory = useFinanceIncomeOpsStore((s) => s.getAdjustmentHistory)

  const [balanceAfter, setBalanceAfter] = useState("")
  const [bareMetalAfter, setBareMetalAfter] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setBalanceAfter(row.balance_consumption ?? "")
    setBareMetalAfter(row.bare_metal_consumption ?? "")
    setReason("")
    setError(null)
  }, [open, row])

  const history = row ? getHistory(row.id) : []

  function parseOptionalAmount(
    raw: string,
    label: string,
  ): { value: string | null; error: string | null } {
    const trimmed = raw.trim()
    if (trimmed === "") return { value: null, error: null }
    const err = validateMoneyInput(trimmed)
    if (err) return { value: null, error: `${label}：${err}` }
    return { value: toMoneyString(Number(trimmed)), error: null }
  }

  function handleSubmit() {
    if (!row) return

    const balanceParsed = parseOptionalAmount(balanceAfter, "余额消费")
    if (balanceParsed.error) {
      setError(balanceParsed.error)
      return
    }
    const bareParsed = parseOptionalAmount(bareMetalAfter, "裸金属消费")
    if (bareParsed.error) {
      setError(bareParsed.error)
      return
    }

    const balanceValue = balanceParsed.value
    const bareValue = bareParsed.value

    if (!reason.trim()) {
      setError("请填写调账原因")
      return
    }

    const balanceUnchanged = balanceValue === row.balance_consumption
    const bareUnchanged = bareValue === row.bare_metal_consumption
    if (balanceUnchanged && bareUnchanged) {
      setError("请修改至少一项金额后再保存")
      return
    }

    if (!baseRow) return
    applyIncomeAdjustment({
      baseRow,
      balanceAfter: balanceValue,
      bareMetalAfter: bareValue,
      reason,
    })
    toast.success("调账已保存")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>调账</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.tenant_name}${row.project_name ? ` · ${row.project_name}` : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="grid shrink-0 gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">余额消费金额</p>
                <p className="text-xs text-muted-foreground">
                  当前：{formatMoney(row.balance_consumption)}
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="adj-balance">调整后金额</Label>
                  <Input
                    id="adj-balance"
                    type="text"
                    inputMode="decimal"
                    value={balanceAfter}
                    onChange={(e) => {
                      setBalanceAfter(e.target.value)
                      setError(null)
                    }}
                    placeholder="无消费可留空"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">线上裸金属消费金额</p>
                <p className="text-xs text-muted-foreground">
                  当前：{formatMoney(row.bare_metal_consumption)}
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="adj-bare-metal">调整后金额</Label>
                  <Input
                    id="adj-bare-metal"
                    type="text"
                    inputMode="decimal"
                    value={bareMetalAfter}
                    onChange={(e) => {
                      setBareMetalAfter(e.target.value)
                      setError(null)
                    }}
                    placeholder="无消费可留空"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adj-reason">调账原因</Label>
              <Textarea
                id="adj-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError(null)
                }}
                placeholder="说明本次调账原因，便于追溯"
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {row && history.length > 0 && (
          <div className="min-h-0 flex-1 space-y-2">
            <p className="text-sm font-medium">调账历史</p>
            <ScrollArea className="h-[min(280px,35vh)] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">时间</TableHead>
                    <TableHead className="text-right">余额（原→新）</TableHead>
                    <TableHead className="text-right">裸金属（原→新）</TableHead>
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
                        {formatOptionalMoney(h.balance_consumption_before)} →{" "}
                        {formatOptionalMoney(h.balance_consumption_after)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatOptionalMoney(h.bare_metal_consumption_before)} →{" "}
                        {formatOptionalMoney(h.bare_metal_consumption_after)}
                      </TableCell>
                      <TableCell className="max-w-[160px] text-xs">
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
