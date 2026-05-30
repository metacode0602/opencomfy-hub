"use client"

import { Loader2 } from "lucide-react"

export function DashboardCardLoading({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

export function DashboardCardError({ message = "加载失败，请刷新页面重试" }: { message?: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}
