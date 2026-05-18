"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"
import { GlobalDashboardHeader } from "@/app/[locale]/(protected)/dashboard/global/_components/global-dashboard-header"

import { ThemeToggle } from "./theme-toggle"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Bell } from "lucide-react"

function isGlobalDashboardPath(pathname: string | null) {
  if (!pathname) return false
  return pathname.includes("/dashboard/global")
}

export function SiteHeader() {
  const pathname = usePathname()
  const showGlobalHeader = isGlobalDashboardPath(pathname)

  if (showGlobalHeader) {
    return (
      <header
        className={cn(
          "flex shrink-0 flex-col transition-[width,height] ease-linear",
          "group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-0"
        )}
      >
        <div className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0 flex-1">
            <GlobalDashboardHeader />
          </div>
          <ThemeToggle />
        </div>

      </header>
    )
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Documents</h1>

      </div>
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-card">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索客户、项目、合同..."
              className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </div>

      </div>
      <div className="flex items-center justify-end p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs">
              3
            </Badge>
          </Button>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
