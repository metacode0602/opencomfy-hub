"use client"

import { formatMoney, formatText } from "@/app/[locale]/(protected)/finance/_lib/display"
import { getProjectsFromSharedWarning } from "@/lib/finance/single-income-validation"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { IconLoader2 } from "@tabler/icons-react"
import { useEffect, useState } from "react"

const FLOW_STEPS = [
  "筛选非归档经营项目，且计费租户已维护 platform_tenant_id（优先 primary_tenant_id，否则 project_tenant）。",
  "按账期编码 period_code 匹配 CRM tenant_bill.bill_month，读取对应租户月度账单头。",
  "汇总 tenant_bill_detail：非 bare_metal 明细的 balance_amount → 余额消费；product_line = bare_metal 的 amount → 裸金属消费。",
  "经 tenant → customer 写入客户全称；保留各行已有补充消费；总消费 = 补充 + 余额 + 裸金属。",
  "试算仅预览结果；确认并写入后覆盖 platform_income_monthly 并更新账期汇总。",
]

function ProjectDetailList({
  title,
  items,
  variant,
}: {
  title: string
  items: Array<{
    projectId: string
    projectName: string
    tenantId: string
    tenantName: string
    platformTenantId: string
    customerId?: string
    customerName?: string
  }>
  variant: "default" | "warning"
}) {
  if (items.length === 0) return null
  const boxClass =
    variant === "warning"
      ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-50"
      : "rounded-md border bg-muted/40 px-3 py-2"

  return (
    <div className={boxClass}>
      <p className="font-medium">
        {title}（{items.length}）
      </p>
      <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
        {items.map((p) => (
          <li key={p.projectId} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
            <div>
              <span className="font-medium">{p.projectName}</span>
              <span className="text-muted-foreground"> · 项目ID </span>
              <span className="font-mono">{p.projectId}</span>
            </div>
            <div className="text-muted-foreground mt-0.5">
              租户 {p.tenantName}（租户ID: <span className="font-mono">{p.tenantId}</span>）· 平台租户ID{" "}
              <span className="font-mono">{p.platformTenantId}</span>
              {p.customerName ? (
                <>
                  {" "}
                  · 客户 {p.customerName}
                  {p.customerId ? (
                    <>
                      （<span className="font-mono">{p.customerId}</span>）
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

type SingleIncomeRecomputeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  billingPeriodId: string
  periodCode: string
  onSuccess?: () => void
}

export function SingleIncomeRecomputeDialog({
  open,
  onOpenChange,
  billingPeriodId,
  periodCode,
  onSuccess,
}: SingleIncomeRecomputeDialogProps) {
  const utils = trpc.useUtils()
  const [previewEnabled, setPreviewEnabled] = useState(false)

  const { data: validation, isLoading: validating } =
    trpc.finance.periods.validateSingleIncome.useQuery(
      { billingPeriodId },
      { enabled: open && Boolean(billingPeriodId) },
    )

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
    refetch: refetchPreview,
  } = trpc.finance.periods.previewSingleIncome.useQuery(
    { billingPeriodId },
    { enabled: open && previewEnabled && Boolean(billingPeriodId) },
  )

  const compute = trpc.finance.periods.computeSingleIncome.useMutation({
    onSuccess: async () => {
      await utils.finance.periods.getBundle.invalidate({ id: billingPeriodId })
      await utils.finance.periods.list.invalidate()
      onSuccess?.()
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (!open) {
      setPreviewEnabled(false)
    }
  }, [open])

  const canPreview = validation?.canPreviewSingleIncome ?? false
  const canConfirm = validation?.canComputeSingleIncome && !compute.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-w-[40vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>重新计算收入（CRM 月度账单）</DialogTitle>
          <DialogDescription>
            账期 {periodCode}：基于 tenant_bill 与 tenant_bill_detail 重算月度经营收入
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm">
          <div>
            <p className="mb-2 font-medium">计算流程</p>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              {FLOW_STEPS.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {validating ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <IconLoader2 className="size-4 animate-spin" />
              正在检查数据就绪情况…
            </p>
          ) : validation ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 px-3 py-3 space-y-1">
                <p>
                  可参与项目：<span className="font-medium">{validation.projectsIncluded}</span> /{" "}
                  {validation.projectsEligible}
                </p>
                <p>库内账单（{validation.billMonth}）：{validation.billsInDb} 条</p>
                {!validation.canComputeSingleIncome && validation.canPreviewSingleIncome && (
                  <p className="text-amber-700 dark:text-amber-300">
                    账期已发布：仅可试算预览，不可写入（须先撤回发布）
                  </p>
                )}
                {!validation.canPreviewSingleIncome && (
                  <p className="text-destructive">
                    当前不可试算：须至少 1 个已同步账单的项目，且账期未作废
                  </p>
                )}
              </div>

              <ProjectDetailList
                title="缺 CRM 月度账单（试算时将跳过）"
                items={validation.projectsMissingBill ?? []}
                variant="warning"
              />

              {(validation.sharedPlatformTenantWarnings ?? []).length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-50">
                  <p className="font-medium">
                    同一平台租户被多个项目共用（{validation.sharedPlatformTenantWarnings.length}）
                  </p>
                  <ul className="mt-2 max-h-48 space-y-3 overflow-y-auto text-xs">
                    {(validation.sharedPlatformTenantWarnings ?? []).map((w) => {
                      const projects = getProjectsFromSharedWarning(w)
                      return (
                        <li
                          key={w.platformTenantId}
                          className="border-b border-amber-500/20 pb-2 last:border-0"
                        >
                          <div>
                            平台租户ID <span className="font-mono">{w.platformTenantId}</span>
                            {w.tenantName ? (
                              <>
                                {" · "}
                                租户 {w.tenantName}
                                {w.tenantId ? (
                                  <>
                                    （租户ID: <span className="font-mono">{w.tenantId}</span>）
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                          <ul className="mt-1 list-inside list-disc pl-1">
                            {projects.map((p, idx) => (
                              <li key={p.projectId !== "—" ? p.projectId : `${w.platformTenantId}-${idx}`}>
                                {p.projectName}
                                {p.projectId !== "—" ? (
                                  <>
                                    （项目ID: <span className="font-mono">{p.projectId}</span>）
                                  </>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {previewEnabled && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">试算结果（未写入数据库）</p>
                {preview && (
                  <p className="text-muted-foreground text-xs">
                    共 {preview.incomeCount} 行 · 总收入 {formatMoney(preview.summary.totalIncome)}
                  </p>
                )}
              </div>

              {previewLoading ? (
                <p className="text-muted-foreground flex items-center gap-2">
                  <IconLoader2 className="size-4 animate-spin" />
                  试算中…
                </p>
              ) : previewError ? (
                <p className="text-destructive text-sm">{previewError.message}</p>
              ) : preview ? (
                <>
                  {preview.reconciliationIssues.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      <p className="font-medium text-amber-900 dark:text-amber-100">对账提示</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-amber-950 dark:text-amber-50">
                        {preview.reconciliationIssues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>项目</TableHead>
                          <TableHead>客户全称</TableHead>
                          <TableHead>平台租户ID</TableHead>
                          <TableHead className="text-right">补充</TableHead>
                          <TableHead className="text-right">余额</TableHead>
                          <TableHead className="text-right">裸金属</TableHead>
                          <TableHead className="text-right">总消费</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map((row) => (
                          <TableRow key={row.projectId}>
                            <TableCell className="max-w-[160px]">
                              <div className="font-medium">{formatText(row.projectName)}</div>
                              <div className="text-muted-foreground font-mono text-[10px]">
                                {row.projectId}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[140px]">
                              <div>{formatText(row.customerFullName)}</div>
                              <div className="text-muted-foreground font-mono text-[10px]">
                                {row.customerId}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <div>{row.platformTenantId}</div>
                              {row.billId ? (
                                <div className="text-muted-foreground text-[10px]">
                                  账单 {row.billId}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(row.supplementaryConsumption)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(row.balanceConsumption)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(row.bareMetalConsumption)}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatMoney(row.totalConsumption)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {compute.error && (
            <p className="text-destructive text-sm">{compute.error.message}</p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={compute.isPending}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canPreview || previewLoading || compute.isPending}
            onClick={() => {
              setPreviewEnabled(true)
              void refetchPreview()
            }}
          >
            {previewLoading ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                试算中…
              </>
            ) : (
              "试算"
            )}
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => compute.mutate({ billingPeriodId })}
          >
            {compute.isPending ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                计算并写入…
              </>
            ) : (
              "确认并写入"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
