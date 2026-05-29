"use client"

import { useCallback, useState } from "react"
import { LayoutGroup, motion } from "framer-motion"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const TOTAL = 64
const DIST = { elastic: 28, bare: 14, internal: 8, offline: 8, frozen: 6 } as const
const DELAY_K8S = 40
const DELAY_FINAL = 50

type MachineState = "pending" | "elastic" | "bare" | "internal" | "offline" | "frozen"
type ZoneId = "pool" | "k8s" | "offline" | "elastic" | "bare" | "internal" | "frozen"

interface Machine {
  id: number
  state: MachineState
  zone: ZoneId
  arriving: boolean
}

const STATE_COLORS: Record<MachineState, { bg: string; border: string }> = {
  pending: { bg: "#D3D1C7", border: "#B4B2A9" },
  elastic: { bg: "#7F77DD", border: "#534AB7" },
  bare: { bg: "#D85A30", border: "#993C1D" },
  internal: { bg: "#1D9E75", border: "#0F6E56" },
  offline: { bg: "#EF9F27", border: "#BA7517" },
  frozen: { bg: "#85B7EB", border: "#378ADD" },
}

const LEGEND_ITEMS: { label: string; state: MachineState }[] = [
  { label: "待分配", state: "pending" },
  { label: "弹性服务", state: "elastic" },
  { label: "裸金属", state: "bare" },
  { label: "内部占用", state: "internal" },
  { label: "线下交付", state: "offline" },
  { label: "库存冻结", state: "frozen" },
]

const ZONE_STYLES: Record<
  ZoneId,
  { bg: string; border: string; title: string }
> = {
  pool: {
    bg: "rgba(211, 209, 199, 0.32)",
    border: "rgba(180, 178, 169, 0.55)",
    title: "#5C5A52",
  },
  k8s: {
    bg: "white",
    border: "rgba(83, 74, 183, 0.22)",
    title: "#4A4199",
  },
  offline: {
    bg: "rgba(239, 159, 39, 0.12)",
    border: "rgba(186, 117, 23, 0.28)",
    title: "#8A5A10",
  },
  elastic: {
    bg: "rgba(127, 119, 221, 0.16)",
    border: "rgba(83, 74, 183, 0.32)",
    title: "#4A4199",
  },
  bare: {
    bg: "rgba(216, 90, 48, 0.11)",
    border: "rgba(153, 60, 29, 0.28)",
    title: "#8A3318",
  },
  internal: {
    bg: "rgba(29, 158, 117, 0.11)",
    border: "rgba(15, 110, 86, 0.28)",
    title: "#0D6049",
  },
  frozen: {
    bg: "rgba(133, 183, 235, 0.16)",
    border: "rgba(55, 138, 221, 0.32)",
    title: "#2B6CB0",
  },
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function createInitialMachines(): Machine[] {
  return Array.from({ length: TOTAL }, (_, id) => ({
    id,
    state: "pending" as const,
    zone: "pool" as const,
    arriving: true,
  }))
}

function MachineBlock({
  id,
  state,
  arriving,
  sessionKey,
}: {
  id: number
  state: MachineState
  arriving: boolean
  sessionKey: number
}) {
  const colors = STATE_COLORS[state]

  return (
    <motion.div
      layoutId={`machine-${sessionKey}-${id}`}
      layout
      title={`设备 #${id + 1}`}
      className="inline-block size-[22px] cursor-pointer rounded border-[1.5px] transition-transform duration-150 hover:relative hover:z-10 hover:scale-[1.2]"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
      initial={arriving ? { opacity: 0, scale: 0.4 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.35, ease: "easeOut" },
        scale: {
          duration: 0.35,
          ease: "easeOut",
          delay: arriving ? id * 0.018 : 0,
        },
      }}
    />
  )
}

function ZoneGrid({
  title,
  zoneId,
  machines,
  sessionKey,
  className,
}: {
  title: string
  zoneId: ZoneId
  machines: Machine[]
  sessionKey: number
  className?: string
}) {
  const zoneMachines = machines.filter((m) => m.zone === zoneId)
  const zoneStyle = ZONE_STYLES[zoneId]

  return (
    <div
      className={cn("flex flex-col rounded-lg border px-3 py-2.5", className)}
      style={{
        backgroundColor: zoneStyle.bg,
        borderColor: zoneStyle.border,
      }}
    >
      <div
        className="mb-2 text-[11px] font-medium tracking-wide"
        style={{ color: zoneStyle.title }}
      >
        {title}
      </div>
      <div className="flex min-h-[52px] flex-1 flex-wrap content-start gap-1">
        {zoneMachines.map((machine) => (
          <MachineBlock
            key={`${sessionKey}-${machine.id}`}
            id={machine.id}
            state={machine.state}
            arriving={machine.arriving}
            sessionKey={sessionKey}
          />
        ))}
      </div>
    </div>
  )
}

export default function GpuDeviceFlowPage() {
  const [machines, setMachines] = useState<Machine[]>(createInitialMachines)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("")
  const [sessionKey, setSessionKey] = useState(0)

  const moveMachine = useCallback(
    (id: number, zone: ZoneId, state: MachineState) =>
      new Promise<void>((resolve) => {
        setMachines((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, zone, state, arriving: false } : m,
          ),
        )
        setTimeout(resolve, 480)
      }),
    [],
  )

  const resetDemo = useCallback(() => {
    if (running) return
    setStatus("")
    setSessionKey((k) => k + 1)
    setMachines(createInitialMachines())
  }, [running])

  const runDemo = useCallback(async () => {
    if (running) return
    setRunning(true)

    setStatus("入库中...")
    await sleep(200)

    const order = [...Array(TOTAL).keys()].sort(() => Math.random() - 0.5)
    const groups: Record<keyof typeof DIST, number[]> = {
      elastic: [],
      bare: [],
      internal: [],
      offline: [],
      frozen: [],
    }
    const keys = Object.keys(DIST) as (keyof typeof DIST)[]
    let idx = 0
    for (const k of keys) {
      for (let n = 0; n < DIST[k]; n++) groups[k].push(order[idx++]!)
    }

    setStatus("分流中：线下交付不走k8s...")
    const offlinePromises = groups.offline.map((id, j) =>
      sleep(j * DELAY_K8S).then(() => moveMachine(id, "offline", "offline")),
    )
    const k8sBound = [
      ...groups.elastic,
      ...groups.bare,
      ...groups.internal,
      ...groups.frozen,
    ]
    const k8sPromises = k8sBound.map((id, j) =>
      sleep(j * DELAY_K8S + 60).then(() => moveMachine(id, "k8s", "pending")),
    )

    await Promise.all([...offlinePromises, ...k8sPromises])
    setStatus("k8s集群上架完成，开始分配资源池...")
    await sleep(400)

    const allFinal: {
      id: number
      j: number
      targetId: ZoneId
      cls: MachineState
    }[] = []

    const finalGroups: { grp: keyof typeof DIST; targetId: ZoneId; cls: MachineState }[] = [
      { grp: "elastic", targetId: "elastic", cls: "elastic" },
      { grp: "bare", targetId: "bare", cls: "bare" },
      { grp: "internal", targetId: "internal", cls: "internal" },
      { grp: "frozen", targetId: "frozen", cls: "frozen" },
    ]

    for (const { grp, targetId, cls } of finalGroups) {
      groups[grp].forEach((id) => {
        allFinal.push({ id, j: allFinal.length, targetId, cls })
      })
    }

    allFinal.sort(() => Math.random() - 0.5)
    await Promise.all(
      allFinal.map(({ id, j, targetId, cls }) =>
        sleep(j * DELAY_FINAL).then(() => moveMachine(id, targetId, cls)),
      ),
    )

    setStatus(
      `流转完成 — 弹性:${DIST.elastic} 裸金属:${DIST.bare} 内部占用:${DIST.internal} 线下:${DIST.offline} 冻结:${DIST.frozen}`,
    )
    setRunning(false)
  }, [moveMachine, running])

  return (
    <div className="space-y-4 bg-background p-4 md:p-6">
      <h2 className="sr-only">
        GPU设备生命周期流转动画：展示64台设备从采购入库到弹性服务、裸金属、内部自测、线下交付和库存冻结的分流过程
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">图例：</span>
        {LEGEND_ITEMS.map(({ label, state }) => {
          const colors = STATE_COLORS[state]
          return (
            <span key={state} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-sm border-[1.5px]"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                }}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </span>
          )
        })}
      </div>

      <LayoutGroup id={`gpu-flow-${sessionKey}`}>
        <ZoneGrid
          title="商务采购 → 验收入库（64台）"
          zoneId="pool"
          machines={machines}
          sessionKey={sessionKey}
          className="mb-2.5"
        />

        <div className="mb-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ZoneGrid
            title="k8s 集群上架"
            zoneId="k8s"
            machines={machines}
            sessionKey={sessionKey}
          />
          <ZoneGrid
            title="线下交付（直接交付，不走k8s）"
            zoneId="offline"
            machines={machines}
            sessionKey={sessionKey}
          />
        </div>

        <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-3">
          <ZoneGrid
            title="弹性服务池"
            zoneId="elastic"
            machines={machines}
            sessionKey={sessionKey}
          />
          <ZoneGrid
            title="裸金属池"
            zoneId="bare"
            machines={machines}
            sessionKey={sessionKey}
          />
          <div className="flex h-full min-h-0 flex-row gap-2">
            <ZoneGrid
              title="内部占用"
              zoneId="internal"
              machines={machines}
              sessionKey={sessionKey}
              className="min-h-0 flex-1"
            />
            <ZoneGrid
              title="库存冻结"
              zoneId="frozen"
              machines={machines}
              sessionKey={sessionKey}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      </LayoutGroup>

      <div className="flex flex-wrap items-center gap-2 pt-3">
        <Button onClick={runDemo} disabled={running}>
          播放流转动画 ↗
        </Button>
        <Button variant="outline" onClick={resetDemo} disabled={running}>
          重置
        </Button>
        {status ? (
          <span className="ml-1 text-xs text-muted-foreground">{status}</span>
        ) : null}
      </div>
    </div>
  )
}
