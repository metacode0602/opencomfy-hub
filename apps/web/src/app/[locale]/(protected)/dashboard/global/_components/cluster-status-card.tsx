"use client"

import Link from "next/link"
import { Network } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { cn } from "@workspace/ui/lib/utils"

import { DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"

export function ClusterStatusCard() {
  const { data, isLoading } = useGlobalDashboard()
  const clusters = data?.clusters ?? []

  return (
    <Card className="border-border/80 lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">机房集群实时状态</CardTitle>
        <CardDescription>在线率 = 在线 GPU / 总量 GPU（非 IDC 上架率）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <DashboardCardLoading />
        ) : clusters.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无机房数据</p>
        ) : (
          clusters.map((c) => (
            <div
              key={c.dataCenterId}
              className="flex gap-3 rounded-lg border border-border/60 bg-muted/10 p-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold leading-tight">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.primaryCardType ?? "—"}
                    </div>
                  </div>
                  <Network
                    className={cn(
                      "size-4 shrink-0",
                      c.netOk ? "text-emerald-500" : "text-destructive"
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-6">
                  <span>总量 {c.totalGpu} 卡</span>
                  <span>在线 {c.onlineGpu} 卡</span>
                  <span className="text-destructive">异常 {c.abnormalDevices} 台</span>
                  <span className="text-chart-4">待接入 {c.pendingAccessGpu} 卡</span>
                  <span className="text-chart-4">接入中 {c.onboardingGpu} 卡</span>
                  <span className="text-chart-4">下架中 {c.retiringGpu} 卡</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>在线率</span>
                    <span>{c.onlineRate}%</span>
                  </div>
                  <Progress value={c.onlineRate} className="h-1.5" />
                </div>
              </div>
            </div>
          ))
        )}
        <Link href="/supplier/overview" className="text-xs text-primary hover:underline">
          查看资源总览
        </Link>
      </CardContent>
    </Card>
  )
}
