"use client"

import * as React from "react"
import { Bell, ChevronDown, Loader2, Maximize2, RefreshCw } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@workspace/ui/components/popover"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { trpc } from "@/lib/trpc/client"

import { useGlobalDashboard } from "../_lib/global-dashboard-context"
import {
  defaultDailyRange,
  defaultHourlyRange,
  endOfLocalDay,
  formatDateKey,
  formatDateTimeKey,
  formatQueryScopeLabel,
  parseDateKey,
  parseDateTimeKey,
  startOfLocalDay,
  useGlobalDashboardQuery,
} from "../_lib/global-dashboard-query"

function PeriodControlsPanel() {
  const { query, setQuery } = useGlobalDashboardQuery()
  const isDaily = query.view === "daily"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isDaily ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setQuery(defaultDailyRange())}
          >
            近 7 天
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const now = new Date()
              const start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 1))
              setQuery({ periodStart: start, periodEnd: endOfLocalDay(now) })
            }}
          >
            本月
          </Button>
          <input
            type="date"
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            value={formatDateKey(query.periodStart)}
            onChange={(e) => {
              const d = parseDateKey(e.target.value)
              if (d) setQuery({ periodStart: d })
            }}
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            value={formatDateKey(query.periodEnd)}
            onChange={(e) => {
              const d = parseDateKey(e.target.value)
              if (d) setQuery({ periodEnd: endOfLocalDay(d) })
            }}
          />
        </>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setQuery(defaultHourlyRange())}
          >
            近 24 小时
          </Button>
          <input
            type="datetime-local"
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            value={`${formatDateTimeKey(query.periodStart)}:00`}
            onChange={(e) => {
              const d = parseDateTimeKey(e.target.value.slice(0, 13))
              if (d) setQuery({ periodStart: d })
            }}
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="datetime-local"
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            value={`${formatDateTimeKey(query.periodEnd)}:00`}
            onChange={(e) => {
              const d = parseDateTimeKey(e.target.value.slice(0, 13))
              if (d) setQuery({ periodEnd: d })
            }}
          />
        </>
      )}
      <Button
        variant={query.comparePrevious ? "secondary" : "outline"}
        size="sm"
        className="h-7 text-xs"
        onClick={() => setQuery({ comparePrevious: !query.comparePrevious })}
      >
        对比上周期
      </Button>
    </div>
  )
}

function ViewToggleWithPeriodPopover() {
  const { query, setView } = useGlobalDashboardQuery()
  const [open, setOpen] = React.useState(false)

  const openPeriodPopover = React.useCallback(() => setOpen(true), [])

  const handleViewChange = React.useCallback(
    (v: string) => {
      if (v === "snapshot") {
        setView("snapshot")
        setOpen(false)
        return
      }
      if (v === "daily" || v === "hourly") {
        setView(v)
        setOpen(true)
      }
    },
    [setView],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <ToggleGroup
          type="single"
          value={query.view}
          onValueChange={handleViewChange}
          className="rounded-md border border-border/80 bg-muted/30 p-0.5"
        >
          <ToggleGroupItem
            value="snapshot"
            className="h-7 px-2.5 text-xs data-[state=on]:bg-background"
          >
            实时
          </ToggleGroupItem>
          <ToggleGroupItem
            value="daily"
            className="h-7 px-2.5 text-xs data-[state=on]:bg-background"
            onClick={openPeriodPopover}
          >
            按日
          </ToggleGroupItem>
          <ToggleGroupItem
            value="hourly"
            className="h-7 px-2.5 text-xs data-[state=on]:bg-background"
            onClick={openPeriodPopover}
          >
            按小时
          </ToggleGroupItem>
        </ToggleGroup>
      </PopoverAnchor>
      {query.view !== "snapshot" && (
        <PopoverContent align="start" className="w-auto min-w-[min(100vw-2rem,28rem)] p-3">
          <PeriodControlsPanel />
        </PopoverContent>
      )}
    </Popover>
  )
}

function GlobalDashboardHeaderInner() {
  const [now, setNow] = React.useState(() => new Date())
  const { query } = useGlobalDashboardQuery()
  const { cardType, setCardType, isLoading, refetch } = useGlobalDashboard()
  const { data: filterOptions } = trpc.dashboard.globalOps.getFilterOptions.useQuery()

  React.useEffect(() => {
    if (query.view !== "snapshot") return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [query.view])

  const scopeLabel = formatQueryScopeLabel(query, now)

  return (
    <div className="space-y-3 py-1">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight md:text-lg">
            算力资源运营监控大盘
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{scopeLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <ViewToggleWithPeriodPopover />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                {cardType === "all" ? "全部卡型" : cardType}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 w-40 overflow-y-auto">
              <DropdownMenuItem onClick={() => setCardType("all")}>全部卡型</DropdownMenuItem>
              {(filterOptions?.cardTypes ?? []).map((ct) => (
                <DropdownMenuItem key={ct} onClick={() => setCardType(ct)}>
                  {ct}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            刷新
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="通知">
            <Bell className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="全屏">
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function GlobalDashboardHeader() {
  return (
    <React.Suspense
      fallback={
        <div className="py-2 text-sm text-muted-foreground">算力资源运营监控大盘</div>
      }
    >
      <GlobalDashboardHeaderInner />
    </React.Suspense>
  )
}

export function GlobalDashboardScopeBar() {
  const { query } = useGlobalDashboardQuery()

  const badge =
    query.view === "snapshot"
      ? { label: "Snapshot", className: "bg-chart-1/15 text-chart-1" }
      : query.view === "daily"
        ? { label: "Daily", className: "bg-chart-2/15 text-chart-2" }
        : { label: "Hourly", className: "bg-chart-4/15 text-chart-4" }

  const copy =
    query.view === "snapshot"
      ? "dashboard.globalOps.getSnapshot · 与 /supplier/overview 同口径，每 60 秒自动刷新。"
      : query.view === "daily"
        ? "dashboard.globalOps.getPeriod(granularity=day) · 主值为期末存量，趋势为区间内按日回放。"
        : "dashboard.globalOps.getPeriod(granularity=hour) · 主值为期末存量，趋势为区间内按小时回放。"

  return (
    <React.Suspense fallback={null}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={cn("border-transparent font-medium", badge.className)}>
          {badge.label}
        </Badge>
        <span>{copy}</span>
        {query.comparePrevious && query.view !== "snapshot" && (
          <Badge variant="secondary" className="ml-auto">
            已开启上周期对比
          </Badge>
        )}
      </div>
    </React.Suspense>
  )
}
