"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"
import { GlobalDashboardHeader } from "@/app/[locale]/(protected)/dashboard/global/_components/global-dashboard-header"

import { ThemeToggle } from "./theme-toggle"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Bell } from "lucide-react"
import { SiteHeaderSearch } from "./site-header-search"

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
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-4"
        />
        <div className="min-w-0 flex-1">
          <SiteHeaderSearch />
        </div>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0 text-xs">
            3
          </Badge>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  )
}
