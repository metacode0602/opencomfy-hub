"use client"

import { IncomeDetailEditable } from "../../_components/income-detail-editable"
import { SingleIncomeRecomputeDialog } from "../../_components/single-income-recompute-dialog"
import { downloadIncomeDetailExcel } from "@/lib/finance/income-detail-export"
import {
  countUniqueIncomeTenants,
  mergeIncomeRowsWithOverrides,
  sortIncomeRowsByTotalConsumptionDesc,
} from "@/lib/finance/income-row-utils"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useFinanceIncomeOpsStore } from "@/lib/stores/finance-income-ops-store"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Download, RotateCcw } from "lucide-react"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { isPublishedPeriodStatus } from "../../_lib/period"

export default function FinancePeriodIncomePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [recomputeOpen, setRecomputeOpen] = useState(false)

  const utils = trpc.useUtils()
  const { data: bundle, isLoading } = trpc.finance.periods.getBundle.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  )

  const period = bundle?.period
  const rows = useMemo(() => bundle?.income ?? [], [bundle?.income])
  const overrides = useFinanceIncomeOpsStore((s) => s.overrides)
  const displayRows = useMemo(
    () =>
      sortIncomeRowsByTotalConsumptionDesc(
        mergeIncomeRowsWithOverrides(rows, overrides),
      ),
    [rows, overrides],
  )
  const tenantCount = useMemo(
    () => countUniqueIncomeTenants(displayRows),
    [displayRows],
  )

  const periodPublished = period
    ? isPublishedPeriodStatus(period.status)
    : false

  function handleExportExcel() {
    if (displayRows.length === 0) {
      toast.error("暂无收入明细，无法导出")
      return
    }
    if (!period) return
    const ok = downloadIncomeDetailExcel({
      rows: displayRows,
      periodCode: period.period_code,
      showPeriodColumn: false,
    })
    if (ok) toast.success("收入明细 Excel 已下载")
  }

  function handleRecomputeSuccess() {
    toast.success("收入已根据 CRM 月度账单重新计算并写入")
    if (id) void utils.finance.periods.getBundle.invalidate({ id })
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
    <div className="bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href="/finance">← 账期列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/cost`}>查看成本</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>收入明细 · {period.period_code}</CardTitle>
            <CardDescription>
              platform_income_monthly（账期 {period.period_start} ~{" "}
              {period.period_end}）· 共 {tenantCount} 个租户、
              {displayRows.length} 条明细 · 客户全称经租户关联 customer
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              title={
                periodPublished
                  ? "已发布账期可试算预览；写入须先撤回发布"
                  : undefined
              }
              onClick={() => setRecomputeOpen(true)}
            >
              <RotateCcw className="size-4" />
              重新计算
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportExcel}
              disabled={displayRows.length === 0}
            >
              <Download className="size-4" />
              导出 Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <IncomeDetailEditable baseRows={rows} showPeriodColumn={false} />
        </CardContent>
      </Card>

      <SingleIncomeRecomputeDialog
        open={recomputeOpen}
        onOpenChange={setRecomputeOpen}
        billingPeriodId={id}
        periodCode={period.period_code}
        onSuccess={handleRecomputeSuccess}
      />
    </div>
  )
}
