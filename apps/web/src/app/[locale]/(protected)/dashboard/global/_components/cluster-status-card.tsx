"use client"

import Link from "next/link"
import { Info, Network } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import type { GlobalClusterStatusRow } from "@/lib/types/global-dashboard-api"

import { DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"

function formatGap(gap: number): string {
  if (gap === 0) return "一致"
  return gap > 0 ? `+${gap}` : String(gap)
}

function gapClassName(gap: number): string {
  if (gap === 0) return "text-muted-foreground"
  return gap > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
}

function PlatformComparison({ cluster }: { cluster: GlobalClusterStatusRow }) {
  const { containerInstanceRegion, platformTotalGpu, platformTotalDevices } = cluster

  if (!containerInstanceRegion) {
    return (
      <p className="text-[10px] text-muted-foreground font-bold">未配置容器实例区域，无法与平台对比</p>
    )
  }

  if (platformTotalGpu == null) {
    return (
      <p className="text-[10px] text-muted-foreground font-bold">
        平台区域 {containerInstanceRegion} 暂无数据
      </p>
    )
  }

  const deviceGap =
    platformTotalDevices != null ? cluster.totalDevices - platformTotalDevices : null
  const gpuGap = cluster.totalGpu - platformTotalGpu

  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-border/70 bg-background/60 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="text-[10px] font-medium text-muted-foreground">
          平台 · {containerInstanceRegion}
        </span>
        {deviceGap != null || gpuGap !== 0 ? (
          <span className="text-[10px] text-muted-foreground font-bold">
            {deviceGap != null ? (
              <>
                设备{" "}
                <span className={gapClassName(deviceGap)}>{formatGap(deviceGap)}</span>
                {" · "}
              </>
            ) : null}
            卡数 <span className={gapClassName(gpuGap)}>{formatGap(gpuGap)}</span>
          </span>
        ) : (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">台账一致</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
        <span className="font-bold">设备 {platformTotalDevices ?? "—"} 台</span>
        <span className="font-bold">总量 {platformTotalGpu} 卡</span>
        <span>在用 {cluster.platformUsedGpu ?? "—"} 卡</span>
        <span className="hidden sm:inline">
          空闲{" "}
          {cluster.platformUsedGpu != null
            ? Math.max(0, platformTotalGpu - cluster.platformUsedGpu)
            : "—"}{" "}
          卡
        </span>
      </div>
    </div>
  )
}

export function ClusterStatusCard() {
  const { data, isLoading } = useGlobalDashboard()
  const clusters = data?.clusters.slice(0, 5) ?? []
  const inconsistentClusters = clusters.filter(
    (c) => c.onlineDevices !== c.totalDevices
  )

  return (
    <Card className="border-border/80 lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          机房集群实时状态
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                aria-label="计算方法说明"
              >
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left">
              {/* <p>接入台账 vs 平台区域（容器实例区域）</p> */}
              <p>在线率 = 在线 GPU / 总量 GPU</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <DashboardCardLoading />
        ) : clusters.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无机房数据</p>
        ) : inconsistentClusters.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            所有机房在线设备数与设备总数一致
          </p>
        ) : (
          clusters.map((c) => (
            <div
              key={c.dataCenterId}
              className="flex gap-3 rounded-lg border border-border/60 bg-muted/10 p-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-row" >
                    <div className="text-sm font-semibold leading-tight">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.primaryCardType ?? "—"}
                      {c.containerInstanceRegion ? (
                        <span className="ml-1.5 text-[10px]">· {c.containerInstanceRegion}</span>
                      ) : null}
                    </div>
                  </div>
                  <Network
                    className={cn(
                      "size-4 shrink-0",
                      c.netOk ? "text-emerald-500" : "text-destructive"
                    )}
                  />
                </div>
                {/* <div className="text-[10px] font-medium text-muted-foreground">接入台账</div> */}
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
                  <span>
                    设备 {c.totalDevices} 台 · {c.totalGpu} 卡
                  </span>
                  <span>
                    在线 {c.onlineDevices} 台 · {c.onlineGpu} 卡
                  </span>
                  <span className="text-destructive">异常 {c.abnormalDevices} 台</span>
                  <span className="text-chart-4">待接入 {c.pendingAccessGpu} 卡</span>
                  {/* <span className="text-chart-4">接入中 {c.onboardingGpu} 卡</span> */}
                  {/* <span className="text-chart-4">下架中 {c.retiringGpu} 卡</span> */}
                </div>
                {/* <PlatformComparison cluster={c} /> */}
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
