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
import { IconDownload, IconLoader2, IconPlus, IconUpload } from "@tabler/icons-react"
import { CreateBillingPeriodDialog } from "./_components/create-billing-period-dialog"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { formatMoney, formatText } from "../_lib/display"
import { getPeriodDateRange, isValidPeriodCode } from "../_lib/period"
import { CostGroupedTable } from "../[id]/cost/_components/cost-grouped-table"

type FixedSlotKey = "customer" | "baremetal"

type TenantBillWindowSlot = {
  windowId: string
  windowStart: string
  windowEnd: string
  state: SlotState
}

type SlotState = {
  file: File | null
  status: "empty" | "parsing" | "done" | "error"
  message: string
  rowCount: number
  hasErrorReport: boolean
}

const FIXED_SLOT_LABEL: Record<
  FixedSlotKey,
  { title: string; hint: string; accept: string }
> = {
  customer: {
    title: "客户消费明细",
    hint: "Excel：客户ID、类型、总消费、券消费、余额消费等列",
    accept: ".xlsx,.xls,.csv",
  },
  baremetal: {
    title: "裸金属消费订单列表",
    hint: "Excel：订单ID、租户ID、机房名称、设备型号（卡型 x 卡数）、购买数量（数量 x 时长包）、最终总额、下单时间等列",
    accept: ".xlsx,.xls,.csv",
  },
}

const TENANT_BILL_HINT =
  "Excel 或 CSV：客户ID、总消费、卡时、GPU 型号、区域等列（该时间段内汇总）"

function initialFixedSlots(): Record<FixedSlotKey, SlotState> {
  return {
    customer: { file: null, status: "empty", message: "", rowCount: 0, hasErrorReport: false },
    baremetal: { file: null, status: "empty", message: "", rowCount: 0, hasErrorReport: false },
  }
}

function emptyTenantBillSlot(
  window: { id?: string; windowStart: string; windowEnd: string; sortOrder?: number },
  index: number,
): TenantBillWindowSlot {
  return {
    windowId: window.id ?? `preview-${index}`,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    state: { file: null, status: "empty", message: "", rowCount: 0, hasErrorReport: false },
  }
}

type ImportSlotServerStatus = {
  parseStatus: "ok" | "error" | "empty"
  parseErrorCount: number
  rowCount: number
  hasErrorReport: boolean
}

function buildImportSlotMessage(server: Pick<ImportSlotServerStatus, "parseErrorCount" | "rowCount" | "hasErrorReport"> & { parseStatus: "ok" | "error" }): string {
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
  server: {
    parseStatus: "ok" | "error"
    parseErrorCount: number
    rowCount: number
    hasErrorReport: boolean
  },
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

function syncFixedSlotsFromValidation(
  prev: Record<FixedSlotKey, SlotState>,
  slots: {
    customer?: ImportSlotServerStatus | null
    baremetal?: ImportSlotServerStatus | null
  },
  options?: { skipParsing?: boolean; messageOverrides?: Partial<Record<FixedSlotKey, string>> },
): Record<FixedSlotKey, SlotState> {
  const next = { ...prev }
  const keys: FixedSlotKey[] = ["customer", "baremetal"]
  for (const key of keys) {
    const server = slots[key]
    if (!server || server.parseStatus === "empty") continue
    if (options?.skipParsing && prev[key].status === "parsing") continue
    if (server.parseStatus !== "ok" && server.parseStatus !== "error") continue
    next[key] = applyImportSlotServerStatus(
      prev[key],
      {
        parseStatus: server.parseStatus,
        parseErrorCount: server.parseErrorCount,
        rowCount: server.rowCount,
        hasErrorReport: server.hasErrorReport,
      },
      options?.messageOverrides?.[key],
    )
  }
  return next
}

function syncTenantBillSlotsFromValidation(
  prev: TenantBillWindowSlot[],
  windows: Array<{
    windowId: string
    windowStart: string
    windowEnd: string
    parseStatus: "ok" | "error" | "empty"
    parseErrorCount: number
    rowCount: number
    hasErrorReport: boolean
  }>,
  options?: { skipParsingWindowId?: string; messageOverride?: string },
): TenantBillWindowSlot[] {
  return windows.map((w) => {
    const existing = prev.find((p) => p.windowId === w.windowId)
    if (options?.skipParsingWindowId === w.windowId && existing?.state.status === "parsing") {
      return existing
    }
    if (w.parseStatus === "empty") {
      if (existing?.state.status === "parsing") {
        return existing
      }
      return {
        windowId: w.windowId,
        windowStart: w.windowStart,
        windowEnd: w.windowEnd,
        state: {
          file: existing?.state.file ?? null,
          status: "empty",
          message: "",
          rowCount: 0,
          hasErrorReport: false,
        },
      }
    }
    return {
      windowId: w.windowId,
      windowStart: w.windowStart,
      windowEnd: w.windowEnd,
      state: applyImportSlotServerStatus(
        existing?.state ?? {
          file: null,
          status: "empty",
          message: "",
          rowCount: 0,
          hasErrorReport: false,
        },
        {
          parseStatus: w.parseStatus,
          parseErrorCount: w.parseErrorCount,
          rowCount: w.rowCount,
          hasErrorReport: w.hasErrorReport,
        },
        options?.messageOverride,
      ),
    }
  })
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

const PRICING_FAILURE_LABEL: Record<string, string> = {
  card_type_not_found: "卡型匹配失败",
  region_not_found: "机房匹配失败",
  pricing_pair_not_found: "机房×卡型成本未配置",
  platform_list_price_not_found: "平台刊例价未配置",
}

const BILLING_UNIT_LABEL: Record<string, string> = {
  hour: "小时",
  day: "天",
  week: "周",
  month: "月",
}

function formatWindowRange(windowStart?: string, windowEnd?: string): string {
  if (!windowStart || !windowEnd) return ""
  return `（${windowStart} ~ ${windowEnd}）`
}

function baremetalPlatformIssueDetail(p: {
  regionCode: string
  gpuModel: string
  billingUnit?: string
  orderId?: string
  orderedAt?: string
}): string {
  const unitLabel = p.billingUnit ? BILLING_UNIT_LABEL[p.billingUnit] ?? p.billingUnit : "—"
  const pair = `${p.regionCode} × ${p.gpuModel} · ${unitLabel}租期`
  if (p.orderId) {
    return `订单 ${p.orderId} · ${pair} · 下单日 ${p.orderedAt ?? "—"}`
  }
  return pair
}

function pricingFailureDetail(p: {
  regionCode: string
  gpuModel: string
  failureReason?: string
}): string {
  const label = PRICING_FAILURE_LABEL[p.failureReason ?? ""] ?? "成本配置缺失"
  return `${p.regionCode} × ${p.gpuModel}（${label}）`
}

function pricingPairFailureDetail(p: {
  regionCode: string
  gpuModel: string
  matchedGpuCardTypeId?: string
  matchedDataCenterId?: string
}): string {
  const cardTypeId = p.matchedGpuCardTypeId ?? "—"
  const dataCenterId = p.matchedDataCenterId ?? "—"
  return `${p.regionCode} × ${p.gpuModel} — 卡型 ID：${cardTypeId}，机房 ID：${dataCenterId}`
}

function formatTenantAllocationLabel(issue: {
  tenantPlatformId: string
  customerFullName?: string | null
  tenantName?: string | null
}): string {
  const parts = [`租户 ${issue.tenantPlatformId}`]
  if (issue.customerFullName) parts.push(`客户：${issue.customerFullName}`)
  if (issue.tenantName && issue.tenantName !== issue.customerFullName) {
    parts.push(`计费租户：${issue.tenantName}`)
  }
  return parts.join("，")
}

function ImportPreCheckAlerts({
  validation,
  computeError,
  priceWindowPreview,
}: {
  validation:
    | {
        missingPricing: {
          regionCode: string
          gpuModel: string
          failureReason?: string
          matchedGpuCardTypeId?: string
          matchedDataCenterId?: string
          billingUnit?: string
          windowStart?: string
          windowEnd?: string
          orderId?: string
          orderedAt?: string
        }[]
        pendingAllocationCount: number
        pendingAllocations?: {
          tenantPlatformId: string
          tenantId: string
          tenantName: string | null
          customerFullName: string | null
          reason: "missing_project" | "sum_not_100"
          projects: {
            projectId: string
            projectName: string
            staffName: string | null
            allocationPercent: string | null
          }[]
          missingProjects: {
            projectId: string
            projectName: string
            staffName: string | null
            allocationPercent: string | null
          }[]
          allocationSumPercent: number | null
        }[]
        crossFileOk: boolean
        periodStatus: string
        priceWindowInfo?: {
          hasChanges: boolean
          changedCardTypes: Array<{ code: string; changeDates: string[] }>
        }
      }
    | undefined
  computeError: string | null
  priceWindowPreview?: {
    hasChanges: boolean
    changedCardTypes: Array<{ code: string; changeDates: string[] }>
  }
}) {
  if (!validation && !computeError && !priceWindowPreview?.hasChanges) return null

  const cardTypeIssues = validation?.missingPricing.filter(
    (p) => p.failureReason === "card_type_not_found",
  )
  const regionIssues = validation?.missingPricing.filter(
    (p) => p.failureReason === "region_not_found",
  )
  const pairIssues = validation?.missingPricing.filter(
    (p) => p.failureReason === "pricing_pair_not_found" || !p.failureReason,
  )
  const platformIssues = validation?.missingPricing.filter(
    (p) => p.failureReason === "platform_list_price_not_found",
  )

  const changedCards =
    validation?.priceWindowInfo?.changedCardTypes ??
    priceWindowPreview?.changedCardTypes ??
    []

  return (
    <div className="space-y-3" role="alert">
      {computeError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive whitespace-pre-wrap">
          {computeError}
        </div>
      )}
      {changedCards.length > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">账期内平台刊例价有变动，请按时间段分别上传客户账单详情：</p>
          <ul className="mt-1 list-inside list-disc">
            {changedCards.map((c) => (
              <li key={c.code}>
                {c.code}（调价日：{c.changeDates.join("、")}）
              </li>
            ))}
          </ul>
        </div>
      )}
      {validation && !validation.crossFileOk && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {validation.periodStatus === "import_error"
            ? "存在 B 端未知租户或未通过跨文件校验，请修正对应 Excel 后重新上传（可在各上传区下载错误明细）。"
            : "跨文件校验未通过：请确认客户消费明细、裸金属订单与客户账单详情均已上传成功；若曾上传账单后仍无法计算，请重新上传各时间段客户账单。"}
        </div>
      )}
      {validation && validation.missingPricing.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">以下账单区域×GPU 无法解析成本，计算已阻断：</p>
          {cardTypeIssues && cardTypeIssues.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">卡型匹配问题（请维护 gpu_card_type.code 或修正 Excel 设备型号）：</p>
              <ul className="mt-1 list-inside list-disc">
                {cardTypeIssues.map((p) => (
                  <li key={`card-${p.regionCode}-${p.gpuModel}`}>
                    {pricingFailureDetail(p)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {regionIssues && regionIssues.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">机房匹配问题（请维护机房名称或修正 Excel 机房名称）：</p>
              <ul className="mt-1 list-inside list-disc">
                {regionIssues.map((p) => (
                  <li key={`region-${p.regionCode}-${p.gpuModel}`}>
                    {pricingFailureDetail(p)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pairIssues && pairIssues.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">机房×卡型成本未配置（请在供应商「卡型成本」维护）：</p>
              <ul className="mt-1 list-inside list-disc">
                {pairIssues.map((p) => (
                  <li key={`pair-${p.regionCode}-${p.gpuModel}`}>
                    {pricingPairFailureDetail(p)}
                    {formatWindowRange(p.windowStart, p.windowEnd)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {platformIssues && platformIssues.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">平台刊例价未配置（请在「平台定价」维护）：</p>
              <ul className="mt-1 list-inside list-disc">
                {platformIssues.map((p, idx) => (
                  <li key={`platform-${idx}-${p.gpuModel}-${p.orderId ?? ""}-${p.billingUnit ?? ""}`}>
                    {baremetalPlatformIssueDetail(p)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {validation &&
        (validation.pendingAllocations?.length ?? validation.pendingAllocationCount) > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">
            {validation.pendingAllocationCount} 个租户需先配置成本分成比例（各项目合计 100%）后方可计算：
          </p>
          <ul className="mt-2 space-y-3 list-none pl-0">
            {(validation.pendingAllocations ?? []).map((issue) => (
              <li
                key={issue.tenantPlatformId}
                className="rounded border border-amber-500/30 bg-background/60 px-3 py-2"
              >
                <p className="font-medium">{formatTenantAllocationLabel(issue)}</p>
                {issue.reason === "sum_not_100" ? (
                  <p className="mt-1 text-amber-800 dark:text-amber-100">
                    已填分成合计 {issue.allocationSumPercent?.toFixed(2) ?? "—"}%，须为 100%。
                  </p>
                ) : (
                  <p className="mt-1 text-amber-800 dark:text-amber-100">
                    关联 {issue.projects.length} 个项目，{issue.missingProjects.length}{" "}
                    个未配置分成。
                  </p>
                )}
                <ul className="mt-1 list-inside list-disc text-amber-950/90 dark:text-amber-50/90">
                  {(issue.reason === "sum_not_100" ? issue.projects : issue.missingProjects).map(
                    (project) => (
                      <li key={project.projectId}>
                        {project.projectName}
                        {project.staffName ? `（客户经理：${project.staffName}）` : "（未配置客户经理）"}
                        {project.allocationPercent != null
                          ? ` — 已配 ${project.allocationPercent}%`
                          : " — 未配置分成"}
                      </li>
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-amber-800 dark:text-amber-100">
            请在本账期为各项目填写成本分成比例，或在 CRM 租户详情维护「项目成本分成」预置后重新校验。
          </p>
        </div>
      )}
    </div>
  )
}

function BillingPeriodFormCard({
  periodCode,
  periodStart,
  periodEnd,
  fixedSlots,
  tenantBillSlots,
  computing,
  computingIncome,
  persisting,
  canRunCompute,
  canRunComputeIncome,
  onPeriodCodeChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onPickFixedFile,
  onPickTenantBillFile,
  onDownloadFixedError,
  onDownloadTenantBillError,
  onCompute,
  onComputeIncome,
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
  fixedSlots: Record<FixedSlotKey, SlotState>
  tenantBillSlots: TenantBillWindowSlot[]
  computing: boolean
  computingIncome: boolean
  persisting: boolean
  canRunCompute: boolean
  canRunComputeIncome: boolean
  onPeriodCodeChange: (v: string) => void
  onPeriodStartChange: (v: string) => void
  onPeriodEndChange: (v: string) => void
  onPickFixedFile: (slot: FixedSlotKey, file: File | null) => void
  onPickTenantBillFile: (windowId: string, file: File | null) => void
  onDownloadFixedError: (slot: FixedSlotKey) => void
  onDownloadTenantBillError: (windowId: string) => void
  onCompute: () => void
  onComputeIncome: () => void
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
          {(Object.keys(FIXED_SLOT_LABEL) as FixedSlotKey[]).map((key) => {
            const meta = FIXED_SLOT_LABEL[key]
            const st = fixedSlots[key]
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
                          onPickFixedFile(key, f)
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
                      onClick={() => onDownloadFixedError(key)}
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

          {tenantBillSlots.map((windowSlot) => {
            const st = windowSlot.state
            return (
              <div
                key={windowSlot.windowId}
                className="rounded-lg border bg-muted/30 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      客户账单详情（{windowSlot.windowStart} ~ {windowSlot.windowEnd}）
                    </p>
                    <p className="text-xs text-muted-foreground">{TENANT_BILL_HINT}</p>
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
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          onPickTenantBillFile(windowSlot.windowId, f)
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
                      onClick={() => onDownloadTenantBillError(windowSlot.windowId)}
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
        <Button
          type="button"
          variant="outline"
          disabled={!canRunComputeIncome || computing || computingIncome || persisting}
          onClick={onComputeIncome}
        >
          {computingIncome ? (
            <>
              <IconLoader2 className="mr-2 size-4 animate-spin" />
              计算收入中…
            </>
          ) : (
            "计算收入"
          )}
        </Button>
        <Button type="button" disabled={!canRunCompute || computing || computingIncome} onClick={onCompute}>
          {computing ? (
            <>
              <IconLoader2 className="mr-2 size-4 animate-spin" />
              成本计算中…
            </>
          ) : (
            "计算成本"
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
  const [fixedSlots, setFixedSlots] = useState<Record<FixedSlotKey, SlotState>>(initialFixedSlots)
  const [tenantBillSlots, setTenantBillSlots] = useState<TenantBillWindowSlot[]>([])
  const [computing, setComputing] = useState(false)
  const [computingIncome, setComputingIncome] = useState(false)
  const [persisting, setPersisting] = useState(false)
  const [computeError, setComputeError] = useState<string | null>(null)
  const [supplementaryDraft, setSupplementaryDraft] = useState<Record<string, string>>({})
  const [savingSupplementary, setSavingSupplementary] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const createPeriod = trpc.finance.periods.create.useMutation()
  const importFile = trpc.finance.periods.importFile.useMutation()
  const computeCostPeriod = trpc.finance.periods.computeCost.useMutation()
  const computeIncomePeriod = trpc.finance.periods.computeIncome.useMutation()
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

  const datesReady =
    Boolean(periodStart) && Boolean(periodEnd) && periodStart <= periodEnd

  const { data: priceWindowPreview } = trpc.finance.periods.detectPriceWindows.useQuery(
    { periodStart, periodEnd },
    { enabled: datesReady },
  )

  useEffect(() => {
    if (!existingPeriod || periodId) return
    setPeriodId(existingPeriod.id)
    setPeriodCode(existingPeriod.period_code)
    setPeriodStart(existingPeriod.period_start)
    setPeriodEnd(existingPeriod.period_end)
    setFixedSlots(initialFixedSlots())
    setTenantBillSlots([])
    setComputeError(null)
  }, [existingPeriod, periodId])

  useEffect(() => {
    if (validation?.slots) {
      setFixedSlots((prev) =>
        syncFixedSlotsFromValidation(prev, validation.slots, { skipParsing: true }),
      )
    }
    if (validation?.slots?.tenantBillWindows) {
      setTenantBillSlots((prev) =>
        syncTenantBillSlotsFromValidation(prev, validation.slots.tenantBillWindows),
      )
    } else if (validation?.windows?.length) {
      setTenantBillSlots((prev) => {
        const next = validation.windows.map((w, index) => {
          const existing = prev.find((p) => p.windowId === w.id)
          return (
            existing ?? {
              windowId: w.id,
              windowStart: w.windowStart,
              windowEnd: w.windowEnd,
              state: {
                file: null,
                status: "empty" as const,
                message: "",
                rowCount: 0,
                hasErrorReport: false,
              },
            }
          )
        })
        return next
      })
    }
  }, [validation])

  useEffect(() => {
    if (periodId || !priceWindowPreview?.windows?.length) return
    setTenantBillSlots((prev) => {
      if (prev.length > 0 && !prev[0]?.windowId.startsWith("preview-")) return prev
      return priceWindowPreview.windows.map((w, index) =>
        emptyTenantBillSlot(w, index),
      )
    })
  }, [periodId, priceWindowPreview])

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
    setFixedSlots(initialFixedSlots())
    setTenantBillSlots([])
    setComputeError(null)
  }, [])

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

  const onDownloadFixedError = useCallback(
    async (slot: FixedSlotKey) => {
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

  const onDownloadTenantBillError = useCallback(
    async (windowId: string) => {
      if (!periodId) return
      try {
        const report = await utils.finance.periods.downloadImportErrorReport.fetch({
          billingPeriodId: periodId,
          slot: "tenantBill",
          windowId,
        })
        downloadBase64File(report.fileName, report.fileBase64)
      } catch (e) {
        setComputeError(e instanceof Error ? e.message : "下载失败")
      }
    },
    [periodId, utils.finance.periods.downloadImportErrorReport],
  )

  const onPickFixedFile = useCallback(
    async (slot: FixedSlotKey, file: File | null) => {
      if (!file) {
        setFixedSlots((s) => ({
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
      setFixedSlots((s) => ({
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
        setFixedSlots((prev) => {
          const withFile = { ...prev, [slot]: { ...prev[slot], file } }
          const messageOverrides: Partial<Record<FixedSlotKey, string>> = {}
          if (!result.ok && result.message) {
            messageOverrides[slot] = result.message
          }
          if (freshValidation?.slots) {
            return syncFixedSlotsFromValidation(withFile, freshValidation.slots, {
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
        setFixedSlots((s) => ({
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

  const onPickTenantBillFile = useCallback(
    async (windowId: string, file: File | null) => {
      if (!file) {
        setTenantBillSlots((prev) =>
          prev.map((w) =>
            w.windowId === windowId
              ? {
                  ...w,
                  state: {
                    file: null,
                    status: "empty",
                    message: "",
                    rowCount: 0,
                    hasErrorReport: false,
                  },
                }
              : w,
          ),
        )
        return
      }
      if (!isValidPeriodCode(periodCode) || !periodStart || !periodEnd) {
        setComputeError("请先填写正确格式的账期编码（YYYY-MM）与起止日期")
        return
      }
      setComputeError(null)
      setTenantBillSlots((prev) =>
        prev.map((w) =>
          w.windowId === windowId
            ? {
                ...w,
                state: {
                  file,
                  status: "parsing",
                  message: "正在上传并解析…",
                  rowCount: 0,
                  hasErrorReport: false,
                },
              }
            : w,
        ),
      )
      try {
        const id = await ensurePeriod()
        const { data: freshValidationBefore } = await refetchValidation()
        const resolvedWindowId =
          freshValidationBefore?.windows?.find(
            (w) =>
              w.id === windowId ||
              (w.windowStart ===
                tenantBillSlots.find((s) => s.windowId === windowId)?.windowStart &&
                w.windowEnd ===
                  tenantBillSlots.find((s) => s.windowId === windowId)?.windowEnd),
          )?.id ?? windowId

        if (resolvedWindowId.startsWith("preview-")) {
          throw new Error("账期时间段尚未就绪，请稍后重试")
        }

        void utils.finance.periods.validate.invalidate({ billingPeriodId: id })
        const fileBase64 = await fileToBase64(file)
        const result = await importFile.mutateAsync({
          billingPeriodId: id,
          slot: "tenantBill",
          fileName: file.name,
          fileBase64,
          windowId: resolvedWindowId,
        })
        const { data: freshValidation } = await refetchValidation()
        setTenantBillSlots((prev) => {
          if (freshValidation?.slots?.tenantBillWindows) {
            return syncTenantBillSlotsFromValidation(
              prev.map((w) =>
                w.windowId === windowId ? { ...w, windowId: resolvedWindowId, state: { ...w.state, file } } : w,
              ),
              freshValidation.slots.tenantBillWindows,
              {
                skipParsingWindowId: resolvedWindowId,
                messageOverride: result.ok ? undefined : result.message,
              },
            )
          }
          return prev.map((w) =>
            w.windowId === windowId || w.windowId === resolvedWindowId
              ? {
                  ...w,
                  windowId: resolvedWindowId,
                  state: applyImportSlotServerStatus(
                    { ...w.state, file },
                    {
                      parseStatus: result.ok ? "ok" : "error",
                      parseErrorCount: result.parseErrorCount,
                      rowCount: result.rowCount,
                      hasErrorReport: result.hasErrorReport,
                    },
                    result.message,
                  ),
                }
              : w,
          )
        })
        await utils.finance.periods.getBundle.invalidate({ id })
      } catch (e) {
        setTenantBillSlots((prev) =>
          prev.map((w) =>
            w.windowId === windowId
              ? {
                  ...w,
                  state: {
                    file,
                    status: "error",
                    message: e instanceof Error ? e.message : "导入失败",
                    rowCount: 0,
                    hasErrorReport: false,
                  },
                }
              : w,
          ),
        )
      }
    },
    [
      ensurePeriod,
      importFile,
      periodCode,
      periodEnd,
      periodStart,
      refetchValidation,
      tenantBillSlots,
      utils.finance.periods.getBundle,
    ],
  )

  const incomeImportsParsed =
    fixedSlots.customer.status === "done" && fixedSlots.baremetal.status === "done"

  const costImportsParsed =
    tenantBillSlots.length > 0 &&
    tenantBillSlots.every((w) => w.state.status === "done") &&
    fixedSlots.baremetal.status === "done"

  const canRunCompute =
    isValidPeriodCode(periodCode) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    costImportsParsed &&
    (validation?.canComputeCost ?? validation?.canCompute ?? false) &&
    !computing &&
    !computingIncome &&
    !persisting &&
    periodStart <= periodEnd

  const canRunComputeIncome =
    isValidPeriodCode(periodCode) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    incomeImportsParsed &&
    (validation?.canComputeIncome ?? false) &&
    !computing &&
    !computingIncome &&
    !persisting &&
    periodStart <= periodEnd

  const handleComputeIncome = async () => {
    if (!canRunComputeIncome) return
    setComputingIncome(true)
    setComputeError(null)
    try {
      const id = await ensurePeriod()
      await computeIncomePeriod.mutateAsync({ billingPeriodId: id })
      await utils.finance.periods.getBundle.invalidate({ id })
      await refetchValidation()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "计算收入失败"
      setComputeError(msg)
      if (periodId) await refetchValidation()
    } finally {
      setComputingIncome(false)
    }
  }

  const handleCompute = async () => {
    if (!canRunCompute) return
    setComputing(true)
    setComputeError(null)
    try {
      const id = await ensurePeriod()
      await computeCostPeriod.mutateAsync({ billingPeriodId: id })
      await utils.finance.periods.getBundle.invalidate({ id })
      await refetchValidation()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "计算成本失败"
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
  const hasFullResult =
    draftBundle?.period?.status === "computed" ||
    draftBundle?.period?.status === "published"
  const hasIncomePreview = (draftBundle?.income?.length ?? 0) > 0

  const preCheckAlerts = (
    <ImportPreCheckAlerts
      validation={validation}
      computeError={computeError}
      priceWindowPreview={priceWindowPreview}
    />
  )

  const isEditingExisting = Boolean(editPeriodId || periodId)

  const formCard = (
    <BillingPeriodFormCard
      periodCode={periodCode}
      periodStart={periodStart}
      periodEnd={periodEnd}
      fixedSlots={fixedSlots}
      tenantBillSlots={tenantBillSlots}
      computing={computing}
      computingIncome={computingIncome}
      persisting={persisting}
      canRunCompute={canRunCompute}
      canRunComputeIncome={canRunComputeIncome}
      preCheckAlerts={preCheckAlerts}
      readOnlyMeta={isEditingExisting}
      title={isEditingExisting ? "重新上传账期" : undefined}
      description={
        isEditingExisting
          ? "账期元数据不可修改。请重新上传 Excel，全部解析成功后点击「计算」。"
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
      onPickFixedFile={(slot, file) => void onPickFixedFile(slot, file)}
      onPickTenantBillFile={(windowId, file) => void onPickTenantBillFile(windowId, file)}
      onDownloadFixedError={(slot) => void onDownloadFixedError(slot)}
      onDownloadTenantBillError={(windowId) => void onDownloadTenantBillError(windowId)}
      onCompute={() => void handleCompute()}
      onComputeIncome={() => void handleComputeIncome()}
      onCancelHref="/finance"
      compact={hasFullResult}
    />
  )

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <LocaleLink href="/finance">← 返回账期列表</LocaleLink>
          </Button>
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <IconPlus className="mr-2 size-4" />
            添加账期
          </Button>
        </div>

        <CreateBillingPeriodDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onPeriodReady={(period) => {
            // 静态阶段：接入 tRPC 后在此设置 periodId 并刷新页面数据
            console.info("[static] period ready", period)
          }}
        />

        {!hasFullResult ? (
          <div className="space-y-6">
            {formCard}
            {hasIncomePreview && draftBundle && (
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>收入明细（SQL 计算预览）</CardTitle>
                    <CardDescription>
                      仅收入已计算 · 共 {draftBundle.income.length} 条 · 完成客户账单上传后可点击「计算」生成成本
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingSupplementary || computing || computingIncome}
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
                          <th className="px-3 py-2 text-left whitespace-nowrap">项目名称</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">客户全称</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">租户Id</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">补充消费</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">余额消费</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">线上裸金属消费</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">总消费</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftBundle.income.map((row) => {
                          const sup = supplementaryDraft[row.id] ?? "0"
                          const total =
                            (Number(sup) || 0) +
                            (Number(row.balance_consumption ?? 0) || 0) +
                            (Number(row.bare_metal_consumption ?? 0) || 0)
                          return (
                            <tr key={row.id} className="border-b">
                              <td className="px-3 py-2">{formatText(row.project_name)}</td>
                              <td className="max-w-[200px] px-3 py-2">
                                {formatText(row.customer_full_name ?? row.tenant_name)}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {row.tenant_platform_id}
                              </td>
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
                              <td className="px-3 py-2 text-right font-medium tabular-nums">
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
            )}
          </div>
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
                    disabled={savingSupplementary || computing || computingIncome}
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
                          <th className="px-3 py-2 text-left whitespace-nowrap">项目名称</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">客户全称</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">租户Id</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">补充消费</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">余额消费</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">线上裸金属消费</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">总消费</th>
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
                              <td className="px-3 py-2">{formatText(row.project_name)}</td>
                              <td className="max-w-[200px] px-3 py-2">
                                {formatText(row.customer_full_name ?? row.tenant_name)}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {row.tenant_platform_id}
                              </td>
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
                              <td className="px-3 py-2 text-right font-medium tabular-nums">
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
                  disabled={persisting || computing || computingIncome}
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
