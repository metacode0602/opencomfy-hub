"use client"

import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { AppShell } from "@/components/dashboard/app-shell"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { IconLoader2, IconUpload } from "@tabler/icons-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { formatMoney } from "../_lib/display"
import { IncomeDetailTable } from "../_components/income-detail-table"
import { CostGroupedTable } from "../[id]/cost/_components/cost-grouped-table"

type SlotKey = "customer" | "baremetal" | "tenantBill"

type SlotState = {
  file: File | null
  status: "empty" | "parsing" | "done" | "error"
  message: string
  rowCount: number
}

const SLOT_LABEL: Record<
  SlotKey,
  { title: string; hint: string; accept: string }
> = {
  customer: {
    title: "客户消费明细",
    hint: "Excel：客户ID、类型、总消费、券消费、余额消费等列",
    accept: ".xlsx,.xls,.csv",
  },
  baremetal: {
    title: "裸金属消费订单列表",
    hint: "Excel：订单ID、客户ID、订单金额、最终总额、下单时间等列",
    accept: ".xlsx,.xls,.csv",
  },
  tenantBill: {
    title: "客户账单详情（除 CPU 任务）",
    hint: "Excel 或 CSV：客户ID、总消费、卡时、GPU 型号、区域等列",
    accept: ".xlsx,.xls,.csv",
  },
}

function initialSlots(): Record<SlotKey, SlotState> {
  return {
    customer: { file: null, status: "empty", message: "", rowCount: 0 },
    baremetal: { file: null, status: "empty", message: "", rowCount: 0 },
    tenantBill: { file: null, status: "empty", message: "", rowCount: 0 },
  }
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function BillingPeriodFormCard({
  periodCode,
  periodStart,
  periodEnd,
  slots,
  computing,
  persisting,
  canRunCompute,
  onPeriodCodeChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onPickFile,
  onCompute,
  onCancelHref,
  compact,
}: {
  periodCode: string
  periodStart: string
  periodEnd: string
  slots: Record<SlotKey, SlotState>
  computing: boolean
  persisting: boolean
  canRunCompute: boolean
  onPeriodCodeChange: (v: string) => void
  onPeriodStartChange: (v: string) => void
  onPeriodEndChange: (v: string) => void
  onPickFile: (slot: SlotKey, file: File | null) => void
  onCompute: () => void
  onCancelHref: string
  compact?: boolean
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>添加账期</CardTitle>
        <CardDescription>
          填写账期信息并上传三类 Excel，完成后点击「计算」生成收入与成本明细。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="period_code">账期编码 period_code</Label>
            <Input
              id="period_code"
              placeholder="例如 2026-06"
              value={periodCode}
              onChange={(e) => onPeriodCodeChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period_start">账期开始</Label>
            <Input
              id="period_start"
              type="date"
              value={periodStart}
              onChange={(e) => onPeriodStartChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period_end">账期结束</Label>
            <Input
              id="period_end"
              type="date"
              value={periodEnd}
              onChange={(e) => onPeriodEndChange(e.target.value)}
            />
          </div>
        </div>

        {periodStart && periodEnd && periodStart > periodEnd && (
          <p className="text-sm text-destructive">结束日期不能早于开始日期</p>
        )}

        <div className={compact ? "space-y-3" : "space-y-4"}>
          {(Object.keys(SLOT_LABEL) as SlotKey[]).map((key) => {
            const meta = SLOT_LABEL[key]
            const st = slots[key]
            return (
              <div
                key={key}
                className="rounded-lg border bg-muted/30 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{meta.title}</p>
                    <p className="text-xs text-muted-foreground">{meta.hint}</p>
                  </div>
                  {st.status === "parsing" && (
                    <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <IconUpload className="mr-1 size-4" />
                      选择文件
                      <input
                        type="file"
                        className="sr-only"
                        accept={meta.accept}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          onPickFile(key, f)
                          e.target.value = ""
                        }}
                      />
                    </label>
                  </Button>
                  {st.file && (
                    <span className="text-sm text-muted-foreground truncate max-w-[220px]">
                      {st.file.name}
                    </span>
                  )}
                </div>
                {st.status !== "empty" && (
                  <p
                    className={
                      st.status === "error"
                        ? "text-sm text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {st.message}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
        <Button
          type="button"
          disabled={!canRunCompute}
          onClick={onCompute}
        >
          {computing ? (
            <>
              <IconLoader2 className="mr-2 size-4 animate-spin" />
              计算中…
            </>
          ) : (
            "计算"
          )}
        </Button>
        <Button type="button" variant="outline" asChild disabled={persisting}>
          <LocaleLink href={onCancelHref}>取消</LocaleLink>
        </Button>
      </CardFooter>
    </Card>
  )
}

function ComputeResultCard({
  period,
  computing,
  canRunCompute,
  onRecompute,
}: {
  period: {
    period_code: string
    period_start: string
    period_end: string
    total_income: string | null
    total_cost: string | null
    supplementary: string | null
    balance_income: string | null
    baremetal_income: string | null
  }
  computing: boolean
  canRunCompute: boolean
  onRecompute: () => void
}) {
  const grossProfit =
    (Number(period.total_income ?? 0) || 0) - (Number(period.total_cost ?? 0) || 0)

  return (
    <Card className="h-full border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle>计算结果（未写入）</CardTitle>
        <CardDescription>
          账期 {period.period_code}（{period.period_start} ~ {period.period_end}）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">账期总收入</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(period.total_income ?? "0")}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">账期总成本</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(period.total_cost ?? "0")}
            </p>
          </div>
          <div className="rounded-md border p-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">账期毛利</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(String(grossProfit))}
            </p>
          </div>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">补充收入</p>
            <p className="tabular-nums font-medium">
              {formatMoney(period.supplementary ?? "0")}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">余额收入</p>
            <p className="tabular-nums font-medium">
              {formatMoney(period.balance_income ?? "0")}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">裸金属收入</p>
            <p className="tabular-nums font-medium">
              {formatMoney(period.baremetal_income ?? "0")}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          下方已展示本账期收入与成本明细，核对无误后可写入本地。
        </p>
      </CardContent>
      <CardFooter className="border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onRecompute}
          disabled={!canRunCompute || computing}
        >
          {computing ? (
            <>
              <IconLoader2 className="mr-2 size-4 animate-spin" />
              重新计算中…
            </>
          ) : (
            "重新计算"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function FinanceCreateBillingPeriodPage() {
  const router = useLocaleRouter()
  const utils = trpc.useUtils()

  const [periodCode, setPeriodCode] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>(initialSlots)
  const [computing, setComputing] = useState(false)
  const [persisting, setPersisting] = useState(false)

  const createPeriod = trpc.finance.periods.create.useMutation()
  const importFile = trpc.finance.periods.importFile.useMutation()
  const computePeriod = trpc.finance.periods.compute.useMutation()
  const publishPeriod = trpc.finance.periods.publish.useMutation()

  const { data: draftBundle } = trpc.finance.periods.getBundle.useQuery(
    { id: periodId! },
    { enabled: Boolean(periodId) },
  )

  const clearPreview = useCallback(() => {
    setPeriodId(null)
  }, [])

  const allParsed =
    slots.customer.status === "done" &&
    slots.baremetal.status === "done" &&
    slots.tenantBill.status === "done"

  const ensurePeriod = useCallback(async (): Promise<string> => {
    if (periodId) return periodId
    const created = await createPeriod.mutateAsync({
      periodCode: periodCode.trim(),
      periodStart,
      periodEnd,
    })
    setPeriodId(created.id)
    return created.id
  }, [createPeriod, periodCode, periodEnd, periodId, periodStart])

  const onPickFile = useCallback(
    async (slot: SlotKey, file: File | null) => {
      if (!file) {
        setSlots((s) => ({
          ...s,
          [slot]: { file: null, status: "empty", message: "", rowCount: 0 },
        }))
        return
      }
      if (!periodCode.trim() || !periodStart || !periodEnd) {
        toast.error("请先填写账期编码与起止日期")
        return
      }
      setSlots((s) => ({
        ...s,
        [slot]: { file, status: "parsing", message: "正在上传并解析…", rowCount: 0 },
      }))
      try {
        const id = await ensurePeriod()
        const fileBase64 = await fileToBase64(file)
        const result = await importFile.mutateAsync({
          billingPeriodId: id,
          slot,
          fileName: file.name,
          fileBase64,
        })
        setSlots((s) => ({
          ...s,
          [slot]: {
            file,
            status: "done",
            message: `解析成功（${result.rowCount} 行）`,
            rowCount: result.rowCount,
          },
        }))
        await utils.finance.periods.getBundle.invalidate({ id })
        toast.success(`${SLOT_LABEL[slot].title} 导入成功`)
      } catch (e) {
        setSlots((s) => ({
          ...s,
          [slot]: {
            file,
            status: "error",
            message: e instanceof Error ? e.message : "导入失败",
            rowCount: 0,
          },
        }))
      }
    },
    [ensurePeriod, importFile, periodCode, periodEnd, periodStart, utils.finance.periods.getBundle],
  )

  const canRunCompute =
    Boolean(periodCode.trim()) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    allParsed &&
    !computing &&
    !persisting &&
    periodStart <= periodEnd

  const handleCompute = async () => {
    if (!canRunCompute) return
    setComputing(true)
    try {
      const id = await ensurePeriod()
      await computePeriod.mutateAsync({ billingPeriodId: id })
      await utils.finance.periods.getBundle.invalidate({ id })
      toast.success("计算完成，请核对汇总与下方明细")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "计算失败")
    } finally {
      setComputing(false)
    }
  }

  const handlePersist = async () => {
    if (!periodId || !draftBundle) return
    setPersisting(true)
    try {
      await publishPeriod.mutateAsync({ billingPeriodId: periodId })
      await utils.finance.periods.list.invalidate()
      toast.success("账期已发布")
      router.push("/finance")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发布失败")
    } finally {
      setPersisting(false)
    }
  }

  const p = draftBundle?.period
  const hasResult =
    draftBundle?.period?.status === "computed" ||
    draftBundle?.period?.status === "published"

  const formCard = (
    <BillingPeriodFormCard
      periodCode={periodCode}
      periodStart={periodStart}
      periodEnd={periodEnd}
      slots={slots}
      computing={computing}
      persisting={persisting}
      canRunCompute={canRunCompute}
      onPeriodCodeChange={(v) => {
        clearPreview()
        setPeriodCode(v)
      }}
      onPeriodStartChange={(v) => {
        clearPreview()
        setPeriodStart(v)
      }}
      onPeriodEndChange={(v) => {
        clearPreview()
        setPeriodEnd(v)
      }}
      onPickFile={(slot, file) => void onPickFile(slot, file)}
      onCompute={() => void handleCompute()}
      onCancelHref="/finance"
      compact={hasResult}
    />
  )

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <LocaleLink href="/finance">← 返回账期列表</LocaleLink>
          </Button>
        </div>

        {!hasResult ? (
          formCard
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              {formCard}
              <ComputeResultCard
                period={p!}
                computing={computing}
                canRunCompute={canRunCompute}
                onRecompute={() => void handleCompute()}
              />
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>收入明细</CardTitle>
                  <CardDescription>
                    platform_income_monthly · 共 {draftBundle!.income.length} 条
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IncomeDetailTable
                    rows={draftBundle!.income}
                    showPeriodColumn={false}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>成本毛利明细</CardTitle>
                  <CardDescription>
                    platform_cost_monthly · 共 {draftBundle!.cost.length}{" "}
                    条，按客户经理汇总展示
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CostGroupedTable rows={draftBundle!.cost} />
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" asChild disabled={persisting}>
                  <LocaleLink href="/finance">取消</LocaleLink>
                </Button>
                <Button
                  type="button"
                  disabled={persisting || computing}
                  onClick={() => void handlePersist()}
                >
                  {persisting ? (
                    <>
                      <IconLoader2 className="mr-2 size-4 animate-spin" />
                      写入中…
                    </>
                  ) : (
                    "发布账期并返回列表"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
