"use client"

import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useParams } from "next/navigation"
import { CostGroupedEditable } from "./_components/cost-grouped-editable"

export default function FinancePeriodCostPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data: bundle, isLoading } = trpc.finance.periods.getBundle.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  )

  const period = bundle?.period
  const rows = bundle?.cost ?? []

  if (!id) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
        <p className="text-muted-foreground">无效账期 ID</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
        <p className="text-muted-foreground">加载中…</p>
      </div>
    )
  }

  if (!period) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
        <p className="text-muted-foreground">未找到该账期。</p>
        <Button variant="link" asChild className="mt-2 px-0">
          <LocaleLink href="/finance">返回账期列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href="/finance">← 账期列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/income`}>查看收入</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>成本毛利 · {period.period_code}</CardTitle>
          <CardDescription>
            默认按客户经理展示汇总（sum）；点击行首箭头可展开或收起该经理下的分项（record）。
            账期 {period.period_start} ~ {period.period_end}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CostGroupedEditable baseRows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
