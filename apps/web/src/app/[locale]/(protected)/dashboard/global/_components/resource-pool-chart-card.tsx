"use client"

import * as React from "react"
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
import { cn } from "@workspace/ui/lib/utils"

const poolChartConfig = {
  platform: {
    label: "弹性服务部署",
    theme: { light: "var(--chart-1)", dark: "var(--chart-1)" },
  },
  dedicated: {
    label: "裸金属短租",
    theme: { light: "var(--chart-2)", dark: "var(--chart-2)" },
  },
  inference: {
    label: "Job任务",
    theme: { light: "var(--chart-3)", dark: "var(--chart-3)" },
  },
  training: {
    label: "云主机",
    theme: { light: "var(--chart-4)", dark: "var(--chart-4)" },
  },
  standby: {
    label: "内部测试",
    theme: { light: "var(--chart-5)", dark: "var(--chart-5)" },
  },
  maintenance: {
    label: "维保中",
    theme: { light: "var(--chart-2)", dark: "var(--chart-2)" },
  },
} satisfies ChartConfig

const POOL_PIE = [
  { name: "platform", value: 620, key: "platform" as const },
  { name: "dedicated", value: 480, key: "dedicated" as const },
  { name: "inference", value: 510, key: "inference" as const },
  { name: "training", value: 430, key: "training" as const },
  { name: "standby", value: 280, key: "standby" as const },
  { name: "maintenance", value: 181, key: "maintenance" as const },
]

const POOL_DETAILS: Record<
  (typeof POOL_PIE)[number]["key"],
  {
    title: string
    utilization: string
    count: string
    gpu: string
    finance: string
  }
> = {
  platform: {
    title: "弹性服务部署",
    utilization: "68.2%",
    count: "620 台",
    gpu: "A100 52% · H100 48%",
    finance: "收入 +12% / 成本稳定",
  },
  dedicated: {
    title: "裸金属短租",
    utilization: "71.0%",
    count: "480 台",
    gpu: "A100 80GB 为主",
    finance: "合同履约正常",
  },
  inference: {
    title: "Job任务",
    utilization: "59.4%",
    count: "510 台",
    gpu: "H100 60%",
    finance: "按量计费",
  },
  training: {
    title: "云主机",
    utilization: "55.1%",
    count: "430 台",
    gpu: "A100 / H100 混合",
    finance: "预留 + 突发",
  },
  standby: {
    title: "内部测试",
    utilization: "22.0%",
    count: "280 台",
    gpu: "多型号",
    finance: "缓冲成本",
  },
  maintenance: {
    title: "维保中",
    utilization: "—",
    count: "181 台",
    gpu: "维保中",
    finance: "停机不计费",
  },
}

const RADIAN = Math.PI / 180

/** 与 Recharts PolarUtils.polarToCartesian 一致（angle 为度） */
function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + Math.cos(-RADIAN * angle) * radius,
    y: cy + Math.sin(-RADIAN * angle) * radius,
  }
}

function getPoolTotal() {
  return POOL_PIE.reduce((s, x) => s + x.value, 0)
}

const PIE_START = 90
const PIE_END = -270
const PIE_PADDING = 1.5

/** 与 Recharts `computePieSectors` 一致，得到各扇区中点角度（度，与 polarToCartesian 一致） */
function getSectorMidAnglesDegrees(): number[] {
  const values = POOL_PIE.map((p) => p.value)
  const sum = values.reduce((a, b) => a + b, 0)
  const notZeroItemCount = values.filter((v) => v !== 0).length
  const sign = Math.sign(PIE_END - PIE_START)
  const absDelta = Math.min(Math.abs(PIE_END - PIE_START), 360)
  const totalPaddingAngle =
    (absDelta >= 360 ? notZeroItemCount : Math.max(0, notZeroItemCount - 1)) * PIE_PADDING
  const realTotalAngle = absDelta - totalPaddingAngle

  const mids: number[] = []
  let prevEnd: number | undefined
  for (let i = 0; i < values.length; i++) {
    const val = values[i]!
    let start: number
    if (i > 0) {
      start = prevEnd! + sign * PIE_PADDING * (val !== 0 ? 1 : 0)
    } else {
      start = PIE_START
    }
    const end = start + sign * ((val / sum) * realTotalAngle)
    mids.push((start + end) / 2)
    prevEnd = end
  }
  return mids
}

const SECTOR_MID_DEG = getSectorMidAnglesDegrees()

function getSliceOuterPoints(cx: number, cy: number, outerR: number) {
  return SECTOR_MID_DEG.map((midDeg) => polarToCartesian(cx, cy, outerR, midDeg))
}

/** 折线路径：饼边 → 正交肘点 → 卡片锚点（朝向圆心一侧边中点） */
function elbowPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx
  const dy = ty - sy
  const preferHorizontal = Math.abs(dx) >= Math.abs(dy)
  if (preferHorizontal) {
    const mx = sx + dx * 0.55
    return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`
  }
  const my = sy + dy * 0.55
  return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`
}

function anchorTowardCenter(
  rect: DOMRect,
  container: DOMRect,
  cx: number,
  cy: number
): { x: number; y: number } {
  const left = rect.left - container.left
  const right = rect.right - container.left
  const top = rect.top - container.top
  const bottom = rect.bottom - container.top
  const mx = (left + right) / 2
  const my = (top + bottom) / 2
  const vx = cx - mx
  const vy = cy - my
  if (Math.abs(vx) >= Math.abs(vy)) {
    const x = vx >= 0 ? right : left
    return { x, y: my }
  }
  const y = vy >= 0 ? bottom : top
  return { x: mx, y }
}

export function ResourcePoolChartCard() {
  const totalPool = React.useMemo(() => getPoolTotal(), [])
  const utilization = "62.7%"

  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartWrapRef = React.useRef<HTMLDivElement>(null)
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([])

  const [paths, setPaths] = React.useState<string[]>([])

  const measure = React.useCallback(() => {
    const container = containerRef.current
    const chartWrap = chartWrapRef.current
    if (!container || !chartWrap) return

    const cr = container.getBoundingClientRect()
    const hr = chartWrap.getBoundingClientRect()
    const cx = hr.left + hr.width / 2 - cr.left
    const cy = hr.top + hr.height / 2 - cr.top
    // 与 Pie outerRadius 百分比大致对齐（联线起点落在扇区外缘）
    const outerR = (Math.min(hr.width, hr.height) / 2) * 0.93

    const slicePts = getSliceOuterPoints(cx, cy, outerR)

    const next: string[] = []
    for (let i = 0; i < POOL_PIE.length; i++) {
      const el = cardRefs.current[i]
      if (!el) {
        next.push("")
        continue
      }
      const br = el.getBoundingClientRect()
      const anchor = anchorTowardCenter(br, cr, cx, cy)
      const pt = slicePts[i]
      if (!pt) {
        next.push("")
        continue
      }
      const { x: sx, y: sy } = pt
      next.push(elbowPath(sx, sy, anchor.x, anchor.y))
    }
    setPaths(next)
  }, [])

  React.useLayoutEffect(() => {
    const run = () => {
      requestAnimationFrame(() => requestAnimationFrame(measure))
    }
    run()
    const ro = new ResizeObserver(run)
    if (containerRef.current) ro.observe(containerRef.current)
    if (chartWrapRef.current) ro.observe(chartWrapRef.current)
    window.addEventListener("resize", run)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", run)
    }
  }, [measure])

  return (
    <Card className="border-border/80 lg:col-span-6">
      <CardHeader>
        <CardTitle className="text-base">资源池分布与利用率</CardTitle>
        <CardDescription>各池规模、型号结构与财务概览</CardDescription>
      </CardHeader>
      <CardContent className="overflow-visible pb-2">
        <div
          ref={containerRef}
          className="relative mx-auto aspect-[10/9] w-full max-w-4xl min-h-[min(92vw,520px)] sm:aspect-[16/11] sm:min-h-[440px]"
        >
          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            {paths.map(
              (pathD, i) =>
                pathD && (
                  <path
                    key={POOL_PIE[i]!.key}
                    d={pathD}
                    fill="none"
                    stroke={`var(--color-${POOL_PIE[i]!.key})`}
                    strokeWidth={2.5}
                    strokeOpacity={1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )
            )}
          </svg>

          {POOL_PIE.map((p, i) => {
            const midDeg = SECTOR_MID_DEG[i]!
            const orbitPct = 47
            const pOrbit = polarToCartesian(50, 50, orbitPct, midDeg)
            const detail = POOL_DETAILS[p.key]
            return (
              <div
                key={p.key}
                ref={(node) => {
                  cardRefs.current[i] = node
                }}
                className={cn(
                  "absolute z-[1] w-[min(42vw,148px)] max-w-[148px] rounded-lg border border-dashed bg-muted/20 p-2 text-[10px] shadow-sm backdrop-blur-[2px] sm:w-[158px] sm:max-w-[158px] sm:p-2.5 sm:text-xs",
                  "border-border/80"
                )}
                style={{
                  left: `${pOrbit.x}%`,
                  top: `${pOrbit.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="size-2 shrink-0 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: `var(--color-${p.key})` }}
                />
                <div className="mt-1 font-medium leading-tight text-foreground">{detail.title}</div>
                <div className="mt-0.5 text-muted-foreground">
                  利用率 <span className="text-foreground">{detail.utilization}</span> · {detail.count}
                </div>
                <div className="mt-0.5 line-clamp-2 text-muted-foreground">{detail.gpu}</div>
                <div className="mt-0.5 line-clamp-2 text-muted-foreground">{detail.finance}</div>
              </div>
            )
          })}

          <div
            ref={chartWrapRef}
            className="absolute left-1/2 top-1/2 z-[2] w-[min(68%,280px)] -translate-x-1/2 -translate-y-1/2 sm:w-[min(62%,340px)]"
          >
            <ChartContainer
              config={poolChartConfig}
              className="mx-auto aspect-square w-full [&>div]:aspect-square"
            >
              <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={POOL_PIE}
                  dataKey="value"
                  nameKey="name"
                  startAngle={90}
                  endAngle={-270}
                  innerRadius="48%"
                  outerRadius="93%"
                  strokeWidth={1.5}
                  paddingAngle={1.5}
                >
                  {POOL_PIE.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={`var(--color-${entry.key})`}
                      stroke="var(--background)"
                      strokeOpacity={0.45}
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
                              y={(viewBox.cy ?? 0) - 8}
                              className="fill-foreground text-lg font-bold"
                            >
                              总计 {totalPool.toLocaleString()}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 14}
                              className="fill-muted-foreground text-xs"
                            >
                              利用率 {utilization}
                            </tspan>
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
        </div>
      </CardContent>
    </Card>
  )
}
