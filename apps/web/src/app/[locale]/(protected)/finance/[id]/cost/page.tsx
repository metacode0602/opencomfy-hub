"use client"

import { downloadCostDetailExcel } from "@/lib/finance/cost-detail-export"
import { mergeCostRowsWithOverrides } from "@/lib/finance/cost-row-utils"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useFinanceCostOpsStore } from "@/lib/stores/finance-cost-ops-store"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Download, RefreshCw } from "lucide-react"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CostGroupedEditable } from "./_components/cost-grouped-editable"
import { CostRegenerateDialog } from "./_components/cost-regenerate-dialog"

export default function FinancePeriodCostPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data: bundle, isLoading } = trpc.finance.periods.getBundle.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  )

  const period = bundle?.period
  const rows = useMemo(() => bundle?.cost ?? [], [bundle?.cost])
  const overrides = useFinanceCostOpsStore((s) => s.overrides)
  const displayRows = useMemo(
    () => mergeCostRowsWithOverrides(rows, overrides),
    [rows, overrides],
  )
  const hasRecordRows = displayRows.some((r) => r.type === "record")
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const canRegenerateCost =
    period?.status !== "published" &&
    period?.status !== "adjusted" &&
    period?.status !== "void"

  const utils = trpc.useUtils()

  function handleExportExcel() {
    if (!hasRecordRows) {
      toast.error("暂无成本明细，无法导出")
      return
    }
    if (!period) return
    const ok = downloadCostDetailExcel({
      rows: displayRows,
      periodCode: period.period_code,
    })
    if (ok) toast.success("成本毛利明细 Excel 已下载")
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
          <LocaleLink href={`/finance/${id}/income`}>查看收入</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>成本毛利 · {period.period_code}</CardTitle>
            <CardDescription>
              默认按客户经理展示汇总（sum）；点击行首箭头可展开或收起该经理下的分项（record）。
              账期 {period.period_start} ~ {period.period_end}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRegenerateCost ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setRegenerateOpen(true)}
              >
                <RefreshCw className="size-4" />
                重新生成
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportExcel}
              disabled={!hasRecordRows}
            >
              <Download className="size-4" />
              导出 Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <CostGroupedEditable baseRows={rows} />
        </CardContent>
      </Card>

      {period ? (
        <CostRegenerateDialog
          open={regenerateOpen}
          onOpenChange={setRegenerateOpen}
          billingPeriodId={id}
          periodCode={period.period_code}
          periodStart={period.period_start}
          periodEnd={period.period_end}
          onSuccess={() => {
            void utils.finance.periods.getBundle.invalidate({ id })
          }}
        />
      ) : null}
    </div>
  )
}
