"use client"

import * as React from "react"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import type { GlobalAlertLevel, GlobalAlertType } from "@/lib/types/global-dashboard-api"

import { DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"

const ALERT_LEVELS: GlobalAlertLevel[] = ["严重", "警告", "提示"]
const ALERT_TYPE_DEFS: { id: GlobalAlertType; label: string }[] = [
  { id: "fault", label: "故障" },
  { id: "network", label: "网络" },
  { id: "shelving", label: "上架率" },
  { id: "pool", label: "资源池" },
]

const LEVEL_FILTER_ALL = "all"
const TYPE_FILTER_ALL = "all"

export function AlertsTimelineCard() {
  const { data, isLoading } = useGlobalDashboard()
  const [levelFilter, setLevelFilter] = React.useState<string>(LEVEL_FILTER_ALL)
  const [typeFilter, setTypeFilter] = React.useState<string>(TYPE_FILTER_ALL)

  const alerts = data?.alerts ?? []

  const filteredAlerts = React.useMemo(() => {
    return alerts.filter((a) => {
      if (levelFilter !== LEVEL_FILTER_ALL && a.level !== levelFilter) return false
      if (typeFilter !== TYPE_FILTER_ALL && a.type !== typeFilter) return false
      return true
    })
  }, [alerts, levelFilter, typeFilter])

  return (
    <Card className="flex h-full min-h-0 w-full min-w-0 flex-col border-border/80 lg:col-span-4">
      <CardHeader className="shrink-0 flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">异常告警时间线</CardTitle>
          <CardDescription>未关闭 fault_incident，按 opened_at 倒序</CardDescription>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger size="sm" className="h-8 w-full min-w-[7rem]">
              <SelectValue placeholder="选择级别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LEVEL_FILTER_ALL}>全部级别</SelectItem>
              {ALERT_LEVELS.map((lv) => (
                <SelectItem key={lv} value={lv}>
                  {lv}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" className="h-8 w-full min-w-[7rem]">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TYPE_FILTER_ALL}>全部类型</SelectItem>
              {ALERT_TYPE_DEFS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col pt-1">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          {isLoading ? (
            <DashboardCardLoading />
          ) : filteredAlerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">没有符合条件的告警</p>
          ) : (
            filteredAlerts.map((a) => (
              <div
                key={a.id}
                className="flex w-full min-w-0 overflow-hidden rounded-lg border border-border/60 bg-muted/10 shadow-sm"
              >
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r border-border/60 bg-muted/30 px-2 py-3 sm:w-[5rem]">
                  <span className="text-center font-mono text-[10px] leading-tight text-muted-foreground tabular-nums sm:text-[11px]">
                    {a.time}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-2 px-3 py-3 sm:px-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          a.level === "严重"
                            ? "destructive"
                            : a.level === "警告"
                              ? "default"
                              : "secondary"
                        }
                        className={cn(
                          "shrink-0",
                          a.level === "警告" &&
                            "border-transparent bg-orange-500 text-white hover:bg-orange-500/90"
                        )}
                      >
                        {a.level}
                      </Badge>
                      <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-normal">
                        {ALERT_TYPE_DEFS.find((t) => t.id === a.type)?.label ?? a.type}
                      </Badge>
                      <span className="min-w-0 text-sm font-semibold leading-snug text-foreground">
                        {a.title}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium sm:pt-0.5 sm:text-right",
                        a.state === "未恢复" && "text-destructive",
                        a.state === "处理中" && "text-chart-4",
                        a.state === "已恢复" && "text-muted-foreground"
                      )}
                    >
                      {a.state}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{a.detail}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
