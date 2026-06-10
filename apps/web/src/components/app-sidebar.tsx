"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser, type NavUserPublic } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import { websiteConfig } from "@/lib/config/website"
import type { AppRole } from "@/lib/auth/app-role"
import { getSidebarMenu } from "@/lib/navigation/sidebar-menu"

export function AppSidebar({
  user,
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: NavUserPublic | null
  role?: AppRole | null
}) {
  const menu = getSidebarMenu(role ?? null)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold gradient-text">{websiteConfig.metadata.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={menu.navMain} />
        {menu.sections.map((section) => (
          <React.Fragment key={section.key}>
            <SidebarMenuItem>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mx-8">
                {section.label}
              </p>
            </SidebarMenuItem>
            <NavSecondary items={section.items} />
          </React.Fragment>
        ))}
        <NavSecondary items={menu.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
