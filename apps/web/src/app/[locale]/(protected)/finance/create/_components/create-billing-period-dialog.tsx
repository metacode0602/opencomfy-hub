"use client"

import { getPeriodDateRange, isValidPeriodCode } from "../../_lib/period"
import { Badge } from "@workspace/ui/components/badge"
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
import { IconCheck, IconLoader2, IconUpload } from "@tabler/icons-react"
import { useCallback, useEffect, useState } from "react"

type SlotState = {
  file: File | null
  status: "empty" | "parsing" | "done" | "error"
  message: string
  rowCount: number
}

type CreatedPeriod = {
  id: string
  periodCode: string
  periodStart: string
  periodEnd: string
}

type DialogPhase = "create" | "manage"

type CreateBillingPeriodDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 创建成功并完成计算后回调（静态阶段用于跳转等，接入 tRPC 后生效） */
  onPeriodReady?: (period: CreatedPeriod) => void
}

const INCOME_FLOW_STEPS = [
  "筛选非归档经营项目，且计费租户已维护 platform_tenant_id。",
  "按账期编码 period_code 匹配 CRM tenant_bill.bill_month，读取对应租户月度账单。",
  "汇总 tenant_bill_detail：余额消费与裸金属消费，经 tenant → customer 写入客户全称。",
  "保留各行已有补充消费；总消费 = 补充 + 余额 + 裸金属。",
]

const BAREMETAL_HINT =
  "Excel：订单ID、租户ID、机房名称、设备型号（卡型 x 卡数）、购买数量（数量 x 时长包）、最终总额、下单时间等列"

const TENANT_BILL_HINT =
  "Excel 或 CSV：客户ID、总消费、卡时、GPU 型号、区域等列（该时间段内汇总）"

function emptySlot(): SlotState {
  return { file: null, status: "empty", message: "", rowCount: 0 }
}

function mockDelay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function mockParseFile(file: File): Promise<{ ok: boolean; rowCount: number; message: string }> {
  const rowCount = Math.max(1, Math.floor(file.size / 120))
  return mockDelay(600).then(() => ({
    ok: true,
    rowCount,
    message: `解析成功（${rowCount} 行）`,
  }))
}

function UploadSlot({
  title,
  hint,
  slot,
  accept,
  disabled,
  onPickFile,
}: {
  title: string
  hint: string
  slot: SlotState
  accept: string
  disabled?: boolean
  onPickFile: (file: File | null) => void
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {slot.status === "parsing" && (
          <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          asChild
          disabled={disabled || slot.status === "parsing"}
        >
          <label
            className={
              disabled || slot.status === "parsing"
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            }
          >
            <IconUpload className="mr-1 size-4" />
            选择文件
            <input
              type="file"
              className="sr-only"
              accept={accept}
              disabled={disabled || slot.status === "parsing"}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                onPickFile(file)
                e.target.value = ""
              }}
            />
          </label>
        </Button>
        {slot.file && (
          <span className="text-sm text-muted-foreground truncate max-w-[220px]">
            {slot.file.name}
          </span>
        )}
      </div>
      {slot.status !== "empty" && (
        <p
          className={
            slot.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {slot.message}
        </p>
      )}
    </div>
  )
}

export function CreateBillingPeriodDialog({
  open,
  onOpenChange,
  onPeriodReady,
}: CreateBillingPeriodDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>("create")
  const [periodCode, setPeriodCode] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdPeriod, setCreatedPeriod] = useState<CreatedPeriod | null>(null)

  const [baremetalSlot, setBaremetalSlot] = useState<SlotState>(emptySlot())
  const [tenantBillSlot, setTenantBillSlot] = useState<SlotState>(emptySlot())
  const [computingIncome, setComputingIncome] = useState(false)
  const [computingCost, setComputingCost] = useState(false)
  const [incomeComputed, setIncomeComputed] = useState(false)
  const [costComputed, setCostComputed] = useState(false)
  const [computeMessage, setComputeMessage] = useState<string | null>(null)

  const resetState = useCallback(() => {
    setPhase("create")
    setPeriodCode("")
    setPeriodStart("")
    setPeriodEnd("")
    setCreating(false)
    setCreateError(null)
    setCreatedPeriod(null)
    setBaremetalSlot(emptySlot())
    setTenantBillSlot(emptySlot())
    setComputingIncome(false)
    setComputingCost(false)
    setIncomeComputed(false)
    setCostComputed(false)
    setComputeMessage(null)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  const canCreate =
    isValidPeriodCode(periodCode) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    periodStart <= periodEnd &&
    !creating

  const canComputeIncome =
    Boolean(createdPeriod) && !computingIncome && !computingCost

  const canComputeCost =
    Boolean(createdPeriod) &&
    baremetalSlot.status === "done" &&
    tenantBillSlot.status === "done" &&
    !computingIncome &&
    !computingCost

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true)
    setCreateError(null)
    try {
      await mockDelay(800)
      const period: CreatedPeriod = {
        id: `mock-${Date.now()}`,
        periodCode: periodCode.trim(),
        periodStart,
        periodEnd,
      }
      setCreatedPeriod(period)
      setPhase("manage")
    } catch {
      setCreateError("创建账期失败（静态演示）")
    } finally {
      setCreating(false)
    }
  }

  const handlePickBaremetalFile = async (file: File | null) => {
    if (!file) return
    setBaremetalSlot({ file, status: "parsing", message: "解析中…", rowCount: 0 })
    setCostComputed(false)
    try {
      const result = await mockParseFile(file)
      setBaremetalSlot({
        file,
        status: result.ok ? "done" : "error",
        message: result.message,
        rowCount: result.rowCount,
      })
    } catch {
      setBaremetalSlot({
        file,
        status: "error",
        message: "裸金属消费订单上传失败",
        rowCount: 0,
      })
    }
  }

  const handlePickTenantBillFile = async (file: File | null) => {
    if (!file) return
    setTenantBillSlot({ file, status: "parsing", message: "解析中…", rowCount: 0 })
    setCostComputed(false)
    try {
      const result = await mockParseFile(file)
      setTenantBillSlot({
        file,
        status: result.ok ? "done" : "error",
        message: result.message,
        rowCount: result.rowCount,
      })
    } catch {
      setTenantBillSlot({
        file,
        status: "error",
        message: "客户账单详情上传失败",
        rowCount: 0,
      })
    }
  }

  const handleComputeIncome = async () => {
    if (!canComputeIncome || !createdPeriod) return
    setComputingIncome(true)
    setComputeMessage(null)
    try {
      await mockDelay(1200)
      setIncomeComputed(true)
      setComputeMessage(`账期 ${createdPeriod.periodCode} 收入已从 CRM 账单计算（静态演示）`)
    } catch {
      setComputeMessage("计算收入失败（静态演示）")
    } finally {
      setComputingIncome(false)
    }
  }

  const handleComputeCost = async () => {
    if (!canComputeCost || !createdPeriod) return
    setComputingCost(true)
    setComputeMessage(null)
    try {
      await mockDelay(1500)
      setCostComputed(true)
      setComputeMessage(`账期 ${createdPeriod.periodCode} 成本已计算（静态演示）`)
    } catch {
      setComputeMessage("计算成本失败（静态演示）")
    } finally {
      setComputingCost(false)
    }
  }

  const handleFinish = () => {
    if (createdPeriod) {
      onPeriodReady?.(createdPeriod)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[40vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {phase === "create" ? "添加账期" : `账期 ${createdPeriod?.periodCode}`}
          </DialogTitle>
          <DialogDescription>
            {phase === "create"
              ? "填写账期信息后创建；创建成功后可分别计算收入（读取 CRM 账单）与成本（上传 Excel）。"
              : `账期 ${createdPeriod?.periodStart} ~ ${createdPeriod?.periodEnd} · 收入与成本可独立计算`}
          </DialogDescription>
        </DialogHeader>

        {phase === "create" ? (
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dialog_period_code">账期编码</Label>
                <Input
                  id="dialog_period_code"
                  placeholder="YYYY-MM，例如 2026-06"
                  pattern="\d{4}-(0[1-9]|1[0-2])"
                  value={periodCode}
                  onChange={(e) => {
                    const v = e.target.value
                    setPeriodCode(v)
                    const range = getPeriodDateRange(v)
                    if (range) {
                      setPeriodStart(range.start)
                      setPeriodEnd(range.end)
                    }
                  }}
                />
                {periodCode.trim() && !isValidPeriodCode(periodCode) && (
                  <p className="text-sm text-destructive">账期编码格式应为 YYYY-MM</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog_period_start">账期开始</Label>
                <Input
                  id="dialog_period_start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog_period_end">账期结束</Label>
                <Input
                  id="dialog_period_end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            {periodStart && periodEnd && periodStart > periodEnd && (
              <p className="text-sm text-destructive">结束日期不能早于开始日期</p>
            )}

            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <IconCheck className="size-4 text-green-600" />
              <span>账期已创建</span>
              <Badge variant="outline">{createdPeriod?.periodCode}</Badge>
              <span className="text-muted-foreground">
                {createdPeriod?.periodStart} ~ {createdPeriod?.periodEnd}
              </span>
            </div>

            {computeMessage && (
              <p className="text-sm text-muted-foreground">{computeMessage}</p>
            )}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-medium">计算收入</h3>
                  <p className="text-xs text-muted-foreground">
                    基于 CRM tenant_bill 与 tenant_bill_detail 读取数据库计算，无需上传 Excel
                  </p>
                </div>
                {incomeComputed && (
                  <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-300">
                    已计算
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">数据来源</p>
                <p className="text-xs text-muted-foreground">
                  账期编码 {createdPeriod?.periodCode} 匹配 tenant_bill.bill_month，汇总各租户月度账单明细生成收入。
                </p>
                <ol className="list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
                  {INCOME_FLOW_STEPS.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canComputeIncome}
                  onClick={() => void handleComputeIncome()}
                >
                  {computingIncome ? (
                    <>
                      <IconLoader2 className="mr-2 size-4 animate-spin" />
                      计算收入中…
                    </>
                  ) : incomeComputed ? (
                    "重新计算收入"
                  ) : (
                    "计算收入"
                  )}
                </Button>
              </div>
            </section>

            <section className="space-y-3 border-t pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-medium">计算成本</h3>
                  <p className="text-xs text-muted-foreground">
                    上传裸金属订单与客户账单详情后计算成本；收入数据不受影响
                  </p>
                </div>
                {costComputed && (
                  <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-300">
                    已计算
                  </Badge>
                )}
              </div>
              <UploadSlot
                title="裸金属消费订单列表"
                hint={BAREMETAL_HINT}
                accept=".xlsx,.xls,.csv"
                slot={baremetalSlot}
                disabled={computingIncome || computingCost}
                onPickFile={(file) => void handlePickBaremetalFile(file)}
              />
              <UploadSlot
                title={`客户账单详情（${createdPeriod?.periodStart} ~ ${createdPeriod?.periodEnd}）`}
                hint={TENANT_BILL_HINT}
                accept=".xlsx,.xls,.csv"
                slot={tenantBillSlot}
                disabled={computingIncome || computingCost}
                onPickFile={(file) => void handlePickTenantBillFile(file)}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!canComputeCost}
                  onClick={() => void handleComputeCost()}
                >
                  {computingCost ? (
                    <>
                      <IconLoader2 className="mr-2 size-4 animate-spin" />
                      计算成本中…
                    </>
                  ) : costComputed ? (
                    "重新计算成本"
                  ) : (
                    "计算成本"
                  )}
                </Button>
              </div>
            </section>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {phase === "create" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="button" disabled={!canCreate} onClick={() => void handleCreate()}>
                {creating ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    创建中…
                  </>
                ) : (
                  "创建账期"
                )}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
              <Button
                type="button"
                disabled={!incomeComputed && !costComputed}
                onClick={handleFinish}
              >
                完成并查看详情
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
