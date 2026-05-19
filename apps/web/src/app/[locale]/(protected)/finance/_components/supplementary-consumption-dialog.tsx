"use client"

import { formatMoney } from "@/app/[locale]/(protected)/finance/_lib/display"
import { validateMoneyInput } from "@/lib/finance/income-row-utils"
import { useFinanceIncomeOpsStore } from "@/lib/stores/finance-income-ops-store"
import type { PlatformIncomeMonthly } from "@/lib/types/finance"
import {
  SUPPLEMENTARY_CONSUMPTION_TYPE_LABELS,
  type SupplementaryConsumptionType,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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

const TYPE_OPTIONS = Object.entries(SUPPLEMENTARY_CONSUMPTION_TYPE_LABELS) as [
  SupplementaryConsumptionType,
  string,
][]

type SupplementaryConsumptionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 展示用（含已生效的调整） */
  displayRow: PlatformIncomeMonthly | null
  /** 原始导入行，用于写入历史 */
  baseRow: PlatformIncomeMonthly | null
}

export function SupplementaryConsumptionDialog({
  open,
  onOpenChange,
  displayRow: row,
  baseRow,
}: SupplementaryConsumptionDialogProps) {
  const applySupplementaryChange = useFinanceIncomeOpsStore(
    (s) => s.applySupplementaryChange,
  )
  const getHistory = useFinanceIncomeOpsStore((s) => s.getSupplementaryHistory)

  const [newValue, setNewValue] = useState("")
  const [type, setType] = useState<SupplementaryConsumptionType>("manual_correction")
  const [remark, setRemark] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setNewValue(row.supplementary_consumption ?? "")
    setType("manual_correction")
    setRemark("")
    setError(null)
  }, [open, row])

  const history = row ? getHistory(row.id) : []

  function handleSubmit() {
    if (!row) return
    const moneyError = validateMoneyInput(newValue)
    if (moneyError) {
      setError(moneyError)
      return
    }
    if (!remark.trim()) {
      setError("请填写备注")
      return
    }
    if (!baseRow) return
    applySupplementaryChange({
      baseRow,
      newValue: newValue.trim(),
      type,
      remark,
    })
    toast.success("补充消费已更新")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>补充消费</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.tenant_name}${row.project_name ? ` · ${row.project_name}` : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="grid shrink-0 gap-4 py-2">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">当前补充消费金额：</span>
              <span className="ml-1 font-medium tabular-nums">
                {formatMoney(row.supplementary_consumption)}
              </span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supp-new-value">修改后金额</Label>
              <Input
                id="supp-new-value"
                type="text"
                inputMode="decimal"
                value={newValue}
                onChange={(e) => {
                  setNewValue(e.target.value)
                  setError(null)
                }}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label>类型</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as SupplementaryConsumptionType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supp-remark">备注</Label>
              <Textarea
                id="supp-remark"
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value)
                  setError(null)
                }}
                placeholder="说明本次修改原因"
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {row && history.length > 0 && (
          <div className="min-h-0 flex-1 space-y-2">
            <p className="text-sm font-medium">修改历史</p>
            <ScrollArea className="h-[min(240px,30vh)] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">时间</TableHead>
                    <TableHead className="text-right">原值</TableHead>
                    <TableHead className="text-right">新值</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...history].reverse().map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {h.created_at.slice(0, 19).replace("T", " ")}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatMoney(h.previous_value)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatMoney(h.new_value)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {SUPPLEMENTARY_CONSUMPTION_TYPE_LABELS[h.type]}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">
                        {h.remark}
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
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
