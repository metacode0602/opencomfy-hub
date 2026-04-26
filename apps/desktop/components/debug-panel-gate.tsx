"use client"

import dynamic from "next/dynamic"
import * as React from "react"

const DebugPanel = dynamic(
  () => import("@/components/debug-panel").then((m) => m.DebugPanel),
  { ssr: false },
)

const DEBUG_PANEL_ENABLED_KEY = "ctui-debug-panel-enabled"

function detectTauriRuntime(): boolean {
  if (typeof window === "undefined") return false

  const w = window as unknown as Record<string, unknown>
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__)
}

export function DebugPanelGate() {
  const [isTauri, setIsTauri] = React.useState(false)
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    setIsTauri(detectTauriRuntime())
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const url = new URL(window.location.href)
    const enableFromQuery =
      url.searchParams.get("debug") === "1" ||
      url.searchParams.get("debugPanel") === "1"

    if (enableFromQuery) {
      localStorage.setItem(DEBUG_PANEL_ENABLED_KEY, "1")
    }

    const stored = localStorage.getItem(DEBUG_PANEL_ENABLED_KEY) === "1"
    setEnabled(enableFromQuery || stored)

    function onKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd + Shift + D toggles debug panel
      const isToggle =
        (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d"
      if (!isToggle) return

      e.preventDefault()
      setEnabled((prev) => {
        const next = !prev
        localStorage.setItem(DEBUG_PANEL_ENABLED_KEY, next ? "1" : "0")
        return next
      })
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  if (!isTauri) return null
  if (process.env.NODE_ENV !== "development" && !enabled) return null

  return <DebugPanel />
}

