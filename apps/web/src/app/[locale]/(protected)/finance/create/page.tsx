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
import { IconDownload, IconLoader2, IconUpload } from "@tabler/icons-react"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { formatMoney } from "../_lib/display"
import { getPeriodDateRange, isValidPeriodCode } from "../_lib/period"
import { CostGroupedTable } from "../[id]/cost/_components/cost-grouped-table"

type SlotKey = "customer" | "baremetal" | "tenantBill"

type SlotState = {
  file: File | null
  status: "empty" | "parsing" | "done" | "error"
  message: string
  rowCount: number
  hasErrorReport: boolean
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
    customer: { file: null, status: "empty", message: "", rowCount: 0, hasErrorReport: false },
    baremetal: { file: null, status: "empty", message: "", rowCount: 0, hasErrorReport: false },
    tenantBill: { file: null, status: "empty", message: "", rowCount: 0, hasErrorReport: false },
  }
}

type ImportSlotServerStatus = {
  parseStatus: "ok" | "error"
  parseErrorCount: number
  rowCount: number
  hasErrorReport: boolean
}

function buildImportSlotMessage(server: ImportSlotServerStatus): string {
  if (server.parseStatus === "error" || server.hasErrorReport) {
    if (server.parseErrorCount > 0) {
      return `存在 ${server.parseErrorCount} 处错误，请下载错误明细修正`
    }
    return "解析或校验未通过，请下载错误明细修正"
  }
  return `解析成功（${server.rowCount} 行）`
}

function applyImportSlotServerStatus(
  prev: SlotState,
  server: ImportSlotServerStatus,
  messageOverride?: string,
): SlotState {
  const message = messageOverride ?? buildImportSlotMessage(server)
  if (server.hasErrorReport || server.parseStatus === "error") {
    return {
      ...prev,
      status: "error",
      hasErrorReport: server.hasErrorReport,
      message,
      rowCount: server.rowCount,
    }
  }
  if (server.parseStatus === "ok") {
    return {
      ...prev,
      status: "done",
      hasErrorReport: false,
      message,
      rowCount: server.rowCount,
    }
  }
  return prev
}

function syncSlotsFromValidation(
  prev: Record<SlotKey, SlotState>,
  slots: Partial<Record<SlotKey, ImportSlotServerStatus | null>>,
  options?: { skipParsing?: boolean; messageOverrides?: Partial<Record<SlotKey, string>> },
): Record<SlotKey, SlotState> {
  const next = { ...prev }
  const keys: SlotKey[] = ["customer", "baremetal", "tenantBill"]
  for (const key of keys) {
    const server = slots[key]
    if (!server) continue
    if (options?.skipParsing && prev[key].status === "parsing") continue
    next[key] = applyImportSlotServerStatus(
      prev[key],
      server,
      options?.messageOverrides?.[key],
    )
  }
  return next
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

function downloadBase64File(fileName: string, fileBase64: string) {
  const bin = atob(fileBase64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function ImportPreCheckAlerts({
  validation,
  computeError,
}: {
  validation:
    | {
        missingPricing: { regionCode: string; gpuModel: string }[]
        pendingAllocationCount: number
        crossFileOk: boolean
        periodStatus: string
      }
    | undefined
  computeError: string | null
}) {
  if (!validation && !computeError) return null

  return (
    <div className="space-y-3" role="alert">
      {computeError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {computeError}
        </div>
      )}
      {validation && !validation.crossFileOk && validation.periodStatus === "import_error" && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          存在 B 端未知租户或未通过跨文件校验，请修正对应 Excel 后重新上传（可在各上传区下载错误明细）。
        </div>
      )}
      {validation && validation.missingPricing.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">以下区域×GPU 缺少机房卡型成本配置，无法计算：</p>
          <ul className="mt-2 list-inside list-disc">
            {validation.missingPricing.map((p) => (
              <li key={`${p.regionCode}-${p.gpuModel}`}>
                {p.regionCode} × {p.gpuModel}
              </li>
            ))}
          </ul>
        </div>
      )}
      {validation && validation.pendingAllocationCount > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {validation.pendingAllocationCount} 个租户需配置成本分成比例后方可计算。
        </div>
      )}
    </div>
  )
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
  onDownloadError,
  onCompute,
  onCancelHref,
  compact,
  preCheckAlerts,
  readOnlyMeta,
  title,
  description,
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
  onDownloadError: (slot: SlotKey) => void
  onCompute: () => void
  onCancelHref: string
  compact?: boolean
  preCheckAlerts?: React.ReactNode
  readOnlyMeta?: boolean
  title?: string
  description?: string
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title ?? "添加账期"}</CardTitle>
        <CardDescription>
          {description ??
            "填写账期信息并上传三类 Excel，全部解析成功后点击「计算」。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {preCheckAlerts}

        <div className="grid gap-4 grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="period_code">账期编码 period_code</Label>
            <Input
              id="period_code"
              placeholder="YYYY-MM，例如 2026-06"
              pattern="\d{4}-(0[1-9]|1[0-2])"
              value={periodCode}
              readOnly={readOnlyMeta}
              disabled={readOnlyMeta}
              onChange={(e) => onPeriodCodeChange(e.target.value)}
            />
            {periodCode.trim() && !isValidPeriodCode(periodCode) && (
              <p className="text-sm text-destructive">账期编码格式应为 YYYY-MM</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="period_start">账期开始</Label>
            <Input
              id="period_start"
              type="date"
              value={periodStart}
              readOnly={readOnlyMeta}
              disabled={readOnlyMeta}
              onChange={(e) => onPeriodStartChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period_end">账期结束</Label>
            <Input
              id="period_end"
              type="date"
              value={periodEnd}
              readOnly={readOnlyMeta}
              disabled={readOnlyMeta}
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
                  {st.hasErrorReport && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDownloadError(key)}
                    >
                      <IconDownload className="mr-1 size-4" />
                      下载错误明细
                    </Button>
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
        <Button type="button" disabled={!canRunCompute} onClick={onCompute}>
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
        <p className="text-sm text-muted-foreground">
          请在下方收入明细中手工填写补充消费；重新计算将清空已填补充消费。
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
  const searchParams = useSearchParams()
  const editPeriodId = searchParams.get("periodId")
  const utils = trpc.useUtils()

  const [periodCode, setPeriodCode] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>(initialSlots)
  const [computing, setComputing] = useState(false)
  const [persisting, setPersisting] = useState(false)
  const [computeError, setComputeError] = useState<string | null>(null)
  const [supplementaryDraft, setSupplementaryDraft] = useState<Record<string, string>>({})
  const [savingSupplementary, setSavingSupplementary] = useState(false)

  const createPeriod = trpc.finance.periods.create.useMutation()
  const importFile = trpc.finance.periods.importFile.useMutation()
  const computePeriod = trpc.finance.periods.compute.useMutation()
  const publishPeriod = trpc.finance.periods.publish.useMutation()
  const saveSupplementary = trpc.finance.periods.saveSupplementary.useMutation()

  const { data: existingPeriod } = trpc.finance.periods.getById.useQuery(
    { id: editPeriodId! },
    { enabled: Boolean(editPeriodId) },
  )

  const { data: draftBundle } = trpc.finance.periods.getBundle.useQuery(
    { id: periodId! },
    { enabled: Boolean(periodId) },
  )

  const { data: validation, refetch: refetchValidation } =
    trpc.finance.periods.validate.useQuery(
      { billingPeriodId: periodId! },
      { enabled: Boolean(periodId) },
    )

  useEffect(() => {
    if (!existingPeriod || periodId) return
    setPeriodId(existingPeriod.id)
    setPeriodCode(existingPeriod.period_code)
    setPeriodStart(existingPeriod.period_start)
    setPeriodEnd(existingPeriod.period_end)
    setSlots(initialSlots())
    setComputeError(null)
  }, [existingPeriod, periodId])

  useEffect(() => {
    if (!validation?.slots) return
    setSlots((prev) =>
      syncSlotsFromValidation(prev, validation.slots, { skipParsing: true }),
    )
  }, [validation])

  useEffect(() => {
    if (!draftBundle?.income) return
    const next: Record<string, string> = {}
    for (const row of draftBundle.income) {
      next[row.id] = row.supplementary_consumption ?? "0"
    }
    setSupplementaryDraft(next)
  }, [draftBundle?.income])

  const clearPreview = useCallback(() => {
    setPeriodId(null)
    setSlots(initialSlots())
    setComputeError(null)
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

  const onDownloadError = useCallback(
    async (slot: SlotKey) => {
      if (!periodId) return
      try {
        const report = await utils.finance.periods.downloadImportErrorReport.fetch({
          billingPeriodId: periodId,
          slot,
        })
        downloadBase64File(report.fileName, report.fileBase64)
      } catch (e) {
        setComputeError(e instanceof Error ? e.message : "下载失败")
      }
    },
    [periodId, utils.finance.periods.downloadImportErrorReport],
  )

  const onPickFile = useCallback(
    async (slot: SlotKey, file: File | null) => {
      if (!file) {
        setSlots((s) => ({
          ...s,
          [slot]: {
            file: null,
            status: "empty",
            message: "",
            rowCount: 0,
            hasErrorReport: false,
          },
        }))
        return
      }
      if (!isValidPeriodCode(periodCode) || !periodStart || !periodEnd) {
        setComputeError("请先填写正确格式的账期编码（YYYY-MM）与起止日期")
        return
      }
      setComputeError(null)
      setSlots((s) => ({
        ...s,
        [slot]: {
          file,
          status: "parsing",
          message: "正在上传并解析…",
          rowCount: 0,
          hasErrorReport: false,
        },
      }))
      try {
        const id = await ensurePeriod()
        void utils.finance.periods.validate.invalidate({ billingPeriodId: id })
        const fileBase64 = await fileToBase64(file)
        const result = await importFile.mutateAsync({
          billingPeriodId: id,
          slot,
          fileName: file.name,
          fileBase64,
        })
        const { data: freshValidation } = await refetchValidation()
        setSlots((prev) => {
          const withFile = { ...prev, [slot]: { ...prev[slot], file } }
          const messageOverrides: Partial<Record<SlotKey, string>> = {}
          if (!result.ok && result.message) {
            messageOverrides[slot] = result.message
          }
          if (freshValidation?.slots) {
            return syncSlotsFromValidation(withFile, freshValidation.slots, {
              messageOverrides,
            })
          }
          return {
            ...withFile,
            [slot]: applyImportSlotServerStatus(
              withFile[slot],
              {
                parseStatus: result.ok ? "ok" : "error",
                parseErrorCount: result.parseErrorCount,
                rowCount: result.rowCount,
                hasErrorReport: result.hasErrorReport,
              },
              result.message,
            ),
          }
        })
        await utils.finance.periods.getBundle.invalidate({ id })
      } catch (e) {
        setSlots((s) => ({
          ...s,
          [slot]: {
            file,
            status: "error",
            message: e instanceof Error ? e.message : "导入失败",
            rowCount: 0,
            hasErrorReport: false,
          },
        }))
      }
    },
    [
      ensurePeriod,
      importFile,
      periodCode,
      periodEnd,
      periodStart,
      refetchValidation,
      utils.finance.periods.getBundle,
    ],
  )

  const canRunCompute =
    isValidPeriodCode(periodCode) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    allParsed &&
    (validation?.canCompute ?? false) &&
    !computing &&
    !persisting &&
    periodStart <= periodEnd

  const handleCompute = async () => {
    if (!canRunCompute) return
    setComputing(true)
    setComputeError(null)
    try {
      const id = await ensurePeriod()
      await computePeriod.mutateAsync({ billingPeriodId: id })
      await utils.finance.periods.getBundle.invalidate({ id })
      await refetchValidation()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "计算失败"
      setComputeError(msg)
      if (periodId) await refetchValidation()
    } finally {
      setComputing(false)
    }
  }

  const handleSaveSupplementary = async () => {
    if (!periodId || !draftBundle) return
    setSavingSupplementary(true)
    try {
      await saveSupplementary.mutateAsync({
        billingPeriodId: periodId,
        items: draftBundle.income.map((row) => ({
          incomeRowId: row.id,
          supplementaryConsumption: supplementaryDraft[row.id] ?? "0",
        })),
      })
      await utils.finance.periods.getBundle.invalidate({ id: periodId })
      setComputeError(null)
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "保存补充消费失败")
    } finally {
      setSavingSupplementary(false)
    }
  }

  const handlePersist = async () => {
    if (!periodId || !draftBundle) return
    setPersisting(true)
    try {
      await publishPeriod.mutateAsync({ billingPeriodId: periodId })
      await utils.finance.periods.list.invalidate()
      router.push("/finance")
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "发布失败")
    } finally {
      setPersisting(false)
    }
  }

  const p = draftBundle?.period
  const hasResult =
    draftBundle?.period?.status === "computed" ||
    draftBundle?.period?.status === "published"

  const preCheckAlerts = (
    <ImportPreCheckAlerts validation={validation} computeError={computeError} />
  )

  const isEditingExisting = Boolean(editPeriodId || periodId)

  const formCard = (
    <BillingPeriodFormCard
      periodCode={periodCode}
      periodStart={periodStart}
      periodEnd={periodEnd}
      slots={slots}
      computing={computing}
      persisting={persisting}
      canRunCompute={canRunCompute}
      preCheckAlerts={preCheckAlerts}
      readOnlyMeta={isEditingExisting}
      title={isEditingExisting ? "重新上传账期" : undefined}
      description={
        isEditingExisting
          ? "账期元数据不可修改。请重新上传三类 Excel，全部解析成功后点击「计算」。"
          : undefined
      }
      onPeriodCodeChange={(v) => {
        clearPreview()
        setPeriodCode(v)
        const range = getPeriodDateRange(v)
        if (range) {
          setPeriodStart(range.start)
          setPeriodEnd(range.end)
        }
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
      onDownloadError={(slot) => void onDownloadError(slot)}
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
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>收入明细</CardTitle>
                    <CardDescription>
                      手工填写补充消费 · 共 {draftBundle!.income.length} 条
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingSupplementary || computing}
                    onClick={() => void handleSaveSupplementary()}
                  >
                    {savingSupplementary ? (
                      <>
                        <IconLoader2 className="mr-2 size-4 animate-spin" />
                        保存中…
                      </>
                    ) : (
                      "保存补充消费"
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left">租户</th>
                          <th className="px-3 py-2 text-right">补充消费</th>
                          <th className="px-3 py-2 text-right">余额消费</th>
                          <th className="px-3 py-2 text-right">裸金属</th>
                          <th className="px-3 py-2 text-right">总消费</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftBundle!.income.map((row) => {
                          const sup = supplementaryDraft[row.id] ?? "0"
                          const total =
                            (Number(sup) || 0) +
                            (Number(row.balance_consumption ?? 0) || 0) +
                            (Number(row.bare_metal_consumption ?? 0) || 0)
                          return (
                            <tr key={row.id} className="border-b">
                              <td className="px-3 py-2">{row.tenant_name}</td>
                              <td className="px-3 py-2 text-right">
                                <Input
                                  className="ml-auto max-w-[140px] text-right tabular-nums"
                                  value={sup}
                                  onChange={(e) =>
                                    setSupplementaryDraft((d) => ({
                                      ...d,
                                      [row.id]: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(row.balance_consumption ?? "0")}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(row.bare_metal_consumption ?? "0")}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(String(total))}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>成本毛利明细</CardTitle>
                  <CardDescription>
                    platform_cost_monthly · 共 {draftBundle!.cost.length} 条
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
                      发布中…
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
