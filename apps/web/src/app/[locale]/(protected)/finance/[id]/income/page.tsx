"use client"

import { listIncomeForPeriod, resolveBillingPeriod } from "@/lib/finance/merge-finance-data"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useFinanceMockStore } from "@/lib/stores/finance-mock-store"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { IncomeDetailTable } from "../../_components/income-detail-table"
import { useParams } from "next/navigation"
import { useMemo } from "react"

export default function FinancePeriodIncomePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const bundles = useFinanceMockStore((s) => s.bundles)

  const period = useMemo(
    () => (id ? resolveBillingPeriod(id, bundles) : undefined),
    [id, bundles],
  )
  const rows = useMemo(
    () => (id ? listIncomeForPeriod(id, bundles) : []),
    [id, bundles],
  )

  if (!id || !period) {
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
          <LocaleLink href={`/finance/${id}/cost`}>查看成本</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>收入明细 · {period.period_code}</CardTitle>
          <CardDescription>
            platform_income_monthly（账期 {period.period_start} ~{" "}
            {period.period_end}）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncomeDetailTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
