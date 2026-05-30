"use client"

import { Suspense, useMemo } from "react"
import { Cell, Label, Pie, PieChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"

import { DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"
import { formatCompactHours } from "../_lib/format-kpi"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

function ResourcePoolChartCardInner() {
  const { data, isLoading, isSnapshot } = useGlobalDashboard()

  const composition = data?.resourceComposition
  const slices = composition?.slices ?? []

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    slices.forEach((s, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length]!
      config[s.key] = {
        label: s.label,
        theme: { light: color, dark: color },
      }
    })
    return config
  }, [slices])

  const useCardHours = composition?.displayUnit === "card_hours"

  const pieData = slices.map((s) => ({
    name: s.key,
    value: useCardHours ? (s.cardHours ?? 0) : s.gpuCount,
    key: s.key,
    kind: s.kind,
  }))

  return (
    <Card className="border-border/80 lg:col-span-6">
      <CardHeader>
        <CardTitle className="text-base">资源构成</CardTitle>
        <CardDescription>
          {isSnapshot
            ? "互斥分桶 · 含计划缺口（非退订设备 + 虚拟计划量）"
            : "区间供应卡时（主数据状态时序 + 计划批次进度；变更表仅更新批次缺口）"}
          {composition?.approximate && (
            <span className="block text-amber-600 dark:text-amber-500">
              主数据快照缺失，实体卡时按当前态近似
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DashboardCardLoading label="加载资源构成…" />
        ) : pieData.length === 0 || pieData.every((p) => p.value === 0) ? (
          <p className="py-12 text-center text-sm text-muted-foreground">暂无资源构成数据</p>
        ) : (
          <div className="mx-auto max-w-md">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => {
                        const slice = slices.find((s) => s.key === name)
                        const label = slice?.label ?? String(name)
                        if (useCardHours) {
                          const mh = slice?.machineHours
                          return (
                            <span className="font-medium">
                              {label}：{formatCompactHours(Number(value))} 卡时
                              {mh != null ? `（${formatCompactHours(mh)} 台时）` : ""}
                            </span>
                          )
                        }
                        return (
                          <span className="font-medium">
                            {label}：{formatCompactHours(Number(value))} 卡
                          </span>
                        )
                      }}
                    />
                  }
                />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="48%"
                  outerRadius="85%"
                  paddingAngle={slices.length > 6 ? 1 : 2}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      stroke={entry.kind === "pipeline_virtual" ? "var(--border)" : undefined}
                      strokeDasharray={entry.kind === "pipeline_virtual" ? "4 3" : undefined}
                    />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={composition?.centerSecondary ? (viewBox.cy ?? 0) - 8 : viewBox.cy}
                              className="fill-foreground text-base font-bold"
                            >
                              {composition?.centerPrimary ?? "—"}
                            </tspan>
                            {composition?.centerSecondary && (
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 14}
                                className="fill-muted-foreground text-[10px]"
                              >
                                {composition.centerSecondary}
                              </tspan>
                            )}
                          </text>
                        )
                      }
                      return null
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {slices.map((s, index) => (
                <div
                  key={s.key}
                  className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: CHART_COLORS[index % CHART_COLORS.length],
                  }}
                >
                  <div className="font-medium">
                    {s.label}
                    {s.kind === "pipeline_virtual" && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        计划
                      </span>
                    )}
                  </div>
                  <div className="tabular-nums text-muted-foreground">
                    {useCardHours ? (
                      <>
                        {(s.cardHours ?? 0).toLocaleString()} 卡时
                        {s.machineHours != null && (
                          <> · {s.machineHours.toLocaleString()} 台时</>
                        )}
                        <span className="text-[10px]">
                          {" "}
                          · 期末 {s.gpuCount.toLocaleString()} 卡
                        </span>
                      </>
                    ) : (
                      <>
                        {s.gpuCount.toLocaleString()} 卡 · {s.deviceCount.toLocaleString()} 台
                      </>
                    )}
                    {s.netChangeLabel && (
                      <span className="ml-1 text-foreground/80">· {s.netChangeLabel}</span>
                    )}
                  </div>
                  {s.breakdownByCardType && s.breakdownByCardType.length > 0 && (
                    <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                      {s.breakdownByCardType.map((row) => (
                        <div key={row.cardType}>
                          {row.cardType}
                          {useCardHours && row.cardHours != null
                            ? ` · ${row.cardHours.toLocaleString()} 卡时`
                            : ` · ${row.gpuCount.toLocaleString()} 卡`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {composition?.footnote && (
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                {composition.footnote}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ResourcePoolChartCard() {
  return (
    <Suspense fallback={null}>
      <ResourcePoolChartCardInner />
    </Suspense>
  )
}
