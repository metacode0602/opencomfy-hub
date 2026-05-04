"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { ThemeToggle } from "@/components/theme-toggle"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import {
  CommandIcon,
  Film,
  GitBranch,
  HelpCircle,
  History,
  ImageIcon,
  Layers,
  Palette,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Store,
  Video,
  Wand2,
} from "lucide-react"
import Link from "next/link"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%23181f2a'/%3E%3Ccircle cx='48' cy='34' r='18' fill='%23f8fafc'/%3E%3Cpath d='M18 82c6-14 18-22 30-22s24 8 30 22' fill='%23f8fafc'/%3E%3C/svg%3E",
  },
  navMain: [
    {
      title: "文生图",
      url: "/dashboard/text-to-image",
      icon: <Wand2 className="size-4" />,
    },
    {
      title: "图生图",
      url: "/dashboard/image-to-image",
      icon: <ImageIcon className="size-4" />,
    },
    {
      title: "文生视频",
      url: "/dashboard/text-to-video",
      icon: <Video className="size-4" />,
    },
    {
      title: "图生视频",
      url: "/dashboard/image-to-video",
      icon: <Play className="size-4" />,
    },
    {
      title: "参考生视频",
      url: "/dashboard/ref-to-video",
      icon: <RefreshCw className="size-4" />,
    },
    {
      title: "工作流",
      url: "/dashboard/comfyui",
      icon: <Layers className="size-4" />,
    },
  ],
  navMarketplace: [
    {
      title: "模板市场",
      url: "/dashboard/marketplace/index",
      icon: <Store className="size-4" />,
    },
    {
      title: "图片风格",
      url: "/dashboard/marketplace/styles",
      icon: <Palette className="size-4" />,
    },
    {
      title: "视频特效",
      url: "/dashboard/marketplace/effects",
      icon: <Film className="size-4" />,
    },
    {
      title: "工作流模板",
      url: "/dashboard/marketplace/workflows",
      icon: <GitBranch className="size-4" />,
    },
  ],
  navSecondary: [
    {
      title: "历史记录",
      url: "/dashboard/history",
      icon: <History className="size-4" />,
    },
    {
      title: "设置",
      url: "/settings",
      icon: <Settings className="size-4" />,
    },
    {
      title: "帮助",
      url: "/help",
      icon: <HelpCircle className="size-4" />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
                <span className="font-bold gradient-text">Genesis AI</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
      <SidebarMenuItem>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mx-8">
            创作工具
          </p>
        </SidebarMenuItem>
        <NavMain items={data.navMain} />
        <SidebarMenuItem>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mx-8">
            预置模板
          </p>
        </SidebarMenuItem>
        <NavSecondary items={data.navMarketplace} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
