'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  FileText,
  Cpu,
  BarChart3,
  ChevronDown,
  Search,
  Bell,
  Factory,
} from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'

const navigation = [
  { name: '工作台', href: '/', icon: LayoutDashboard },
  { name: '租户管理', href: '/tenants', icon: Building2 },
  { name: '项目管理', href: '/projects', icon: FolderKanban },
  { name: '合同管理', href: '/contracts', icon: FileText },
  { name: '供应商管理', href: '/suppliers', icon: Factory },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex-1 flex flex-col min-w-0 mx-4 my-4 pb-4">
      {/* Content */}
      {children}
    </div>
  )
}
