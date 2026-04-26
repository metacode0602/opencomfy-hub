"use client"

import { Badge } from "@/components/ui/badge"
import {
  extractResultMedia,
  pickGenerateMessage,
  pickGenerateStatus,
} from "@/lib/opencomfy-api-client"
import type { GenerateJobPhase } from "@/lib/use-generate-job"

function statusLabel(status: number | null): string {
  if (status === null) return "未知"
  const map: Record<number, string> = {
    1: "等待执行",
    2: "执行中",
    3: "已生图",
    4: "审核中",
    5: "成功",
    6: "失败",
  }
  return map[status] ?? `状态 ${status}`
}

function businessErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null
  const o = json as Record<string, unknown>
  const code = o.code
  if (code === undefined) return null
  if (code === 0 || code === "0") return null
  const msg = o.msg
  return typeof msg === "string" && msg.length > 0 ? msg : `业务码 ${String(code)}`
}

export function GenerateResultPanel({ phase }: { phase: GenerateJobPhase }) {
  if (phase.kind === "idle") {
    return (
      <p className="text-sm text-muted-foreground">填写参数后点击提交，将自动轮询状态并在此展示结果。</p>
    )
  }

  if (phase.kind === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <Badge variant="destructive" className="mb-2">
          错误
        </Badge>
        <p className="text-sm">{phase.message}</p>
      </div>
    )
  }

  const busy = phase.kind === "running"
  const media =
    phase.kind === "success" ? extractResultMedia(phase.lastPayload) : []

  const statusNum =
    phase.kind === "running" && phase.lastPayload !== undefined
      ? pickGenerateStatus(phase.lastPayload)
      : phase.kind === "success"
        ? pickGenerateStatus(phase.lastPayload)
        : null

  const errPoll =
    phase.kind === "running" && phase.lastPayload !== undefined
      ? businessErrorMessage(phase.lastPayload)
      : null

  return (
    <div className="space-y-4">
      {busy ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">
            {phase.stage === "submit" ? "提交中" : "轮询中"}
          </Badge>
          {phase.stage === "poll" ? (
            <span className="text-muted-foreground">
              第 {phase.attempt} 次 · {statusLabel(statusNum)}
              {phase.uuid ? ` · ${phase.uuid.slice(0, 10)}…` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {phase.kind === "running" && phase.stage === "poll" ? (
        <div className="text-xs text-muted-foreground">
          {pickGenerateMessage(phase.lastPayload) ? (
            <p>{pickGenerateMessage(phase.lastPayload)}</p>
          ) : null}
          {errPoll ? <p className="text-destructive">{errPoll}</p> : null}
        </div>
      ) : null}

      {phase.kind === "success" ? (
        <div className="flex items-center gap-2">
          <Badge>已完成</Badge>
          <span className="text-xs text-muted-foreground font-mono">{phase.uuid}</span>
        </div>
      ) : null}

      {media.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {media.map((m, i) =>
            m.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${m.url}-${i}`}
                src={m.url}
                alt=""
                className="max-h-72 w-full rounded-lg border object-contain"
              />
            ) : (
              <div key={`${m.url}-${i}`} className="space-y-2">
                {m.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.coverUrl}
                    alt=""
                    className="max-h-44 w-full rounded-lg border object-cover"
                  />
                ) : null}
                <video
                  src={m.url}
                  controls
                  className="w-full max-h-64 rounded-lg border"
                  playsInline
                />
              </div>
            ),
          )}
        </div>
      ) : phase.kind === "success" ? (
        <p className="text-sm text-muted-foreground">
          任务已成功，返回中暂无图片或视频链接（可能仍在审核或字段为空）。
        </p>
      ) : null}
    </div>
  )
}
