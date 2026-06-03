"use client"

import { formatMoney } from "@/app/[locale]/(protected)/finance/_lib/display"
import { isPublishedPeriodStatus } from "@/app/[locale]/(protected)/finance/_lib/period"
import {
  downloadExcludedProjectTenantsExcel,
  formatExcludedProjectTenantsMarkdown,
} from "@/lib/finance/excluded-project-tenants-export"
import { downloadPersonalIncomeSummaryExcel } from "@/lib/finance/personal-income-summary-export"
import {
  buildImportParseFailureMessage,
  buildImportSuccessMessage,
  downloadBase64Excel,
} from "@/lib/finance/import-error-download"
import { CopyToClipboard } from "@/components/shared/copy-to-clipboard"
import {
  PERSONAL_BAREMETAL_HINT,
  PERSONAL_INCOME_SUMMARY_KINDS,
  PERSONAL_TENANT_BILL_HINT,
  personalIncomeSummaryKindLabel,
} from "@/lib/finance/personal-income-labels"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { fileToBase64 } from "@/lib/utils/file-to-base64"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { IconDownload, IconLoader2, IconUpload } from "@tabler/icons-react"
import { AlertCircle, Calculator, Download, RotateCcw } from "lucide-react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type PersonalImportSlot = "personalTenantBill" | "personalBaremetal"

type SlotState = {
  file: File | null
  status: "empty" | "parsing" | "done" | "error"
  message: string
  rowCount: number
  hasErrorReport: boolean
  parseErrorCount: number
}

function emptySlot(): SlotState {
  return {
    file: null,
    status: "empty",
    message: "",
    rowCount: 0,
    hasErrorReport: false,
    parseErrorCount: 0,
  }
}

function slotStateFromBatch(batch: {
  file_name: string
  parse_status: string
  parse_error_count: number
  row_count: number
  has_error_report: boolean
}): SlotState {
  if (batch.parse_status === "ok") {
    return {
      file: null,
      status: "done",
      message: buildImportSuccessMessage(batch.row_count),
      rowCount: batch.row_count,
      hasErrorReport: false,
      parseErrorCount: 0,
    }
  }
  return {
    file: null,
    status: "error",
    message: buildImportParseFailureMessage({
      parseErrorCount: batch.parse_error_count,
      hasErrorReport: batch.has_error_report,
    }),
    rowCount: 0,
    hasErrorReport: batch.has_error_report,
    parseErrorCount: batch.parse_error_count,
  }
}

function SlotUploadRow({
  label,
  hint,
  accept,
  state,
  disabled,
  onFile,
  onDownloadError,
}: {
  label: string
  hint: string
  accept: string
  state: SlotState
  disabled?: boolean
  onFile: (file: File | null) => void
  onDownloadError?: () => void
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        {state.status === "parsing" && (
          <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
        )}
        {state.status === "done" && (
          <Badge variant="secondary">已解析 {state.rowCount} 行</Badge>
        )}
        {state.status === "error" && (
          <Badge variant="destructive">
            {state.parseErrorCount > 0
              ? `${state.parseErrorCount} 处错误`
              : "解析失败"}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" asChild disabled={disabled}>
          <label className="cursor-pointer">
            <IconUpload className="mr-1 size-4" />
            选择文件
            <input
              type="file"
              accept={accept}
              className="sr-only"
              disabled={disabled || state.status === "parsing"}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ""
                if (f) onFile(f)
              }}
            />
          </label>
        </Button>
        {state.file ? (
          <span className="text-muted-foreground text-sm truncate max-w-[220px]">
            {state.file.name}
          </span>
        ) : null}
        {state.hasErrorReport && onDownloadError ? (
          <Button type="button" variant="outline" size="sm" onClick={onDownloadError}>
            <IconDownload className="mr-1 size-4" />
            下载错误明细 Excel
          </Button>
        ) : null}
      </div>
      {state.status !== "empty" && state.message ? (
        <p
          className={
            state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  )
}

export default function FinancePeriodPersonalIncomePage() {
  const params = useParams<{ id: string }>()
  const id = params.id ?? ""

  const utils = trpc.useUtils()
  const { data: bundle, isLoading, refetch } = trpc.finance.periods.getPersonalBundle.useQuery(
    { billingPeriodId: id },
    { enabled: Boolean(id) },
  )

  const importFile = trpc.finance.periods.importFile.useMutation()
  const computePersonal = trpc.finance.periods.computePersonalIncome.useMutation()
  const purgePersonal = trpc.finance.periods.purgePersonalIncome.useMutation()

  const [tenantBill, setTenantBill] = useState<SlotState>(emptySlot())
  const [baremetal, setBaremetal] = useState<SlotState>(emptySlot())
  const [computeError, setComputeError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const period = bundle?.period
  const validation = bundle?.validation
  const periodPublished = period ? isPublishedPeriodStatus(period.status) : false

  const displaySummaries = useMemo(() => {
    const rows = bundle?.summaries ?? []
    const order = [
      PERSONAL_INCOME_SUMMARY_KINDS.nonProject,
      PERSONAL_INCOME_SUMMARY_KINDS.blacklist,
    ]
    return order
      .map((kind) => rows.find((r) => r.summary_kind === kind))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
  }, [bundle?.summaries])

  const syncSlotsFromBundle = useCallback(() => {
    const tb = bundle?.batches.tenant_bill
    const bm = bundle?.batches.baremetal
    setTenantBill((prev) => {
      if (prev.status === "parsing") return prev
      if (!tb) return emptySlot()
      return slotStateFromBatch(tb)
    })
    setBaremetal((prev) => {
      if (prev.status === "parsing") return prev
      if (!bm) return emptySlot()
      return slotStateFromBatch(bm)
    })
  }, [bundle?.batches])

  useEffect(() => {
    syncSlotsFromBundle()
  }, [syncSlotsFromBundle])

  const downloadImportError = useCallback(
    async (slot: PersonalImportSlot) => {
      setComputeError(null)
      try {
        const report = await utils.finance.periods.downloadImportErrorReport.fetch({
          billingPeriodId: id,
          slot,
        })
        downloadBase64Excel(report.fileName, report.fileBase64)
      } catch (e) {
        setComputeError(e instanceof Error ? e.message : "下载错误明细失败")
      }
    },
    [id, utils.finance.periods.downloadImportErrorReport],
  )

  const applyImportResult = (
    file: File,
    result: {
      ok: boolean
      message: string
      rowCount: number
      parseErrorCount: number
      hasErrorReport: boolean
    },
  ): SlotState => {
    if (result.ok) {
      return {
        file,
        status: "done",
        message: buildImportSuccessMessage(result.rowCount),
        rowCount: result.rowCount,
        hasErrorReport: false,
        parseErrorCount: 0,
      }
    }
    return {
      file,
      status: "error",
      message: buildImportParseFailureMessage({
        message: result.message,
        parseErrorCount: result.parseErrorCount,
        hasErrorReport: result.hasErrorReport,
      }),
      rowCount: 0,
      hasErrorReport: result.hasErrorReport,
      parseErrorCount: result.parseErrorCount,
    }
  }

  const uploadTenantBill = async (file: File) => {
    setComputeError(null)
    setTenantBill({
      file,
      status: "parsing",
      message: "正在上传并解析…",
      rowCount: 0,
      hasErrorReport: false,
      parseErrorCount: 0,
    })
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await importFile.mutateAsync({
        billingPeriodId: id,
        slot: "personalTenantBill",
        fileName: file.name,
        fileBase64,
      })
      setTenantBill(applyImportResult(file, result))
      await refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "账单详情上传失败"
      setTenantBill({
        file,
        status: "error",
        message: msg,
        rowCount: 0,
        hasErrorReport: false,
        parseErrorCount: 0,
      })
    }
  }

  const uploadBaremetal = async (file: File) => {
    setComputeError(null)
    setBaremetal({
      file,
      status: "parsing",
      message: "正在上传并解析…",
      rowCount: 0,
      hasErrorReport: false,
      parseErrorCount: 0,
    })
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await importFile.mutateAsync({
        billingPeriodId: id,
        slot: "personalBaremetal",
        fileName: file.name,
        fileBase64,
      })
      setBaremetal(applyImportResult(file, result))
      await refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "裸金属订单上传失败"
      setBaremetal({
        file,
        status: "error",
        message: msg,
        rowCount: 0,
        hasErrorReport: false,
        parseErrorCount: 0,
      })
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setComputeError(null)
    try {
      await purgePersonal.mutateAsync({ billingPeriodId: id })
      setTenantBill(emptySlot())
      setBaremetal(emptySlot())
      await refetch()
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "重新生成清理失败")
    } finally {
      setRegenerating(false)
    }
  }

  const handleCompute = async () => {
    setComputeError(null)
    try {
      await computePersonal.mutateAsync({ billingPeriodId: id })
      await refetch()
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "计算个人收入失败")
    }
  }

  const canCompute =
    Boolean(validation?.canCompute) &&
    !periodPublished &&
    !computePersonal.isPending &&
    !importFile.isPending

  const excludedProjectTenants = validation?.excludedProjectTenants ?? []

  const excludedMarkdown = useMemo(
    () =>
      formatExcludedProjectTenantsMarkdown(excludedProjectTenants, {
        periodCode: period?.period_code,
      }),
    [excludedProjectTenants, period?.period_code],
  )

  const handleDownloadExcludedExcel = () => {
    if (!period) return
    const ok = downloadExcludedProjectTenantsExcel({
      rows: excludedProjectTenants,
      periodCode: period.period_code,
    })
    if (ok) toast.success("已排除租户列表 Excel 已下载")
    else toast.error("暂无数据可导出")
  }

  const handleDownloadSummaryExcel = () => {
    if (!period) return
    const ok = downloadPersonalIncomeSummaryExcel({
      rows: displaySummaries,
      periodCode: period.period_code,
    })
    if (ok) toast.success("收入汇总 Excel 已下载")
    else toast.error("暂无汇总数据可导出")
  }

  if (!id) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">无效账期 ID</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">加载中…</p>
      </div>
    )
  }

  if (!period) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">未找到该账期。</p>
        <Button variant="link" asChild className="mt-2 px-0">
          <LocaleLink href="/finance">返回账期列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-background p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href="/finance">← 账期列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/income`}>企业收入</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/cost`}>成本</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>个人收入 · {period.period_code}</CardTitle>
          <CardDescription>
            账期 {period.period_start} ~ {period.period_end}。统计未关联经营项目的租户；黑名单按
            当前封禁匹配。与企业收入数据隔离。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {validation?.messages && validation.messages.length > 0 ? (
            <Alert variant={validation.canCompute ? "default" : "destructive"}>
              <AlertCircle className="size-4" />
              <AlertTitle>数据就绪检查</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {validation.messages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                {validation.tenantsPersonal > 0 ? (
                  <p className="mt-2">
                    将纳入计算的非项目租户约 {validation.tenantsPersonal} 个（Excel 去重{" "}
                    {validation.tenantsInExcel} 个，排除项目关联{" "}
                    {validation.tenantsExcludedProject} 个）。
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {computeError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>操作失败</AlertTitle>
              <AlertDescription>{computeError}</AlertDescription>
            </Alert>
          ) : null}

          {periodPublished ? (
            <Alert>
              <AlertTitle>账期已发布</AlertTitle>
              <AlertDescription>须先在账期管理中撤回发布，方可重新上传或计算。</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={regenerating || purgePersonal.isPending || periodPublished}
              onClick={() => void handleRegenerate()}
            >
              <RotateCcw className="size-4" />
              重新生成（清空导入与汇总）
            </Button>
            <Button
              size="sm"
              className="gap-2"
              disabled={!canCompute}
              onClick={() => void handleCompute()}
            >
              {computePersonal.isPending ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <Calculator className="size-4" />
              )}
              计算个人收入
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>上传 Excel</CardTitle>
          <CardDescription>
            两类文件均必填；格式与企业/成本路径一致。解析失败时可下载标注 Excel：错误单元格标红，并增加「错误说明」列逐行说明。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SlotUploadRow
            label="客户账单详情"
            hint={PERSONAL_TENANT_BILL_HINT}
            accept=".xlsx,.xls,.csv"
            state={tenantBill}
            disabled={periodPublished || regenerating}
            onFile={(f) => f && void uploadTenantBill(f)}
            onDownloadError={
              tenantBill.hasErrorReport
                ? () => void downloadImportError("personalTenantBill")
                : undefined
            }
          />
          <SlotUploadRow
            label="裸金属消费订单"
            hint={PERSONAL_BAREMETAL_HINT}
            accept=".xlsx,.xls,.csv"
            state={baremetal}
            disabled={periodPublished || regenerating}
            onFile={(f) => f && void uploadBaremetal(f)}
            onDownloadError={
              baremetal.hasErrorReport
                ? () => void downloadImportError("personalBaremetal")
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>收入汇总</CardTitle>
            <CardDescription>
              {displaySummaries.length > 0
                ? "已计算；黑名单子集为当前封禁且属于非项目租户的部分。"
                : "上传两类 Excel 后点击「计算个人收入」。"}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            disabled={displaySummaries.length === 0}
            onClick={handleDownloadSummaryExcel}
          >
            <Download className="size-4" />
            下载 Excel
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>汇总类型</TableHead>
                <TableHead className="text-right">余额消费</TableHead>
                <TableHead className="text-right">线上裸金属消费</TableHead>
                <TableHead className="text-right">总消费</TableHead>
                <TableHead className="text-right">租户数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySummaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    暂无汇总数据
                  </TableCell>
                </TableRow>
              ) : (
                displaySummaries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {personalIncomeSummaryKindLabel(row.summary_kind)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.balance_consumption)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.bare_metal_consumption)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.total_consumption)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.matched_tenant_count}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {excludedProjectTenants.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>已排除的项目关联租户</CardTitle>
              <CardDescription>
                以下租户已关联经营项目，不计入个人收入汇总。共 {excludedProjectTenants.length}{" "}
                个。
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDownloadExcludedExcel}
              >
                <Download className="size-4" />
                下载 Excel
              </Button>
              <div className="flex items-center gap-1 rounded-md border bg-background pl-2 pr-1">
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  复制 Markdown
                </span>
                <CopyToClipboard
                  text={excludedMarkdown}
                  tooltip="复制 Markdown 表格"
                  successMessage="Markdown 已复制到剪贴板"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-64 overflow-auto">
            <ul className="text-sm space-y-1">
              {excludedProjectTenants.map((t) => (
                <li key={t.platform_tenant_id}>
                  <span className="font-mono">{t.platform_tenant_id}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {t.project_names.join("、")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
