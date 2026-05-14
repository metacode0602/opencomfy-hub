"use client"

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
import { ChartContainer, type ChartConfig } from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"

const sparklineConfig = {
  v: {
    label: "趋势",
    theme: { light: "var(--chart-1)", dark: "var(--chart-1)" },
  },
} satisfies ChartConfig

const sparklineWarningConfig = {
  v: {
    label: "趋势",
    theme: { light: "var(--chart-4)", dark: "var(--chart-4)" },
  },
} satisfies ChartConfig

const KPI_ITEMS = [
  {
    title: "GPU 总卡数",
    value: "4,280",
    unit: "卡",
    delta: "+3.2%",
    up: true,
    icon: Cpu,
    warning: false,
  },
  {
    title: "在线设备",
    value: "1,280",
    unit: "台",
    delta: "+1.1%",
    up: true,
    icon: Server,
    warning: false,
  },
  {
    title: "弹性资源池",
    value: "780",
    unit: "卡",
    delta: "+0.8%",
    up: true,
    icon: Layers,
    warning: false,
  },
  {
    title: "裸金属池",
    value: "220",
    unit: "卡",
    delta: "-0.4%",
    up: false,
    icon: HardDrive,
    warning: false,
  },
  {
    title: "内部测试占用",
    value: "180",
    unit: "台",
    delta: "+2.0%",
    up: true,
    icon: Warehouse,
    warning: false,
  },
  {
    title: "异常设备",
    value: "12",
    unit: "台",
    delta: "+2",
    up: false,
    icon: Package,
    warning: true,
    valueClass: "text-destructive",
  },
  {
    title: "待上架设备",
    value: "9",
    unit: "台",
    delta: "-1",
    up: true,
    icon: ArrowDown,
    warning: true,
    valueClass: "text-chart-4",
  },
  {
    title: "待上架机房",
    value: "5",
    unit: "个",
    delta: "0",
    up: true,
    icon: TrendingDown,
    warning: true,
    valueClass: "text-destructive",
  },
] as const

function miniSpark(up: boolean) {
  const base = up ? 40 : 55
  return Array.from({ length: 8 }, (_, i) => ({
    i: String(i),
    v: base + (up ? i * 3 : -i * 2) + (i % 2) * 2,
  }))
}

function KpiSparkline({
  data,
  warning,
}: {
  data: { i: string; v: number }[]
  warning?: boolean
}) {
  const cfg = warning ? sparklineWarningConfig : sparklineConfig
  return (
    <ChartContainer config={cfg} className="h-10 w-full [&>div]:aspect-auto">
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
        <XAxis dataKey="i" hide />
        <Area
          dataKey="v"
          type="monotone"
          fill="var(--color-v)"
          fillOpacity={0.25}
          stroke="var(--color-v)"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function GlobalKpiSection() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {KPI_ITEMS.map((kpi) => {
        const Icon = kpi.icon
        const spark = miniSpark(kpi.up)
        return (
          <Card
            key={kpi.title}
            className={cn("border-border/80 shadow-sm", kpi.warning && "border-chart-4/30")}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4">
              <Icon
                className={cn(
                  "size-4",
                  kpi.warning ? "text-chart-4" : "text-muted-foreground"
                )}
              />
              <div>
                <p className="text-xs text-muted-foreground">{kpi.title}</p>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    "valueClass" in kpi ? kpi.valueClass : undefined
                  )}
                >
                  {kpi.value}
                </span>
                <span className="text-xs text-muted-foreground">{kpi.unit}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    kpi.delta.startsWith("+") || kpi.delta === "0"
                      ? kpi.warning && !kpi.up
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                >
                  {kpi.up ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {kpi.delta}
                </span>
                <div className="min-w-0 flex-1">
                  <KpiSparkline data={spark} warning={kpi.warning} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
