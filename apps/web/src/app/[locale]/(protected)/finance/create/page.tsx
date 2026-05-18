"use client"

import { generateMockFinanceBundle } from "@/lib/finance/mock-generate-bundle"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import type { FinanceMockBundle } from "@/lib/stores/finance-mock-store"
import { useFinanceMockStore } from "@/lib/stores/finance-mock-store"
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

async function mockParseFile(file: File, slot: SlotKey): Promise<number> {
  await new Promise((r) => setTimeout(r, 450 + (file.size % 400)))
  const base =
    12 +
    (file.name.length % 40) +
    (Math.min(file.size, 2_000_000) % 180) +
    (slot === "customer" ? 120 : slot === "baremetal" ? 35 : 80)
  if (file.size < 80) {
    throw new Error("文件过小，疑似空表")
  }
  return base
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
          填写账期信息并上传三类报表（mock：不读取真实表格内容），完成后点击「模拟计算」。
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
            "模拟计算"
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
  period: NonNullable<FinanceMockBundle["period"]>
  computing: boolean
  canRunCompute: boolean
  onRecompute: () => void
}) {
  const grossProfit =
    (Number(period.total_income) || 0) - (Number(period.total_cost) || 0)

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
              {formatMoney(period.total_income)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">账期总成本</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(period.total_cost)}
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
              {formatMoney(period.supplementary)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">余额收入</p>
            <p className="tabular-nums font-medium">
              {formatMoney(period.balance_income)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">裸金属收入</p>
            <p className="tabular-nums font-medium">
              {formatMoney(period.baremetal_income)}
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
  const addBundle = useFinanceMockStore((s) => s.addBundle)

  const [periodCode, setPeriodCode] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>(initialSlots)
  const [draftBundle, setDraftBundle] = useState<FinanceMockBundle | null>(null)
  const [computing, setComputing] = useState(false)
  const [persisting, setPersisting] = useState(false)

  const clearPreview = useCallback(() => {
    setDraftBundle(null)
  }, [])

  const allParsed =
    slots.customer.status === "done" &&
    slots.baremetal.status === "done" &&
    slots.tenantBill.status === "done"

  const onPickFile = useCallback(
    async (slot: SlotKey, file: File | null) => {
      clearPreview()
      if (!file) {
        setSlots((s) => ({
          ...s,
          [slot]: { file: null, status: "empty", message: "", rowCount: 0 },
        }))
        return
      }
      setSlots((s) => ({
        ...s,
        [slot]: { file, status: "parsing", message: "正在模拟解析…", rowCount: 0 },
      }))
      try {
        const rowCount = await mockParseFile(file, slot)
        setSlots((s) => ({
          ...s,
          [slot]: {
            file,
            status: "done",
            message: `解析成功（mock ${rowCount} 行）`,
            rowCount,
          },
        }))
      } catch (e) {
        setSlots((s) => ({
          ...s,
          [slot]: {
            file,
            status: "error",
            message: e instanceof Error ? e.message : "解析失败",
            rowCount: 0,
          },
        }))
      }
    },
    [clearPreview],
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
    const c = slots.customer.file
    const b = slots.baremetal.file
    const t = slots.tenantBill.file
    if (!c || !b || !t) return

    setComputing(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      const bundle = generateMockFinanceBundle({
        period_code: periodCode.trim(),
        period_start: periodStart,
        period_end: periodEnd,
        customer: { name: c.name, size: c.size },
        baremetal: { name: b.name, size: b.size },
        tenantBill: { name: t.name, size: t.size },
      })
      setDraftBundle(bundle)
      toast.success("模拟计算完成，请核对汇总与下方明细")
    } catch (e) {
      setDraftBundle(null)
      toast.error(e instanceof Error ? e.message : "计算失败")
    } finally {
      setComputing(false)
    }
  }

  const handlePersist = async () => {
    if (!draftBundle) return
    setPersisting(true)
    try {
      addBundle(draftBundle)
      toast.success("已写入账期（本地持久化）")
      router.push("/finance")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "写入失败")
    } finally {
      setPersisting(false)
    }
  }

  const p = draftBundle?.period
  const hasResult = Boolean(draftBundle && p)

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
                    "写入本地并返回账期列表"
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
