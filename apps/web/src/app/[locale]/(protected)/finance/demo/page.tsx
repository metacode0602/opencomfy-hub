"use client"

import { AppShell } from "@/components/dashboard/app-shell"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { IconArrowRight, IconPlayerPlay } from "@tabler/icons-react"
import { DEMO_PERIOD_ID } from "./_demo/mock-data"

export default function FinanceDemoEntryPage() {
  const router = useLocaleRouter()

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href="/finance">← 返回账期列表</LocaleLink>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>账期流程静态演示</CardTitle>
            <CardDescription>
              Hub + 收入页 + 成本页三页分离，模拟完整账期创建与发布流程（无 API）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Hub</strong>：查看账期状态、汇总、发布
              </li>
              <li>
                <strong className="text-foreground">收入页</strong>：上传客户消费 + 裸金属 →
                计算收入 → 填写补充消费
              </li>
              <li>
                <strong className="text-foreground">成本页</strong>：上传账户消费详情 →
                计算成本 → 查看 platform_cost_monthly
              </li>
            </ol>
            <Button
              className="w-full sm:w-auto"
              onClick={() => router.push(`/finance/demo/${DEMO_PERIOD_ID}`)}
            >
              <IconPlayerPlay className="mr-2 size-4" />
              开始演示（账期 2025-04）
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">与设计文档对应关系</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>· 收入与成本独立计算按钮、独立 API（演示中为本地 simulate）</p>
            <p>· 成本汇总表含 staff_name、机房、卡型等 v2.1 列</p>
            <p>· 裸金属在收入页上传，成本页只读引用</p>
            <p>· 发布仅在 Hub，且需两侧均已计算、补充消费已保存</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
