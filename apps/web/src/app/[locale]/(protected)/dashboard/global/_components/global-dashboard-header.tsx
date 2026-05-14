"use client"

import * as React from "react"
import { Bell, ChevronDown, Cpu, Maximize2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

export function GlobalDashboardHeader() {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = React.useMemo(() => {
    const p = (n: number) => n.toString().padStart(2, "0")
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
  }, [now])

  return (
    <div className="border-b border-border/60 bg-card/40 px-4 py-3 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          {/* <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="size-5" />
          </div> */}
          <div>
            <h1 className="text-base font-semibold tracking-tight md:text-lg">
              算力资源运营监控大盘
            </h1>
            {/* <p className="text-xs text-muted-foreground md:text-sm">IDC / GPU 资源运营中心</p> */}
          </div>
        </div>
        <p className="text-center text-sm font-medium text-muted-foreground lg:flex-1 lg:text-base">
          全局视图 · 资源全生命周期监控
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums md:text-sm">
            {timeStr}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild  className="w-32">
              <Button variant="outline" size="sm" className="gap-1">
                全部卡型
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end"  className="w-32">
              <DropdownMenuItem>4090-24</DropdownMenuItem>
              <DropdownMenuItem>5090-24G</DropdownMenuItem>
              <DropdownMenuItem>H800-80G</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>                    
          <Button variant="ghost" size="icon" className="size-8" aria-label="通知">
            <Bell className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="全屏">
            <Maximize2 className="size-4" />
          </Button>

        </div>
      </div>
    </div>
  )
}
