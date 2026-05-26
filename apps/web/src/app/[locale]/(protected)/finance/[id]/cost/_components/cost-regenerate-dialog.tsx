"use client"

import { fileToBase64 } from "@/lib/utils/file-to-base64"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { IconLoader2, IconUpload } from "@tabler/icons-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type SlotState = {
  file: File | null
  status: "empty" | "parsing" | "done" | "error"
  message: string
  rowCount: number
}

function emptySlot(): SlotState {
  return { file: null, status: "empty", message: "", rowCount: 0 }
}

const BAREMETAL_HINT =
  "必选 · Excel：订单ID、租户ID、机房名称、设备型号（卡型 x 卡数）、购买数量（数量 x 时长包）、最终总额、下单时间等列"

const TENANT_BILL_HINT =
  "必选 · Excel 或 CSV：客户ID、总消费、卡时、GPU 型号、区域等列（该时间段内汇总）"

type CostRegenerateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  billingPeriodId: string
  periodCode: string
  periodStart: string
  periodEnd: string
  onSuccess?: () => void
}

export function CostRegenerateDialog({
  open,
  onOpenChange,
  billingPeriodId,
  periodCode,
  periodStart,
  periodEnd,
  onSuccess,
}: CostRegenerateDialogProps) {
  const utils = trpc.useUtils()
  const prepare = trpc.finance.periods.prepareRegenerateCost.useMutation()
  const importFile = trpc.finance.periods.importFile.useMutation()
  const regenerateCost = trpc.finance.periods.regenerateCost.useMutation()

  const [windowId, setWindowId] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [baremetal, setBaremetal] = useState<SlotState>(emptySlot())
  const [tenantBill, setTenantBill] = useState<SlotState>(emptySlot())

  const resetSlots = useCallback(() => {
    setBaremetal(emptySlot())
    setTenantBill(emptySlot())
    setWindowId(null)
  }, [])

  useEffect(() => {
    if (!open) {
      resetSlots()
      return
    }

    let cancelled = false
    setPreparing(true)
    prepare
      .mutateAsync({ billingPeriodId })
      .then((window) => {
        if (cancelled) return
        setWindowId(window.id)
      })
      .catch((e) => {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : "准备重新生成失败")
        onOpenChange(false)
      })
      .finally(() => {
        if (!cancelled) setPreparing(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, billingPeriodId, onOpenChange, resetSlots])

  const handleBaremetalChange = async (file: File | null) => {
    if (!file) return
    setBaremetal({ file, status: "parsing", message: "解析中…", rowCount: 0 })
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await importFile.mutateAsync({
        billingPeriodId,
        slot: "baremetal",
        fileName: file.name,
        fileBase64,
        preserveIncomeDerived: true,
      })
      setBaremetal({
        file,
        status: result.ok ? "done" : "error",
        message: result.message,
        rowCount: result.rowCount,
      })
      if (!result.ok) toast.error(result.message)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "裸金属订单上传失败"
      setBaremetal({ file, status: "error", message: msg, rowCount: 0 })
      toast.error(msg)
    }
  }

  const handleTenantBillChange = async (file: File | null) => {
    if (!file || !windowId) return
    setTenantBill({ file, status: "parsing", message: "解析中…", rowCount: 0 })
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await importFile.mutateAsync({
        billingPeriodId,
        slot: "tenantBill",
        fileName: file.name,
        fileBase64,
        windowId,
        preserveIncomeDerived: true,
      })
      setTenantBill({
        file,
        status: result.ok ? "done" : "error",
        message: result.message,
        rowCount: result.rowCount,
      })
      if (!result.ok) toast.error(result.message)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "客户账单详情上传失败"
      setTenantBill({ file, status: "error", message: msg, rowCount: 0 })
      toast.error(msg)
    }
  }

  const canConfirm =
    Boolean(windowId) &&
    baremetal.status === "done" &&
    tenantBill.status === "done" &&
    !regenerateCost.isPending &&
    !preparing

  const handleConfirm = async () => {
    if (!canConfirm) return
    try {
      const result = await regenerateCost.mutateAsync({ billingPeriodId })
      await utils.finance.periods.getBundle.invalidate({ id: billingPeriodId })
      toast.success(`成本已重新生成（${result.costCount} 条分项）`)
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重新生成成本失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[40vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>重新生成成本 · {periodCode}</DialogTitle>
          <DialogDescription>
            将清空本账期已有成本计算结果。请重新上传裸金属消费订单与客户账单详情（整月
            {periodStart} ~ {periodEnd}），客户消费明细与收入数据不受影响。
          </DialogDescription>
        </DialogHeader>

        {preparing ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <IconLoader2 className="size-4 animate-spin" />
            正在清理历史成本数据并准备上传…
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">裸金属消费订单列表</p>
                  <p className="text-xs text-muted-foreground">{BAREMETAL_HINT}</p>
                </div>
                {baremetal.status === "parsing" && (
                  <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={
                    baremetal.status === "parsing" || regenerateCost.isPending
                  }
                >
                  <label
                    className={
                      baremetal.status === "parsing" || regenerateCost.isPending
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  >
                    <IconUpload className="mr-1 size-4" />
                    选择文件
                    <input
                      type="file"
                      className="sr-only"
                      accept=".xlsx,.xls,.csv"
                      disabled={
                        baremetal.status === "parsing" || regenerateCost.isPending
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        void handleBaremetalChange(file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                </Button>
                {baremetal.file && (
                  <span className="text-sm text-muted-foreground truncate max-w-[220px]">
                    {baremetal.file.name}
                  </span>
                )}
              </div>
              {baremetal.status !== "empty" && (
                <p
                  className={
                    baremetal.status === "error"
                      ? "text-sm text-destructive"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {baremetal.message ||
                    (baremetal.status === "done"
                      ? `解析成功（${baremetal.rowCount} 行）`
                      : "")}
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    客户账单详情（{periodStart} ~ {periodEnd}）
                  </p>
                  <p className="text-xs text-muted-foreground">{TENANT_BILL_HINT}</p>
                </div>
                {tenantBill.status === "parsing" && (
                  <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={
                    !windowId ||
                    tenantBill.status === "parsing" ||
                    regenerateCost.isPending
                  }
                >
                  <label
                    className={
                      !windowId ||
                      tenantBill.status === "parsing" ||
                      regenerateCost.isPending
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  >
                    <IconUpload className="mr-1 size-4" />
                    选择文件
                    <input
                      type="file"
                      className="sr-only"
                      accept=".xlsx,.xls,.csv"
                      disabled={
                        !windowId ||
                        tenantBill.status === "parsing" ||
                        regenerateCost.isPending
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        void handleTenantBillChange(file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                </Button>
                {tenantBill.file && (
                  <span className="text-sm text-muted-foreground truncate max-w-[220px]">
                    {tenantBill.file.name}
                  </span>
                )}
              </div>
              {tenantBill.status !== "empty" && (
                <p
                  className={
                    tenantBill.status === "error"
                      ? "text-sm text-destructive"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {tenantBill.message ||
                    (tenantBill.status === "done"
                      ? `解析成功（${tenantBill.rowCount} 行）`
                      : "")}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={regenerateCost.isPending}
          >
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!canConfirm}>
            {regenerateCost.isPending ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                计算中…
              </>
            ) : (
              <>
                <IconUpload className="mr-2 size-4" />
                确认重新生成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
