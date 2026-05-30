"use client"

import { Suspense, useCallback, useMemo } from "react"
import { Cell, Label, Pie, PieChart } from "recharts"
import type { PieLabelRenderProps } from "recharts"

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

import type { GlobalResourceCompositionSlice } from "@/lib/types/global-dashboard-api"

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

const RADIAN = Math.PI / 180
const MIN_LABEL_PERCENT = 0.03
const MAX_VISIBLE_LEGEND_SLICES = 7

/** 仅扩大 SVG 画布留白，饼图与引导线 label 保持固定像素尺寸 */
const CANVAS_BASE_SIZE = 480
const CANVAS_SCALE = 1.25
const CANVAS_SIZE = Math.round(CANVAS_BASE_SIZE * CANVAS_SCALE)
const CANVAS_PADDING = (CANVAS_SIZE - CANVAS_BASE_SIZE) / 2
const CHART_MARGIN = {
  top: 16 + CANVAS_PADDING * 0.85,
  right: 24 + CANVAS_PADDING,
  bottom: 16 + CANVAS_PADDING * 0.85,
  left: 24 + CANVAS_PADDING,
}

/** 上一版 480px 画布 + 70%/46% 半径下的实际像素尺寸 */
const PIE_OUTER_RADIUS_PX = Math.round(CANVAS_BASE_SIZE * 0.5 * 0.7)
const PIE_INNER_RADIUS_PX = Math.round(CANVAS_BASE_SIZE * 0.5 * 0.46)
const LABEL_BASE_OUTER_RADIUS = PIE_OUTER_RADIUS_PX

function getLabelMetrics(outerRadius: number) {
  const scale = Math.max(0.95, Math.min(1.55, outerRadius / LABEL_BASE_OUTER_RADIUS))

  return {
    scale,
    titleSize: 12 * scale,
    metricSize: 10.5 * scale,
    leaderGap: 14 * scale,
    elbowOffset: 10 * scale,
    textGap: 8 * scale,
    dotRadius: 2.2 * scale,
    strokeWidth: 1 * scale,
    lineHeight: 1.15 * scale,
  }
}

function getCenterLabelMetrics(viewBox: {
  innerRadius?: number
  outerRadius?: number
  cx?: number
  cy?: number
}) {
  const innerRadius = Number(viewBox.innerRadius ?? 0)
  const scale =
    innerRadius > 0 ? Math.max(0.95, Math.min(1.5, innerRadius / 52)) : 1

  return {
    primarySize: 16 * scale,
    secondarySize: 11 * scale,
    lineGap: 14 * scale,
  }
}

type ResourcePoolPieDatum = {
  name: string
  value: number
  key: string
  kind: GlobalResourceCompositionSlice["kind"]
  fill: string
  slice: GlobalResourceCompositionSlice
}

function formatSlicePrimaryMetric(slice: GlobalResourceCompositionSlice, useCardHours: boolean) {
  if (useCardHours) {
    return `${(slice.cardHours ?? 0).toLocaleString()} 卡时`
  }
  return `${slice.gpuCount.toLocaleString()} 卡`
}

function ResourcePoolSliceLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  percent = 0,
  fill,
  payload,
  index = 0,
  useCardHours,
  sliceCount,
}: PieLabelRenderProps & { useCardHours: boolean; sliceCount: number }) {
  const slice = (payload as ResourcePoolPieDatum | undefined)?.slice
  if (!slice) {
    return null
  }
  if (sliceCount > MAX_VISIBLE_LEGEND_SLICES && index >= MAX_VISIBLE_LEGEND_SLICES) {
    return null
  }
  if (sliceCount > MAX_VISIBLE_LEGEND_SLICES && percent < MIN_LABEL_PERCENT) {
    return null
  }

  const color = fill ?? CHART_COLORS[0]
  const cos = Math.cos(-midAngle * RADIAN)
  const sin = Math.sin(-midAngle * RADIAN)
  const radius = Number(outerRadius)
  const {
    titleSize,
    metricSize,
    leaderGap,
    elbowOffset,
    textGap,
    dotRadius,
    strokeWidth,
    lineHeight,
  } = getLabelMetrics(radius)
  const sx = cx + radius * cos
  const sy = cy + radius * sin
  const mx = cx + (radius + leaderGap) * cos
  const my = cy + (radius + leaderGap) * sin
  const ex = mx + (cos >= 0 ? 1 : -1) * elbowOffset
  const ey = my
  const textAnchor = cos >= 0 ? "start" : "end"
  const textX = ex + (cos >= 0 ? 1 : -1) * textGap

  return (
    <g className="recharts-pie-label-text">
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={color}
        fill="none"
        strokeWidth={strokeWidth}
        opacity={0.55}
      />
      <circle cx={ex} cy={ey} r={dotRadius} fill={color} stroke="none" />
      <text x={textX} y={ey} textAnchor={textAnchor} dominantBaseline="central">
        <tspan fill={color} fontSize={titleSize} fontWeight={500}>
          {slice.label}
          {slice.kind === "pipeline_virtual" ? " · 计划" : ""}
        </tspan>
        <tspan
          x={textX}
          dy={`${lineHeight}em`}
          className="fill-muted-foreground"
          fontSize={metricSize}
        >
          {formatSlicePrimaryMetric(slice, useCardHours)}
          {slice.netChangeLabel ? ` · ${slice.netChangeLabel}` : ""}
        </tspan>
      </text>
    </g>
  )
}

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

  const pieData = useMemo<ResourcePoolPieDatum[]>(
    () =>
      slices.map((s, index) => ({
        name: s.key,
        value: useCardHours ? (s.cardHours ?? 0) : s.gpuCount,
        key: s.key,
        kind: s.kind,
        fill: CHART_COLORS[index % CHART_COLORS.length]!,
        slice: s,
      })),
    [slices, useCardHours],
  )

  const renderSliceLabel = useCallback(
    (props: PieLabelRenderProps) => {
      const { key, ...labelProps } = props as PieLabelRenderProps & { key?: React.Key }
      return (
        <ResourcePoolSliceLabel
          key={key}
          {...labelProps}
          useCardHours={useCardHours}
          sliceCount={slices.length}
        />
      )
    },
    [useCardHours, slices.length],
  )

  return (
    <Card className="flex h-full min-h-0 flex-col border-border/80 lg:col-span-6">
      <CardHeader className="shrink-0">
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
      <CardContent className="flex min-h-0 flex-1 flex-col pb-3 pt-0">
        {isLoading ? (
          <DashboardCardLoading label="加载资源构成…" />
        ) : pieData.length === 0 || pieData.every((p) => p.value === 0) ? (
          <p className="py-12 text-center text-sm text-muted-foreground">暂无资源构成数据</p>
        ) : (
          <div
            className="flex min-h-[450px] flex-1 items-center justify-center sm:min-h-[500px] lg:min-h-[550px]"
            style={{ containerType: "size" }}
          >
            <ChartContainer
              config={chartConfig}
              initialDimension={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              className="aspect-square max-h-full max-w-full [height:min(100cqh,100cqw)] [width:min(100cqh,100cqw)] [&_.recharts-pie-label-text]:fill-foreground [&_.recharts-responsive-container]:!size-full"
            >
              <PieChart margin={CHART_MARGIN}>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="gap-2 px-3 py-2 text-sm"
                    formatter={(value, name) => {
                      const slice = slices.find((s) => s.key === name)
                      const label = slice?.label ?? String(name)
                      if (useCardHours) {
                        const mh = slice?.machineHours
                        return (
                          <div className="grid gap-1.5">
                            <span className="font-semibold">
                              {label}：{formatCompactHours(Number(value))} 卡时
                              {mh != null ? `（${formatCompactHours(mh)} 台时）` : ""}
                            </span>
                            {slice?.gpuCount != null && (
                              <span className="text-muted-foreground">
                                期末 {slice.gpuCount.toLocaleString()} 卡
                              </span>
                            )}
                            {slice?.breakdownByCardType?.map((row) => (
                              <span key={row.cardType} className="text-muted-foreground">
                                {row.cardType}
                                {row.cardHours != null
                                  ? ` · ${row.cardHours.toLocaleString()} 卡时`
                                  : ` · ${row.gpuCount.toLocaleString()} 卡`}
                              </span>
                            ))}
                          </div>
                        )
                      }
                      return (
                        <div className="grid gap-1.5">
                          <span className="font-semibold">
                            {label}：{formatCompactHours(Number(value))} 卡
                          </span>
                          {slice?.deviceCount != null && (
                            <span className="text-muted-foreground">
                              {slice.deviceCount.toLocaleString()} 台
                            </span>
                          )}
                          {slice?.breakdownByCardType?.map((row) => (
                            <span key={row.cardType} className="text-muted-foreground">
                              {row.cardType} · {row.gpuCount.toLocaleString()} 卡
                            </span>
                          ))}
                        </div>
                      )
                    }}
                  />
                }
              />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={PIE_INNER_RADIUS_PX}
                outerRadius={PIE_OUTER_RADIUS_PX}
                paddingAngle={slices.length > 6 ? 1 : 2}
                minAngle={2}
                labelLine={false}
                label={renderSliceLabel}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.fill}
                    stroke={entry.kind === "pipeline_virtual" ? "var(--border)" : undefined}
                    strokeDasharray={entry.kind === "pipeline_virtual" ? "4 3" : undefined}
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      const { primarySize, secondarySize, lineGap } = getCenterLabelMetrics(viewBox)
                      const hasSecondary = Boolean(composition?.centerSecondary)

                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={hasSecondary ? (viewBox.cy ?? 0) - lineGap / 2 : viewBox.cy}
                            className="fill-foreground"
                            fontSize={primarySize}
                            fontWeight={700}
                          >
                            {composition?.centerPrimary ?? "—"}
                          </tspan>
                          {composition?.centerSecondary && (
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + lineGap / 2}
                              className="fill-muted-foreground"
                              fontSize={secondarySize}
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
