"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowDown } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import { DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"

export function LifecycleFlowCard() {
  const { data, isLoading, isSnapshot } = useGlobalDashboard()
  const stages = data?.lifecycleFunnel ?? []

  return (
    <Card className="border-border/80 lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">物理机生命周期漏斗</CardTitle>
        <CardDescription>
          {isSnapshot
            ? "L2 物理设备按 lifecycle_status 分布（CRM 五段）"
            : "期末存量 + 本期首次进入各阶段的设备吞吐"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {isLoading ? (
          <DashboardCardLoading />
        ) : stages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无生命周期数据</p>
        ) : (
          stages.map((row, idx) => {
            const periodRow = row as {
              secondaryLabel?: string
              secondaryValue?: string
              throughputDeviceCount?: number
            }
            return (
              <React.Fragment key={row.stage}>
                {idx > 0 && (
                  <div className="flex justify-center py-0.5 text-muted-foreground">
                    <ArrowDown className="size-3" />
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40",
                    row.warn && "border-destructive/40 bg-destructive/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        row.warn ? "bg-destructive" : "bg-chart-2",
                      )}
                    />
                    <span className="text-sm font-medium">{row.stage}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {row.gpuCount.toLocaleString()} 卡 · {row.deviceCount.toLocaleString()} 台
                      {!isSnapshot && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          期末
                        </span>
                      )}
                    </div>
                    {!isSnapshot && periodRow.secondaryValue && (
                      <div className="text-xs text-muted-foreground">
                        {periodRow.secondaryLabel} {periodRow.secondaryValue}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
