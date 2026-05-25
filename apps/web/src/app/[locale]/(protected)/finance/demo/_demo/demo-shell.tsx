"use client"

import { LocaleLink } from "@/lib/i18n/navigation"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { IconInfoCircle } from "@tabler/icons-react"

export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-amber-900 dark:text-amber-100">
          静态演示模式 — 无后端请求
        </p>
        <p className="text-amber-800/90 dark:text-amber-200/90">
          点击「模拟上传」与「计算」按钮体验 Hub → 收入页 → 成本页 → 发布完整流程。确认交互后再接入真实 API。
        </p>
      </div>
    </div>
  )
}

export function DemoNav({
  periodId,
  active,
}: {
  periodId: string
  active: "hub" | "income" | "cost"
}) {
  const linkClass = (key: typeof active) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active === key
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    )

  return (
    <nav className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-1">
      <LocaleLink href={`/finance/demo/${periodId}`} className={linkClass("hub")}>
        账期 Hub
      </LocaleLink>
      <LocaleLink href={`/finance/demo/${periodId}/income`} className={linkClass("income")}>
        收入
      </LocaleLink>
      <LocaleLink href={`/finance/demo/${periodId}/cost`} className={linkClass("cost")}>
        成本
      </LocaleLink>
    </nav>
  )
}

export function StatusBadge({
  done,
  label,
}: {
  done: boolean
  label: string
}) {
  return (
    <Badge
      variant="outline"
      className={
        done
          ? "border-green-500/40 text-green-700 dark:text-green-300"
          : "border-muted-foreground/30 text-muted-foreground"
      }
    >
      {done ? "已完成" : "待处理"} · {label}
    </Badge>
  )
}

export function DemoBackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <LocaleLink href="/finance/demo">← 演示入口</LocaleLink>
    </Button>
  )
}
