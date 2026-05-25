"use client"

import { IncomeDetailEditable } from "../../_components/income-detail-editable"
import { downloadIncomeDetailExcel } from "@/lib/finance/income-detail-export"
import { mergeIncomeRowsWithOverrides } from "@/lib/finance/income-row-utils"
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
import { Download } from "lucide-react"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { toast } from "sonner"

export default function FinancePeriodIncomePage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data: bundle, isLoading } = trpc.finance.periods.getBundle.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  )

  const period = bundle?.period
  const rows = useMemo(() => bundle?.income ?? [], [bundle?.income])
  const overrides = useFinanceIncomeOpsStore((s) => s.overrides)
  const displayRows = useMemo(
    () => mergeIncomeRowsWithOverrides(rows, overrides),
    [rows, overrides],
  )

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
              {period.period_end}）
            </CardDescription>
          </div>
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
        </CardHeader>
        <CardContent>
          <IncomeDetailEditable baseRows={rows} showPeriodColumn={false} />
        </CardContent>
      </Card>
    </div>
  )
}
