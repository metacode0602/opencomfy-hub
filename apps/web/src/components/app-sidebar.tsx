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
import {
  AlertCircleIcon,
  ArrowDownRightIcon,
  ArrowDownToLineIcon,
  BarChart3,
  Building2,
  CalendarDays,
  ChartBarIcon,
  CheckCircleIcon,
  Computer,
  Cpu,
  CreditCard,
  DownloadIcon,
  Factory,
  FileText,
  FolderKanban,
  HelpCircle,
  History,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { websiteConfig } from "@/lib/config/website"
import { DollarSignIcon } from "lucide-react"
import { UploadIcon } from "lucide-react"

const data = {
  navMain: [
    {
      title: "接入看板",
      url: "/dashboard/global",
      icon: <ChartBarIcon className="size-4" />,
    },
  ],
  navSupply: [
    {
      title: "资源总览",
      url: "/supplier/overview",
      icon: <BarChart3 className="size-4" />,
    },
    {
      title: "供应商",
      url: "/supplier/suppliers",
      icon: <Factory className="size-4" />,
    },
    {
      title: "商务合同",
      url: "/supplier/contracts",
      icon: <FileText className="size-4" />,
    },
    {
      title: "设备管理",
      url: "/supplier/devices",
      icon: <Computer className="size-4" />,
    },
    {
      title: "设备下架",
      url: "/supplier/offline-tasks",
      icon: <DownloadIcon className="size-4" />,
    },    
    {
      title: "设备上架",
      url: "/supplier/online-tasks",
      icon: <UploadIcon className="size-4" />,
    },
    {
      title: "订单接入",
      url: "/supplier/order-access",
      icon: <ArrowDownToLineIcon className="size-4" />,
    },
    {
      title: "故障事件",
      url: "/supplier/fault-incidents",
      icon: <AlertCircleIcon className="size-4" />,
    },
    {
      title: "测试占用",
      url: "/supplier/test-holds",
      icon: <CheckCircleIcon className="size-4" />,
    },
    {
      title: "系统卡型",
      url: "/supplier/gpu-card-types",
      icon: <Cpu className="size-4" />,
    },
  ],
  navCrm: [
    {
      title: "工作台",
      url: "/crm/workbench",
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      title: "数据看板",
      url: "/crm/analytics",
      icon: <BarChart3 className="size-4" />,
    },
    {
      title: "客户管理",
      url: "/crm/customers",
      icon: <Building2 className="size-4" />,
    },
    {
      title: "计费租户",
      url: "/crm/tenants",
      icon: <Wallet className="size-4" />,
    },
    {
      title: "平台项目",
      url: "/crm/projects",
      icon: <FolderKanban className="size-4" />,
    },
    {
      title: "员工",
      url: "/crm/staff",
      icon: <Users className="size-4" />,
    },
    {
      title: "合同",
      url: "/crm/contracts",
      icon: <FileText className="size-4" />,
    },
    {
      title: "日历",
      url: "/crm/calendar",
      icon: <CalendarDays className="size-4" />,
    }
  ],
  navMarketplace: [
    {
      title: "运营月报",
      url: "/finance",
      icon: <CreditCard className="size-4" />,
    },
    {
      title: "平台定价",
      url: "/supplier/platform-pricing",
      icon: <Sparkles className="size-4" />,
    },
    {
      title: "卡型单价",
      url: "/supplier/unit-costs",
      icon: <DollarSignIcon className="size-4" />,
    },
  ],
  navSecondary: [
    {
      title: "操作记录",
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

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: NavUserPublic | null }) {
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
        <NavMain items={data.navMain} />
        <SidebarMenuItem>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mx-8">
            算力供应链
          </p>
        </SidebarMenuItem>
        <NavSecondary items={data.navSupply} />
        <SidebarMenuItem>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mx-8">
            客户经营 CRM
          </p>
        </SidebarMenuItem>
        <NavSecondary items={data.navCrm} />
        <SidebarMenuItem>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mx-8">
            财务管理
          </p>
        </SidebarMenuItem>
        <NavSecondary items={data.navMarketplace} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
