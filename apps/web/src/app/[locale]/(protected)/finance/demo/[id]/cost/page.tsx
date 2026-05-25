"use client"

import { AppShell } from "@/components/dashboard/app-shell"
import { DEMO_PERIOD } from "../../_demo/mock-data"
import { useDemoPeriod } from "../../_demo/demo-period-store"
import { DemoCostSummaryTable } from "../../_demo/demo-cost-table"
import { DemoFileSlot } from "../../_demo/demo-file-slot"
import {
  DemoBackLink,
  DemoBanner,
  DemoNav,
} from "../../_demo/demo-shell"
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
import { IconLoader2 } from "@tabler/icons-react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function FinanceDemoCostPage() {
  const params = useParams<{ id: string }>()
  const periodId = params.id ?? DEMO_PERIOD.id
  const demo = useDemoPeriod()
  const [computing, setComputing] = useState(false)

  async function handleComputeCost() {
    if (!demo.canComputeCost) return
    setComputing(true)
    try {
      await demo.simulateComputeCost()
      toast.success("演示：成本计算完成")
    } finally {
      setComputing(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <DemoBackLink />
          <DemoNav periodId={periodId} active="cost" />
        </div>

        <DemoBanner />

        <Card>
          <CardHeader>
            <CardTitle>成本 · 文件上传</CardTitle>
            <CardDescription>
              账期 {DEMO_PERIOD.period_code} · 账户消费详情（tenant_bill）按刊例价窗口分时间段上传
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DemoFileSlot
              title="裸金属消费订单列表（共用）"
              hint="已在收入页上传则此处只读；成本计算依赖此文件"
              slot={demo.baremetalUpload}
              readOnly
            />

            <div className="space-y-3">
              <p className="text-sm font-medium">账户消费详情 · 按时间段</p>
              {demo.tenantBillSlots.map((slot) => (
                <DemoFileSlot
                  key={slot.windowId}
                  title={`${slot.windowStart} ~ ${slot.windowEnd}`}
                  hint="Excel/CSV：客户ID、总消费、卡时、GPU 型号、区域等"
                  slot={slot.upload}
                  onSimulateUpload={() => demo.simulateUploadTenantBill(slot.windowId)}
                />
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
            <Button
              disabled={!demo.canComputeCost || computing || demo.published}
              onClick={() => void handleComputeCost()}
            >
              {computing ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  成本计算中…
                </>
              ) : (
                "计算成本"
              )}
            </Button>
            <Button variant="outline" asChild>
              <LocaleLink href={`/finance/demo/${periodId}`}>返回 Hub</LocaleLink>
            </Button>
          </CardFooter>
        </Card>

        {demo.costComputed && (
          <Card>
            <CardHeader>
              <CardTitle>成本毛利明细</CardTitle>
              <CardDescription>
                platform_cost_monthly · 共 {demo.costRows.length} 条 · 含 staff_name 快照列
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DemoCostSummaryTable rows={demo.costRows} />
            </CardContent>
          </Card>
        )}

        {!demo.costComputed && demo.canComputeCost && (
          <p className="text-center text-sm text-muted-foreground">
            文件已就绪，点击「计算成本」查看汇总表。
          </p>
        )}
      </div>
    </AppShell>
  )
}
