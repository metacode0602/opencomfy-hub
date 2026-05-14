"use client"

import { generateMockFinanceBundle } from "@/lib/finance/mock-generate-bundle"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import type { FinanceMockBundle } from "@/lib/stores/finance-mock-store"
import { useFinanceMockStore } from "@/lib/stores/finance-mock-store"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { IconLoader2, IconUpload } from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { formatDate, formatMoney, formatText } from "../_lib/display"

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
    hint: "Excel：租户ID、类型、总消费、券消费、余额消费等列",
    accept: ".xlsx,.xls,.csv",
  },
  baremetal: {
    title: "裸金属消费订单列表",
    hint: "Excel：订单ID、租户ID、订单金额、最终总额、下单时间等列",
    accept: ".xlsx,.xls,.csv",
  },
  tenantBill: {
    title: "租户账单详情（除 CPU 任务）",
    hint: "Excel 或 CSV：租户ID、总消费、卡时、GPU 型号、区域等列",
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

export default function FinanceCreateBillingPeriodPage() {
  const router = useLocaleRouter()
  const addBundle = useFinanceMockStore((s) => s.addBundle)

  const [periodCode, setPeriodCode] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>(initialSlots)
  const [draftBundle, setDraftBundle] = useState<FinanceMockBundle | null>(null)
  const [showDetailLists, setShowDetailLists] = useState(false)
  const [computing, setComputing] = useState(false)
  const [persisting, setPersisting] = useState(false)
  const resultsAnchorRef = useRef<HTMLDivElement>(null)
  const detailAnchorRef = useRef<HTMLDivElement>(null)

  const clearPreview = useCallback(() => {
    setDraftBundle(null)
    setShowDetailLists(false)
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
    setShowDetailLists(false)
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
      toast.success("模拟计算完成，请核对汇总后确认是否展示明细")
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

  useEffect(() => {
    if (!draftBundle) return
    const id = requestAnimationFrame(() => {
      resultsAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
    return () => cancelAnimationFrame(id)
  }, [draftBundle])

  useEffect(() => {
    if (!showDetailLists) return
    const id = requestAnimationFrame(() => {
      detailAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
    return () => cancelAnimationFrame(id)
  }, [showDetailLists])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 pb-10 overflow-auto overflow-y-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href="/finance">← 返回账期列表</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>添加账期</CardTitle>
          <CardDescription>
            填写账期信息并上传三类报表（mock：不读取真实表格内容）。先执行「模拟计算」查看汇总，确认无误后再展开明细列表，最后写入并返回总表。
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
                onChange={(e) => {
                  clearPreview()
                  setPeriodCode(e.target.value)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_start">账期开始</Label>
              <Input
                id="period_start"
                type="date"
                value={periodStart}
                onChange={(e) => {
                  clearPreview()
                  setPeriodStart(e.target.value)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">账期结束</Label>
              <Input
                id="period_end"
                type="date"
                value={periodEnd}
                onChange={(e) => {
                  clearPreview()
                  setPeriodEnd(e.target.value)
                }}
              />
            </div>
          </div>

          {periodStart && periodEnd && periodStart > periodEnd && (
            <p className="text-sm text-destructive">结束日期不能早于开始日期</p>
          )}

          <div className="space-y-4">
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
                            void onPickFile(key, f)
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
            onClick={() => void handleCompute()}
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
          <Button type="button" variant="outline" asChild>
            <LocaleLink href="/finance">取消</LocaleLink>
          </Button>
        </CardFooter>
      </Card>
      <div className="space-y-6">
        {draftBundle && p && (
          <Card ref={resultsAnchorRef}>
            <CardHeader>
              <CardTitle>计算结果（未写入）</CardTitle>
              <CardDescription>
                账期 {p.period_code}（{p.period_start} ~ {p.period_end}）·
                请核对以下汇总；确认计算无误后再展开下方收入与成本明细表。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">账期总收入</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatMoney(p.total_income)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">账期总成本</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatMoney(p.total_cost)}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 grid-cols-3">
              <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">补充收入</p>
                  <p className="tabular-nums">{formatMoney(p.supplementary)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">余额收入</p>
                  <p className="tabular-nums">{formatMoney(p.balance_income)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">裸金属收入</p>
                  <p className="tabular-nums">{formatMoney(p.baremetal_income)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!showDetailLists ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDetailLists(true)}
                  >
                    确认计算无误，显示收入与成本明细
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    已展开收入与成本明细，核对后可至下方写入并返回列表。
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCompute()}
                  disabled={!canRunCompute || computing}
                >
                  重新计算
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showDetailLists && draftBundle && (
          <>
            <Card ref={detailAnchorRef}>
              <CardHeader>
                <CardTitle>平台月度收入明细（预览）</CardTitle>
                <CardDescription>
                  本账期 platform_income_monthly，共 {draftBundle.income.length} 条
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[min(480px,50vh)] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">项目名称</TableHead>
                        <TableHead className="whitespace-nowrap">客户全称</TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          补充消费
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          余额消费
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          裸金属消费
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          总消费
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftBundle.income.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{formatText(r.project_name)}</TableCell>
                          <TableCell className="max-w-[200px]">{r.tenant_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(r.supplementary_consumption)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(r.balance_consumption)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(r.bare_metal_consumption)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatMoney(r.total_consumption)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>平台月度成本（预览）</CardTitle>
                <CardDescription>
                  本账期 platform_cost_monthly，共 {draftBundle.cost.length} 条
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[min(480px,50vh)] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">类型</TableHead>
                        <TableHead className="whitespace-nowrap">机房</TableHead>
                        <TableHead className="whitespace-nowrap">卡型</TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          余额消费
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">
                          已售时长成本
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">毛利</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftBundle.cost.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.type === "sum" ? "汇总" : "分项"}</TableCell>
                          <TableCell>{formatText(r.idc_name)}</TableCell>
                          <TableCell>{formatText(r.card_type)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(r.balance_consumption)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(r.sold_duration_cost_excl_tax)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(r.gross_profit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t">
                <Button
                  type="button"
                  disabled={persisting}
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
              </CardFooter>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
