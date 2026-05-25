"use client"

import { AppShell } from "@/components/dashboard/app-shell"
import { formatMoney, formatText } from "../../../_lib/display"
import { DEMO_PERIOD } from "../../_demo/mock-data"
import { useDemoPeriod } from "../../_demo/demo-period-store"
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
import { Input } from "@workspace/ui/components/input"
import { IconLoader2 } from "@tabler/icons-react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function FinanceDemoIncomePage() {
  const params = useParams<{ id: string }>()
  const periodId = params.id ?? DEMO_PERIOD.id
  const demo = useDemoPeriod()
  const [computing, setComputing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleComputeIncome() {
    if (!demo.canComputeIncome) return
    setComputing(true)
    try {
      await demo.simulateComputeIncome()
      toast.success("演示：收入计算完成")
    } finally {
      setComputing(false)
    }
  }

  async function handleSaveSupplementary() {
    setSaving(true)
    try {
      demo.simulateSaveSupplementary()
      toast.success("演示：补充消费已保存")
    } finally {
      setSaving(false)
    }
  }

  const supplementaryDirty = demo.incomeComputed && !demo.supplementarySaved

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <DemoBackLink />
          <DemoNav periodId={periodId} active="income" />
        </div>

        <DemoBanner />

        <Card>
          <CardHeader>
            <CardTitle>收入 · 文件上传</CardTitle>
            <CardDescription>
              账期 {DEMO_PERIOD.period_code} · 上传客户消费明细与裸金属订单（裸金属供收入与成本共用）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DemoFileSlot
              title="客户消费明细"
              hint="Excel：客户ID、类型、总消费、券消费、余额消费等列"
              slot={demo.customerUpload}
              onSimulateUpload={demo.simulateUploadCustomer}
            />
            <DemoFileSlot
              title="裸金属消费订单列表"
              hint="Excel：订单ID、租户ID、机房、设备型号、最终总额等（成本页只读引用）"
              slot={demo.baremetalUpload}
              onSimulateUpload={demo.simulateUploadBaremetal}
            />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
            <Button
              disabled={!demo.canComputeIncome || computing || demo.published}
              onClick={() => void handleComputeIncome()}
            >
              {computing ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  计算收入中…
                </>
              ) : (
                "计算收入"
              )}
            </Button>
            <Button variant="outline" asChild>
              <LocaleLink href={`/finance/demo/${periodId}`}>返回 Hub</LocaleLink>
            </Button>
          </CardFooter>
        </Card>

        {demo.incomeComputed && (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>收入明细</CardTitle>
                <CardDescription>
                  platform_income_monthly · 共 {demo.incomeRows.length} 条 · 手工填写补充消费
                </CardDescription>
              </div>
              <Button
                size="sm"
                disabled={saving || !supplementaryDirty}
                onClick={() => void handleSaveSupplementary()}
              >
                {saving ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    保存中…
                  </>
                ) : (
                  "保存补充消费"
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {supplementaryDirty && (
                <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
                  有未保存的补充消费，Hub 发布将被阻断。
                </p>
              )}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">项目名称</th>
                      <th className="px-3 py-2 text-left">客户全称</th>
                      <th className="px-3 py-2 text-left">租户Id</th>
                      <th className="px-3 py-2 text-right">补充消费</th>
                      <th className="px-3 py-2 text-right">余额消费</th>
                      <th className="px-3 py-2 text-right">裸金属消费</th>
                      <th className="px-3 py-2 text-right">总消费</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demo.incomeRows.map((row) => {
                      const sup = demo.supplementaryDraft[row.id] ?? "0"
                      const total =
                        (Number(sup) || 0) +
                        (Number(row.balance_consumption) || 0) +
                        (Number(row.bare_metal_consumption) || 0)
                      return (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">{formatText(row.project_name)}</td>
                          <td className="max-w-[200px] px-3 py-2">
                            {formatText(row.customer_full_name ?? row.tenant_name)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.tenant_platform_id}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              className="ml-auto max-w-[120px] text-right tabular-nums"
                              value={sup}
                              disabled={demo.published}
                              onChange={(e) =>
                                demo.setSupplementary(row.id, e.target.value)
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(row.balance_consumption ?? "0")}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(row.bare_metal_consumption ?? "0")}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatMoney(String(total))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
