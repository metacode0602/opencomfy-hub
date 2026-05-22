"use client"

import * as React from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { IconAlertTriangle, IconCloudDownload, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type {
  BillDetailPreviewItem,
  MetalOrderPreviewItem,
  MonthlyBillPreviewItem,
  RechargePreviewItem,
  TenantBillingImportAction,
  TenantBillingImportCommitResult,
  TenantBillingImportDialogPhase,
  TenantBillingImportPreviewResult,
  TenantBillingImportTab,
} from "@/lib/types/tenant-billing-import"

const TAB_CONFIG: { value: TenantBillingImportTab; label: string }[] = [
  { value: "metalOrders", label: "裸金属订单" },
  { value: "monthlyBills", label: "月度账单" },
  { value: "recharges", label: "充值" },
  { value: "billDetails", label: "账单明细" },
]

function formatRmb(amount: number) {
  return `¥${amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function actionBadge(action: TenantBillingImportAction) {
  switch (action) {
    case "create":
      return <Badge variant="default">新增</Badge>
    case "update":
      return <Badge variant="secondary">更新</Badge>
    case "skip":
      return <Badge variant="outline">跳过</Badge>
  }
}

function formatCommitSummary(result: TenantBillingImportCommitResult) {
  const parts: string[] = []
  const push = (label: string, s: { created: number; updated: number }) => {
    if (s.created + s.updated > 0) {
      parts.push(`${label} 新增 ${s.created} / 更新 ${s.updated}`)
    }
  }
  push("裸金属", result.metalOrders)
  push("月度账单", result.monthlyBills)
  push("充值", result.recharges)
  if ((result.billDetails.created ?? 0) + (result.billDetails.updated ?? 0) > 0) {
    parts.push(`账单明细 ${result.billDetails.created ?? 0} 行`)
  }
  return parts.join("；") || "无变更"
}

function collectCommitErrors(result: TenantBillingImportCommitResult): string[] {
  const errors: string[] = []
  for (const [label, section] of [
    ["裸金属", result.metalOrders],
    ["月度账单", result.monthlyBills],
    ["充值", result.recharges],
    ["账单明细", result.billDetails],
  ] as const) {
    for (const err of section.errors) {
      errors.push(`${label} · ${err.key}: ${err.message}`)
    }
  }
  return errors
}

function previewSummary(preview: TenantBillingImportPreviewResult) {
  const sections = Object.values(preview.sections)
  const errors = sections.filter((s) => s.error).length
  const total = sections.reduce((n, s) => n + s.summary.total, 0)
  const toWrite = sections.reduce((n, s) => n + s.summary.toCreate + s.summary.toUpdate, 0)
  return { errors, total, toWrite }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantName: string
  platformTenantId?: string
  tenantId: string
  onImported?: () => void
}

export function CrmTenantBillingImportDialog({
  open,
  onOpenChange,
  tenantName,
  platformTenantId,
  tenantId,
  onImported,
}: Props) {
  const fetchPreview = trpc.crm.tenants.fetchBillingImportPreview.useMutation()
  const commitImport = trpc.crm.tenants.commitBillingImport.useMutation()
  const [phase, setPhase] = React.useState<TenantBillingImportDialogPhase>("idle")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [dateSnapshot, setDateSnapshot] = React.useState({ start: "", end: "" })
  const [activeTab, setActiveTab] = React.useState<TenantBillingImportTab>("metalOrders")
  const [preview, setPreview] = React.useState<TenantBillingImportPreviewResult | null>(null)

  const resetState = React.useCallback(() => {
    setPhase("idle")
    setPreview(null)
    setActiveTab("metalOrders")
    setDateSnapshot({ start: "", end: "" })
  }, [])

  React.useEffect(() => {
    if (!open) {
      resetState()
      setStartDate("")
      setEndDate("")
    }
  }, [open, resetState])

  const onDateChange = (field: "start" | "end", value: string) => {
    if (field === "start") setStartDate(value)
    else setEndDate(value)
    if (preview) {
      setPreview(null)
      setPhase("idle")
      setDateSnapshot({ start: "", end: "" })
    }
  }

  const onConfirmFetch = async () => {
    if (!platformTenantId?.trim()) {
      toast.error("该租户未关联平台 ID，请先从平台导入租户")
      return
    }

    setPhase("fetching")
    try {
      const result = await fetchPreview.mutateAsync({
        tenantId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      setPreview(result)
      setDateSnapshot({ start: startDate, end: endDate })
      setPhase("preview")

      const { errors, total, toWrite } = previewSummary(result)
      if (errors > 0) {
        toast.warning(`已拉取 ${total} 条预览，${errors} 类数据源异常，请查看 Tab 提示`)
      } else if (total === 0) {
        toast.info("当前条件下平台无账单数据")
      } else if (toWrite === 0) {
        toast.info(`已拉取 ${total} 条，均已同步，无需导入`)
      } else {
        toast.success(`已拉取 ${total} 条，预计写入 ${toWrite} 条`)
      }
    } catch (e) {
      setPhase("idle")
      toast.error(e instanceof Error ? e.message : "拉取失败，请稍后重试")
    }
  }

  const onConfirmImport = async () => {
    if (!preview) return
    setPhase("committing")
    try {
      const result = await commitImport.mutateAsync({ previewId: preview.previewId })
      const commitErrors = collectCommitErrors(result)
      if (commitErrors.length > 0) {
        toast.warning(`部分写入失败：${formatCommitSummary(result)}`, {
          description: commitErrors.slice(0, 3).join("\n"),
        })
      } else {
        toast.success(`导入完成：${formatCommitSummary(result)}`)
      }
      onImported?.()
      onOpenChange(false)
    } catch (e) {
      setPhase("preview")
      toast.error(e instanceof Error ? e.message : "导入失败，请重新确认后再试")
    }
  }

  const tabCount = (tab: TenantBillingImportTab) => {
    if (!preview) return null
    const s = preview.sections[tab]
    if (s.error) return "!"
    return s.summary.total
  }

  const canImport =
    phase === "preview" &&
    preview != null &&
    previewSummary(preview).toWrite > 0
  const isBusy = phase === "fetching" || phase === "committing" || fetchPreview.isPending || commitImport.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[80vw] max-w-[80vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b px-4 py-4 sm:px-6">
          <DialogTitle>从平台同步账单</DialogTitle>
          <DialogDescription>
            点击「确认」从算算力平台拉取数据；切换 Tab 预览各类账单；「确认导入」写入 CRM 数据库。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadonlyField label="租户" value={tenantName} />
            <ReadonlyField
              label="平台租户 ID"
              value={platformTenantId?.trim() || "— 未关联"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="billing-start">开始日期（可选）</Label>
              <Input
                id="billing-start"
                type="date"
                value={startDate}
                disabled={isBusy}
                onChange={(e) => onDateChange("start", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-end">结束日期（可选）</Label>
              <Input
                id="billing-end"
                type="date"
                value={endDate}
                disabled={isBusy}
                onChange={(e) => onDateChange("end", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void onConfirmFetch()}
              disabled={isBusy || !platformTenantId?.trim()}
            >
              {phase === "fetching" ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  拉取中（限流请求平台）…
                </>
              ) : (
                <>
                  <IconCloudDownload className="mr-2 size-4" />
                  确认
                </>
              )}
            </Button>
            {preview ? (
              <span className="text-muted-foreground text-xs">
                已拉取预览 ·{" "}
                {dateSnapshot.start || dateSnapshot.end
                  ? `${dateSnapshot.start || "—"} ~ ${dateSnapshot.end || "—"}`
                  : "全部历史"}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                点击「确认」后开始从平台获取数据
              </span>
            )}
          </div>

          {preview ? (
            <Alert>
              <AlertDescription className="text-xs sm:text-sm">
                预览就绪：共 {previewSummary(preview).total} 条，预计写入{" "}
                {previewSummary(preview).toWrite} 条（跳过已同步数据）。
                {previewSummary(preview).errors > 0
                  ? ` ${previewSummary(preview).errors} 类数据源拉取异常。`
                  : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TenantBillingImportTab)}
            className="w-full"
          >
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              {TAB_CONFIG.map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  disabled={!preview}
                  className="text-xs sm:text-sm"
                >
                  {label}
                  {tabCount(value) != null ? (
                    <span className="text-muted-foreground ml-1">({tabCount(value)})</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            {!preview ? (
              <div className="text-muted-foreground mt-8 flex min-h-[200px] items-center justify-center rounded-md border border-dashed text-sm">
                请先点击「确认」拉取平台数据
              </div>
            ) : (
              <>
                <TabsContent value="metalOrders" className="mt-4">
                  <ScrollTable>
                    <SectionPanel section={preview.sections.metalOrders} label="裸金属订单">
                      {(items) => <MetalOrdersTable items={items} />}
                    </SectionPanel>
                  </ScrollTable>
                </TabsContent>
                <TabsContent value="monthlyBills" className="mt-4">
                  <ScrollTable>
                    <SectionPanel section={preview.sections.monthlyBills} label="月度账单">
                      {(items) => <MonthlyBillsTable items={items} />}
                    </SectionPanel>
                  </ScrollTable>
                </TabsContent>
                <TabsContent value="recharges" className="mt-4">
                  <ScrollTable>
                    <SectionPanel section={preview.sections.recharges} label="充值">
                      {(items) => <RechargesTable items={items} />}
                    </SectionPanel>
                  </ScrollTable>
                </TabsContent>
                <TabsContent value="billDetails" className="mt-4">
                  <ScrollTable>
                    <SectionPanel section={preview.sections.billDetails} label="账单明细">
                      {(items) => <BillDetailsTable items={items} />}
                    </SectionPanel>
                  </ScrollTable>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        <DialogFooter className="flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
          <p className="text-muted-foreground text-xs">
            {preview
              ? `预览 ID：${preview.previewId.slice(0, 8)}… · 15 分钟内有效`
              : "请先拉取预览，再确认导入"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="button" disabled={!canImport || isBusy} onClick={() => void onConfirmImport()}>
              {phase === "committing" ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  导入中…
                </>
              ) : (
                "确认导入"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScrollTable({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{value}</div>
    </div>
  )
}

function SectionPanel<T extends { action: TenantBillingImportAction }>({
  section,
  label,
  children,
}: {
  section: {
    summary: { total: number; toCreate: number; toUpdate: number; skipped: number }
    items: T[]
    error?: string
  }
  label: string
  children: (items: T[]) => React.ReactNode
}) {
  const { summary, items, error } = section

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <IconAlertTriangle className="size-4" />
          <AlertDescription>
            {label}拉取失败：{error}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
        <span>共 {summary.total} 条</span>
        <span>新增 {summary.toCreate}</span>
        <span>更新 {summary.toUpdate}</span>
        <span>跳过 {summary.skipped}</span>
      </div>

      {items.length === 0 && !error ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-8 text-center text-sm">
          无数据
        </div>
      ) : (
        children(items)
      )}
    </div>
  )
}

function MetalOrdersTable({ items }: { items: MetalOrderPreviewItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[72px]">操作</TableHead>
          <TableHead>订单号</TableHead>
          <TableHead>机房</TableHead>
          <TableHead>GPU</TableHead>
          <TableHead className="text-right">金额</TableHead>
          <TableHead>下单时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{actionBadge(row.action)}</TableCell>
            <TableCell className="font-mono text-xs">{row.orderNo}</TableCell>
            <TableCell>{row.idcName}</TableCell>
            <TableCell>{row.gpuSummary}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRmb(row.amountRmb)}</TableCell>
            <TableCell className="text-muted-foreground text-xs">{row.createTime}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MonthlyBillsTable({ items }: { items: MonthlyBillPreviewItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[72px]">操作</TableHead>
          <TableHead>账期</TableHead>
          <TableHead className="text-right">总消费</TableHead>
          <TableHead className="text-right">券/优惠</TableHead>
          <TableHead className="text-right">余额消费</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{actionBadge(row.action)}</TableCell>
            <TableCell>{row.billMonth}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatRmb(row.totalAmountRmb)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatRmb(row.couponAmountRmb)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatRmb(row.balanceAmountRmb)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RechargesTable({ items }: { items: RechargePreviewItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[72px]">操作</TableHead>
          <TableHead>流水号</TableHead>
          <TableHead>渠道</TableHead>
          <TableHead className="text-right">金额</TableHead>
          <TableHead>时间</TableHead>
          <TableHead>备注</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{actionBadge(row.action)}</TableCell>
            <TableCell className="max-w-[140px] truncate font-mono text-xs">
              {row.transactionId}
            </TableCell>
            <TableCell>{row.payChannel}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRmb(row.amountRmb)}</TableCell>
            <TableCell className="text-muted-foreground text-xs">{row.createTime}</TableCell>
            <TableCell className="max-w-[180px] truncate text-xs">{row.remark ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function BillDetailsTable({ items }: { items: BillDetailPreviewItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[72px]">操作</TableHead>
          <TableHead>账期</TableHead>
          <TableHead>产品线</TableHead>
          <TableHead>资源</TableHead>
          <TableHead className="text-right">消费</TableHead>
          <TableHead className="text-right">优惠</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{actionBadge(row.action)}</TableCell>
            <TableCell>{row.billMonth}</TableCell>
            <TableCell className="font-mono text-xs">{row.productLine}</TableCell>
            <TableCell>{row.resourceName}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRmb(row.amountRmb)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatRmb(row.couponAmountRmb)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
