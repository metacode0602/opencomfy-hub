"use client"

import { Suspense } from "react"
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

const poolChartConfig = {
  elastic_service: {
    label: "弹性用量池",
    theme: { light: "var(--chart-1)", dark: "var(--chart-1)" },
  },
  bare_metal: {
    label: "裸金属池",
    theme: { light: "var(--chart-2)", dark: "var(--chart-2)" },
  },
} satisfies ChartConfig

function ResourcePoolChartCardInner() {
  const { data, isLoading, isSnapshot } = useGlobalDashboard()

  const pools = data?.resourcePools
  const isCardHours = pools?.displayUnit === "card_hours"
  const valueUnit = isCardHours ? "卡时" : "卡"

  const slices = pools?.slices ?? []
  const pieData = slices.map((s) => ({
    name: s.key,
    value: isCardHours ? (s.cardHours ?? 0) : s.gpuCount,
    key: s.key,
  }))

  return (
    <Card className="border-border/80 lg:col-span-6">
      <CardHeader>
        <CardTitle className="text-base">资源池分布</CardTitle>
        <CardDescription>
          {isSnapshot
            ? "平台两池 GPU 占用（可与总量重叠计数）"
            : "区间累计供应卡时（按变更日志回放在线×卡数×时长）"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DashboardCardLoading label="加载资源池…" />
        ) : pieData.length === 0 || pieData.every((p) => p.value === 0) ? (
          <p className="py-12 text-center text-sm text-muted-foreground">暂无池占用数据</p>
        ) : (
          <div className="mx-auto max-w-md">
            <ChartContainer config={poolChartConfig} className="mx-auto aspect-square w-full">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => {
                        const label =
                          poolChartConfig[name as keyof typeof poolChartConfig]?.label ?? name
                        return (
                          <span className="font-medium">
                            {label}：{formatCompactHours(Number(value))} {valueUnit}
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
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
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
                              y={pools?.centerSecondary ? (viewBox.cy ?? 0) - 8 : viewBox.cy}
                              className="fill-foreground text-base font-bold"
                            >
                              {pools?.centerPrimary ?? "—"}
                            </tspan>
                            {pools?.centerSecondary && (
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 14}
                                className="fill-muted-foreground text-[10px]"
                              >
                                {pools.centerSecondary}
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
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {slices.map((s) => (
                <div
                  key={s.key}
                  className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="tabular-nums text-muted-foreground">
                    {isCardHours ? (
                      <>
                        {formatCompactHours(s.cardHours ?? 0)} 卡时
                        {s.netChangeLabel && (
                          <span className="ml-1 text-foreground/80">· {s.netChangeLabel}</span>
                        )}
                      </>
                    ) : (
                      <>
                        {s.gpuCount.toLocaleString()} 卡 · {s.deviceCount} 台
                      </>
                    )}
                  </div>
                  {isSnapshot && s.breakdownSnapshot && s.breakdownSnapshot.length > 0 && (
                    <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                      {s.breakdownSnapshot.map((row) => (
                        <div key={row.cardType}>
                          {row.cardType} · {row.onlineGpuCards.toLocaleString()} 卡
                        </div>
                      ))}
                    </div>
                  )}
                  {!isSnapshot && s.breakdownPeriod && s.breakdownPeriod.length > 0 && (
                    <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                      {s.breakdownPeriod.map((row) => (
                        <div key={row.cardType}>
                          {row.cardType} - {formatCompactHours(row.machineHours)}台时 -{" "}
                          {formatCompactHours(row.cardHours)}卡时
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {pools?.footnote && (
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                {pools.footnote}
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
