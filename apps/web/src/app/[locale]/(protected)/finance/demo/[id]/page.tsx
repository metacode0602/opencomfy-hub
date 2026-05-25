"use client"

import { AppShell } from "@/components/dashboard/app-shell"
import { formatMoney } from "../../../_lib/display"
import { DEMO_PERIOD } from "../_demo/mock-data"
import { useDemoPeriod } from "../_demo/demo-period-store"
import {
  DemoBackLink,
  DemoBanner,
  DemoNav,
  StatusBadge,
} from "../_demo/demo-shell"
import { LocaleLink } from "@/lib/i18n/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { IconArrowRight, IconCheck, IconLoader2, IconRefresh } from "@tabler/icons-react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function FinanceDemoHubPage() {
  const params = useParams<{ id: string }>()
  const periodId = params.id ?? DEMO_PERIOD.id
  const demo = useDemoPeriod()
  const [publishing, setPublishing] = useState(false)

  async function handlePublish() {
    if (!demo.canPublish) return
    setPublishing(true)
    try {
      await demo.simulatePublish()
      toast.success("演示：账期已发布")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <DemoBackLink />
          <DemoNav periodId={periodId} active="hub" />
        </div>

        <DemoBanner />

        {demo.published && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
            <IconCheck className="size-4" />
            账期已发布（演示状态）。可点击「重置演示」重新体验。
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                账期 {DEMO_PERIOD.period_code}
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({DEMO_PERIOD.period_start} ~ {DEMO_PERIOD.period_end})
                </span>
              </CardTitle>
              <CardDescription>
                账期 Hub — 分别进入收入 / 成本子页完成计算，在此汇总并发布。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Card className="border-dashed shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">收入流程</CardTitle>
                  <CardDescription>客户消费明细 + 裸金属订单</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatusBadge done={demo.incomeComputed} label="收入已计算" />
                  <p className="text-sm text-muted-foreground">
                    {demo.incomeComputed
                      ? `${demo.incomeRows.length} 条收入明细 · 总收入 ${formatMoney(String(demo.totalIncome))}`
                      : "上传文件后点击「计算收入」"}
                  </p>
                  <Button size="sm" asChild variant="outline">
                    <LocaleLink href={`/finance/demo/${periodId}/income`}>
                      进入收入页
                      <IconArrowRight className="ml-1 size-4" />
                    </LocaleLink>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-dashed shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">成本流程</CardTitle>
                  <CardDescription>账户消费详情 + 裸金属（共用）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatusBadge done={demo.costComputed} label="成本已计算" />
                  <p className="text-sm text-muted-foreground">
                    {demo.costComputed
                      ? `${demo.costRows.length} 条成本汇总 · 总成本 ${formatMoney(String(demo.totalCost))}`
                      : "上传 tenant_bill 后点击「计算成本」"}
                  </p>
                  <Button size="sm" asChild variant="outline">
                    <LocaleLink href={`/finance/demo/${periodId}/cost`}>
                      进入成本页
                      <IconArrowRight className="ml-1 size-4" />
                    </LocaleLink>
                  </Button>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card className="h-fit border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="text-base">汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">账期总收入</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(demo.incomeComputed ? String(demo.totalIncome) : "0")}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">账期总成本</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(demo.costComputed ? String(demo.totalCost) : "0")}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">账期毛利（演示）</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(
                    demo.incomeComputed && demo.costComputed
                      ? String(demo.grossProfitDisplay)
                      : "0",
                  )}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 border-t pt-4">
              <Button
                className="w-full"
                disabled={!demo.canPublish || publishing || demo.published}
                onClick={() => void handlePublish()}
              >
                {publishing ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    发布中…
                  </>
                ) : demo.published ? (
                  "已发布"
                ) : (
                  "发布账期"
                )}
              </Button>
              {!demo.canPublish && !demo.published && (
                <p className="text-center text-xs text-muted-foreground">
                  {!demo.incomeComputed || !demo.costComputed
                    ? "需完成收入与成本计算"
                    : "请先保存收入页补充消费"}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={demo.resetDemo}
              >
                <IconRefresh className="mr-1.5 size-4" />
                重置演示
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
