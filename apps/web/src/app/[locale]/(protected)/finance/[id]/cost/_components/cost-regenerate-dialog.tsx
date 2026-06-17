"use client"

import {
  MissingPricingAlerts,
  type MissingPricingIssue,
} from "@/app/[locale]/(protected)/finance/_components/missing-pricing-alerts"
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
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { IconDatabase, IconLoader2, IconUpload } from "@tabler/icons-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type BaremetalSourceMode = "database" | "excel"

type BaremetalPreviewData = {
  totalCandidates: number
  validRows: number
  skippedPaidFilter: number
  issues: Array<{
    orderId: string
    orderNo: string | null
    level: "error" | "warning"
    code: string
    message: string
  }>
  preview: Array<{
    orderId: string
    tenantPlatformId: string
    idcName: string
    deviceModel: string
    purchaseQtyText: string
    deviceQty: number
    finalAmount: string
    orderedAt: string
    sourceOrderMark: "online" | "offline"
  }>
}

type BaremetalSlotState = {
  mode: BaremetalSourceMode
  file: File | null
  status: "empty" | "parsing" | "preview" | "done" | "error"
  message: string
  rowCount: number
  previewData: BaremetalPreviewData | null
}

type TenantBillSlotState = {
  file: File | null
  status: "empty" | "parsing" | "done" | "error"
  message: string
  rowCount: number
}

function emptyBaremetalSlot(): BaremetalSlotState {
  return {
    mode: "database",
    file: null,
    status: "empty",
    message: "",
    rowCount: 0,
    previewData: null,
  }
}

function emptyTenantBillSlot(): TenantBillSlotState {
  return { file: null, status: "empty", message: "", rowCount: 0 }
}

const BAREMETAL_DB_HINT =
  "从 bare_metal_order 读取账期内已支付订单（含线上同步与线下导入），映射机房、卡型、时长后写入成本 Raw"

const BAREMETAL_EXCEL_HINT =
  "Excel：订单ID、租户ID、机房名称、设备型号（卡型 x 卡数）、购买数量（数量 x 时长包）、最终总额、下单时间等列"

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
  const importBaremetalFromDb =
    trpc.finance.periods.importBaremetalFromDb.useMutation()
  const regenerateCost = trpc.finance.periods.regenerateCost.useMutation()

  const [windowId, setWindowId] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [baremetal, setBaremetal] = useState<BaremetalSlotState>(emptyBaremetalSlot())
  const [tenantBill, setTenantBill] = useState<TenantBillSlotState>(emptyTenantBillSlot())
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const [missingPricing, setMissingPricing] = useState<MissingPricingIssue[]>([])

  const resetSlots = useCallback(() => {
    setBaremetal(emptyBaremetalSlot())
    setTenantBill(emptyTenantBillSlot())
    setWindowId(null)
    setRegenerateError(null)
    setMissingPricing([])
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

  const handleBaremetalModeChange = (mode: BaremetalSourceMode) => {
    setBaremetal({ ...emptyBaremetalSlot(), mode })
  }

  const handleBaremetalPreview = async () => {
    setBaremetal((prev) => ({
      ...prev,
      status: "parsing",
      message: "正在读取数据库…",
      previewData: null,
    }))
    try {
      const result = await utils.finance.periods.previewBaremetalFromDb.fetch({
        billingPeriodId,
      })
      const hasError = result.issues.some((i) => i.level === "error")
      setBaremetal((prev) => ({
        ...prev,
        status: hasError ? "error" : "preview",
        message: hasError
          ? `发现 ${result.issues.filter((i) => i.level === "error").length} 条错误，请修正订单主数据或改选 Excel`
          : `共 ${result.totalCandidates} 单（${result.skippedPaidFilter} 单未支付已跳过），可导入 ${result.validRows} 行`,
        rowCount: result.validRows,
        previewData: result,
      }))
      if (hasError) toast.error("读库预览发现错误，无法导入")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "读库预览失败"
      setBaremetal((prev) => ({
        ...prev,
        status: "error",
        message: msg,
        previewData: null,
      }))
      toast.error(msg)
    }
  }

  const handleBaremetalImportFromDb = async () => {
    if (baremetal.status !== "preview" || !baremetal.previewData?.validRows) return
    setBaremetal((prev) => ({ ...prev, status: "parsing", message: "正在写入…" }))
    try {
      const result = await importBaremetalFromDb.mutateAsync({
        billingPeriodId,
        preserveIncomeDerived: true,
      })
      setBaremetal((prev) => ({
        ...prev,
        status: "done",
        message: result.message,
        rowCount: result.rowCount,
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "读库导入失败"
      setBaremetal((prev) => ({ ...prev, status: "error", message: msg }))
      toast.error(msg)
    }
  }

  const handleBaremetalExcelChange = async (file: File | null) => {
    if (!file) return
    setBaremetal({
      mode: "excel",
      file,
      status: "parsing",
      message: "解析中…",
      rowCount: 0,
      previewData: null,
    })
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
        mode: "excel",
        file,
        status: result.ok ? "done" : "error",
        message: result.message,
        rowCount: result.rowCount,
        previewData: null,
      })
      if (!result.ok) toast.error(result.message)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "裸金属订单上传失败"
      setBaremetal({
        mode: "excel",
        file,
        status: "error",
        message: msg,
        rowCount: 0,
        previewData: null,
      })
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

  const baremetalBusy =
    baremetal.status === "parsing" ||
    regenerateCost.isPending ||
    importBaremetalFromDb.isPending

  const canConfirm =
    Boolean(windowId) &&
    baremetal.status === "done" &&
    tenantBill.status === "done" &&
    !regenerateCost.isPending &&
    !preparing

  const handleConfirm = async () => {
    if (!canConfirm) return
    setRegenerateError(null)
    setMissingPricing([])
    try {
      const result = await regenerateCost.mutateAsync({ billingPeriodId })
      await utils.finance.periods.getBundle.invalidate({ id: billingPeriodId })
      toast.success(`成本已重新生成（${result.costCount} 条分项）`)
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "重新生成成本失败"
      setRegenerateError(msg)
      try {
        const validation = await utils.finance.periods.validate.fetch({
          billingPeriodId,
          costMode: "regenerate",
        })
        setMissingPricing(validation.missingPricing)
      } catch {
        // 校验接口失败时仍展示上方错误摘要
      }
    }
  }

  const previewIssues = baremetal.previewData?.issues ?? []
  const previewErrors = previewIssues.filter((i) => i.level === "error")
  const previewWarnings = previewIssues.filter((i) => i.level === "warning")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[40vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>重新生成成本 · {periodCode}</DialogTitle>
          <DialogDescription>
            将清空本账期已有成本计算结果。裸金属订单可从数据库读取或上传 Excel；客户账单详情仍须上传（整月
            {periodStart} ~ {periodEnd}）。客户消费明细与收入数据不受影响。
          </DialogDescription>
        </DialogHeader>

        {preparing ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <IconLoader2 className="size-4 animate-spin" />
            正在清理历史成本数据并准备上传…
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <MissingPricingAlerts
              message={regenerateError}
              missingPricing={missingPricing}
            />
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">裸金属消费订单列表</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {baremetal.mode === "database"
                      ? BAREMETAL_DB_HINT
                      : BAREMETAL_EXCEL_HINT}
                  </p>
                </div>
                {baremetalBusy && (
                  <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                )}
              </div>

              <RadioGroup
                value={baremetal.mode}
                onValueChange={(v) =>
                  handleBaremetalModeChange(v as BaremetalSourceMode)
                }
                className="flex flex-wrap gap-4"
                disabled={baremetalBusy || baremetal.status === "done"}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="database" id="baremetal-source-db" />
                  <Label htmlFor="baremetal-source-db" className="cursor-pointer">
                    从数据库读取（推荐）
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="excel" id="baremetal-source-excel" />
                  <Label htmlFor="baremetal-source-excel" className="cursor-pointer">
                    上传 Excel
                  </Label>
                </div>
              </RadioGroup>

              {baremetal.mode === "database" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={baremetalBusy || baremetal.status === "done"}
                      onClick={() => void handleBaremetalPreview()}
                    >
                      <IconDatabase className="mr-1 size-4" />
                      预览订单
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        baremetalBusy ||
                        baremetal.status !== "preview" ||
                        baremetal.previewData?.validRows === 0
                      }
                      onClick={() => void handleBaremetalImportFromDb()}
                    >
                      确认导入
                    </Button>
                  </div>

                  {previewErrors.length > 0 && (
                    <ul className="text-sm text-destructive space-y-1 list-disc pl-4">
                      {previewErrors.slice(0, 8).map((issue) => (
                        <li key={`${issue.orderId}-${issue.code}`}>
                          {issue.message}
                        </li>
                      ))}
                      {previewErrors.length > 8 && (
                        <li>…另有 {previewErrors.length - 8} 条错误</li>
                      )}
                    </ul>
                  )}

                  {previewWarnings.length > 0 && baremetal.status !== "empty" && (
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                      {previewWarnings.slice(0, 5).map((issue) => (
                        <li key={`${issue.orderId}-${issue.code}`}>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}

                  {baremetal.previewData && baremetal.previewData.preview.length > 0 && (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>订单 ID</TableHead>
                            <TableHead>租户</TableHead>
                            <TableHead>机房</TableHead>
                            <TableHead>型号</TableHead>
                            <TableHead>购买数量</TableHead>
                            <TableHead>台数</TableHead>
                            <TableHead>总额</TableHead>
                            <TableHead>来源</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {baremetal.previewData.preview.map((row) => (
                            <TableRow key={row.orderId}>
                              <TableCell className="font-mono text-xs">
                                {row.orderId}
                              </TableCell>
                              <TableCell>{row.tenantPlatformId}</TableCell>
                              <TableCell>{row.idcName}</TableCell>
                              <TableCell>{row.deviceModel}</TableCell>
                              <TableCell className="text-xs">
                                {row.purchaseQtyText}
                              </TableCell>
                              <TableCell>{row.deviceQty}</TableCell>
                              <TableCell>{row.finalAmount}</TableCell>
                              <TableCell>
                                {row.sourceOrderMark === "offline" ? "线下" : "线上"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {baremetal.previewData.validRows >
                        baremetal.previewData.preview.length && (
                        <p className="text-xs text-muted-foreground p-2 border-t">
                          预览仅展示前 {baremetal.previewData.preview.length} 行，导入将写入全部{" "}
                          {baremetal.previewData.validRows} 行
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={baremetalBusy}
                  >
                    <label
                      className={
                        baremetalBusy ? "pointer-events-none opacity-50" : "cursor-pointer"
                      }
                    >
                      <IconUpload className="mr-1 size-4" />
                      选择文件
                      <input
                        type="file"
                        className="sr-only"
                        accept=".xlsx,.xls,.csv"
                        disabled={baremetalBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          void handleBaremetalExcelChange(file)
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
              )}

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
                      ? `导入成功（${baremetal.rowCount} 行）`
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
