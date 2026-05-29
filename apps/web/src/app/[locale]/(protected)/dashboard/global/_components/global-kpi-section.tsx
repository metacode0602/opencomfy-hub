"use client"

import Link from "next/link"
import { Area, AreaChart, XAxis } from "recharts"
import {
  ArrowDown,
  Cpu,
  HardDrive,
  Layers,
  Package,
  Server,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from "lucide-react"

import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"

import { DashboardCardError, DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"
import {
  formatGpuTotalSnapshotDelta,
  formatGpuTotalSnapshotSubtitle,
  formatKpiValue,
} from "../_lib/format-kpi"

const KPI_ICONS = [Cpu, Server, Layers, HardDrive, Warehouse, Package, ArrowDown, TrendingDown]

const sparklineConfig = {
  v: {
    label: "数值",
    theme: { light: "var(--chart-1)", dark: "var(--chart-1)" },
  },
} satisfies ChartConfig

function KpiSparkline({
  data,
  warning,
  unit,
}: {
  data: Array<{ i: string; v: number; label: string }>
  warning?: boolean
  unit: string
}) {
  if (data.length < 2) return null

  return (
    <ChartContainer
      config={sparklineConfig}
      className="h-10 w-full overflow-visible [&>div]:aspect-auto"
    >
      <AreaChart data={data} margin={{ left: 2, right: 2, top: 4, bottom: 0 }}>
        <XAxis dataKey="i" hide />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const point = payload[0]?.payload as { label: string; v: number } | undefined
            if (!point) return null
            return (
              <div className="grid min-w-[9rem] gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <div className="font-medium text-foreground">{point.label}</div>
                <div className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span>数值</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {Number(point.v).toLocaleString()} {unit}
                  </span>
                </div>
              </div>
            )
          }}
        />
        <Area
          dataKey="v"
          type="monotone"
          fill={warning ? "var(--chart-4)" : "var(--color-v)"}
          fillOpacity={0.25}
          stroke={warning ? "var(--chart-4)" : "var(--color-v)"}
          strokeWidth={1.5}
          dot={{ r: 2, strokeWidth: 0 }}
          activeDot={{ r: 3.5, strokeWidth: 1.5, stroke: "var(--background)" }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function GlobalKpiSection() {
  const { data, isLoading, isError, isSnapshot } = useGlobalDashboard()

  if (isLoading) {
    return <DashboardCardLoading label="加载 KPI…" />
  }

  if (isError || !data) {
    return <DashboardCardError message="KPI 加载失败，请刷新页面重试" />
  }

  const footnote = isSnapshot
    ? `数据截至 ${new Date(data.meta.asOf).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}。${data.resourcePools.footnote}`
    : `区间 ${new Date(data.meta.periodStart!).toLocaleDateString("zh-CN")} ~ ${new Date(data.meta.periodEnd!).toLocaleDateString("zh-CN")} · 主值为期末存量，副值为区间净增`

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {data.kpis.map((kpi, idx) => {
          const Icon = KPI_ICONS[idx] ?? Cpu
          const sparkline =
            kpi.trend?.map((p, i) => ({ i: String(i), v: p.value, label: p.label })) ?? []
          const isGpuTotal = kpi.key === "gpu_total"
          const gpuTotalSubtitle =
            isSnapshot && isGpuTotal ? formatGpuTotalSnapshotSubtitle(kpi) : null
          const snapshotGpuDelta =
            isSnapshot && isGpuTotal ? formatGpuTotalSnapshotDelta(kpi) : null
          const deltaLabel = isSnapshot
            ? (snapshotGpuDelta?.label ?? "与资源总览同口径")
            : (kpi.netChangeLabel ?? "净增 —")
          const deltaUp = isSnapshot
            ? (snapshotGpuDelta?.up ?? true)
            : (kpi.netChangeUp ?? true)

          const inner = (
            <Card
              className={cn(
                "border-border/80 shadow-sm transition-colors",
                kpi.warning && "border-chart-4/30",
                kpi.href && "hover:bg-muted/30",
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4">
                <Icon
                  className={cn(
                    "size-4",
                    kpi.warning ? "text-chart-4" : "text-muted-foreground",
                  )}
                />
                <p className="text-xs text-muted-foreground">{kpi.title}</p>
              </CardHeader>
              <CardContent className="pb-3">
                <div
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    kpi.warning && "text-chart-4",
                  )}
                >
                  {isGpuTotal && isSnapshot ? (
                    <span className="flex flex-row items-center gap-0.5">
                      <span>{formatKpiValue(kpi, isSnapshot)} 卡</span>
                      {gpuTotalSubtitle && (
                        <span className="text-sm font-normal text-muted-foreground">
                          {gpuTotalSubtitle}
                        </span>
                      )}
                    </span>
                  ) : (
                    formatKpiValue(kpi, isSnapshot)
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex flex-col gap-0 text-xs font-medium",
                      deltaUp ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    )}
                  >
                    <span className="flex items-center gap-0.5">
                      {deltaUp ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}
                      {deltaLabel}
                    </span>
                  </span>
                  {sparkline.length >= 2 && (
                    <div className="min-w-0 flex-1">
                      <KpiSparkline
                        data={sparkline}
                        warning={kpi.warning}
                        unit={kpi.unit.includes("卡") ? "卡" : kpi.unit}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
          return kpi.href ? (
            <Link key={kpi.key} href={kpi.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={kpi.key}>{inner}</div>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{footnote}</p>
    </div>
  )
}
