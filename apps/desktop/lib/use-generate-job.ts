"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  pickGenerateMessage,
  pickGenerateStatus,
  pickGenerateUuid,
  postJson,
} from "@/lib/opencomfy-api-client"

export type GenerateJobPhase =
  | { kind: "idle" }
  | {
      kind: "running"
      stage: "submit" | "poll"
      uuid?: string
      lastPayload?: unknown
      attempt: number
    }
  | { kind: "success"; uuid: string; lastPayload: unknown }
  | { kind: "error"; message: string }

const POLL_MS = 2500
const MAX_POLLS = 72

function businessErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null
  const o = json as Record<string, unknown>
  const code = o.code
  if (code === undefined) return null
  if (code === 0 || code === "0") return null
  const msg = o.msg
  return typeof msg === "string" && msg.length > 0 ? msg : `业务码 ${String(code)}`
}

export function useGenerateJob(submitPath: string, statusPath: string) {
  const [phase, setPhase] = useState<GenerateJobPhase>({ kind: "idle" })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPhase({ kind: "idle" })
  }, [])

  const submit = useCallback(
    async (body: Record<string, unknown>) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      setPhase({ kind: "running", stage: "submit", attempt: 0 })

      let sub: Awaited<ReturnType<typeof postJson<unknown>>>
      try {
        sub = await postJson<unknown>(submitPath, body)
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : typeof e === "string" ? e : "未知错误"
        setPhase({
          kind: "error",
          message: `网络请求失败：${msg}。请确认 dashboard（默认 http://localhost:3000）已启动，且与 NEXT_PUBLIC_OPENCOMFY_API_BASE 一致。`,
        })
        return
      }
      if (ac.signal.aborted) return

      if (!sub.ok) {
        setPhase({
          kind: "error",
          message: `提交失败 HTTP ${sub.status}：${sub.text.slice(0, 800)}`,
        })
        return
      }

      const be = businessErrorMessage(sub.data)
      if (be) {
        setPhase({ kind: "error", message: `提交被拒绝：${be}` })
        return
      }

      const uuid = pickGenerateUuid(sub.data)
      if (!uuid) {
        setPhase({
          kind: "error",
          message: "提交响应中未找到 generateUuid",
        })
        return
      }

      for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
        if (ac.signal.aborted) return

        setPhase({
          kind: "running",
          stage: "poll",
          uuid,
          attempt,
        })

        let st: Awaited<ReturnType<typeof postJson<unknown>>>
        try {
          st = await postJson<unknown>(statusPath, { generateUuid: uuid })
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : typeof e === "string" ? e : "未知错误"
          setPhase({
            kind: "error",
            message: `轮询时网络失败：${msg}`,
          })
          return
        }
        if (ac.signal.aborted) return

        if (!st.ok) {
          setPhase({
            kind: "error",
            message: `查询状态失败 HTTP ${st.status}：${st.text.slice(0, 800)}`,
          })
          return
        }

        const stBe = businessErrorMessage(st.data)
        if (stBe) {
          setPhase({ kind: "error", message: `状态接口：${stBe}` })
          return
        }

        const g = pickGenerateStatus(st.data)
        setPhase({
          kind: "running",
          stage: "poll",
          uuid,
          attempt,
          lastPayload: st.data,
        })

        if (g === 5) {
          setPhase({ kind: "success", uuid, lastPayload: st.data })
          return
        }
        if (g === 6) {
          const msg =
            pickGenerateMessage(st.data) ?? "任务失败（generateStatus=6）"
          setPhase({ kind: "error", message: msg })
          return
        }

        await new Promise((r) => setTimeout(r, POLL_MS))
      }

      setPhase({
        kind: "error",
        message: "轮询超时：任务仍未结束，可稍后重试提交",
      })
    },
    [submitPath, statusPath],
  )

  return { phase, submit, reset }
}
