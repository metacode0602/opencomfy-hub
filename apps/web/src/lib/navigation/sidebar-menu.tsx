import {
  Ban,
  ArrowDownToLineIcon,
  BarChart3,
  Building2,
  ChartBarIcon,
  CheckCircleIcon,
  Computer,
  Cpu,
  CreditCard,
  Factory,
  FileText,
  FolderKanban,
  HelpCircle,
  History,
  LayoutDashboard,
  ListTodo,
  Server,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { DollarSignIcon } from 'lucide-react'
import type { AppRole } from '@/lib/auth/app-role'
import { filterMenuItems, filterMenuSections, type MenuItem, type MenuSection } from './menu-config'

const ALL_ROLES = ['admin', 'user', 'member'] as AppRole[]
const ADMIN_ONLY: AppRole[] = ['admin']
const ADMIN_MEMBER: AppRole[] = ['admin', 'member']
const ADMIN_USER: AppRole[] = ['admin', 'user']

const navMain: MenuItem[] = [
  {
    title: '设备流转',
    url: '/dashboard/flow',
    icon: <ArrowDownToLineIcon className="size-4" />,
    roles: ALL_ROLES,
  },
  {
    title: '接入看板',
    url: '/dashboard/global',
    icon: <ChartBarIcon className="size-4" />,
    roles: ALL_ROLES,
  },
]

const navSupply: MenuItem[] = [
  { title: '资源总览', url: '/supplier/overview', icon: <BarChart3 className="size-4" />, roles: ADMIN_MEMBER },
  { title: '供应商', url: '/supplier/suppliers', icon: <Factory className="size-4" />, roles: ADMIN_MEMBER },
  { title: '商务合同', url: '/supplier/contracts', icon: <FileText className="size-4" />, roles: ADMIN_MEMBER },
  { title: '机房管理', url: '/supplier/datacenters', icon: <Server className="size-4" />, roles: ADMIN_MEMBER },
  { title: '设备管理', url: '/supplier/devices', icon: <Computer className="size-4" />, roles: ADMIN_MEMBER },
  { title: '设备库存', url: '/supplier/inventory', icon: <Cpu className="size-4" />, roles: ADMIN_MEMBER },
  { title: '计划批次', url: '/supplier/online-tasks', icon: <ListTodo className="size-4" />, roles: ADMIN_MEMBER },
  { title: '内部占用', url: '/supplier/test-holds', icon: <CheckCircleIcon className="size-4" />, roles: ADMIN_MEMBER },
]

const navCrm: MenuItem[] = [
  { title: '工作台', url: '/crm/workbench', icon: <LayoutDashboard className="size-4" />, roles: ADMIN_USER },
  { title: '客户管理', url: '/crm/customers', icon: <Building2 className="size-4" />, roles: ADMIN_USER },
  { title: '计费租户', url: '/crm/tenants', icon: <Wallet className="size-4" />, roles: ADMIN_USER },
  { title: '租户黑名单', url: '/crm/tenant-blacklist', icon: <Ban className="size-4" />, roles: ALL_ROLES },
  { title: '平台项目', url: '/crm/projects', icon: <FolderKanban className="size-4" />, roles: ADMIN_USER },
  { title: '员工', url: '/crm/staff', icon: <Users className="size-4" />, roles: ADMIN_ONLY },
]

const navMarketplace: MenuItem[] = [
  { title: '运营月报', url: '/finance', icon: <CreditCard className="size-4" />, roles: ADMIN_ONLY },
  { title: '系统卡型', url: '/supplier/gpu-card-types', icon: <Cpu className="size-4" />, roles: ADMIN_ONLY },
  { title: '平台定价', url: '/supplier/platform-pricing', icon: <Sparkles className="size-4" />, roles: ADMIN_ONLY },
  { title: '机房成本', url: '/supplier/unit-costs', icon: <DollarSignIcon className="size-4" />, roles: ADMIN_ONLY },
]

const navSecondary: MenuItem[] = [
  { title: '操作记录', url: '/dashboard/history', icon: <History className="size-4" />, roles: ALL_ROLES },
  { title: '设置', url: '/settings', icon: <Settings className="size-4" />, roles: ALL_ROLES },
  { title: '帮助', url: '/help', icon: <HelpCircle className="size-4" />, roles: ALL_ROLES },
]

export function getSidebarMenu(role: AppRole | null) {
  return {
    navMain: filterMenuItems(navMain, role),
    navSupply: filterMenuItems(navSupply, role),
    navCrm: filterMenuItems(navCrm, role),
    navMarketplace: filterMenuItems(navMarketplace, role),
    navSecondary: filterMenuItems(navSecondary, role),
    sections: filterMenuSections(
      [
        { key: 'supply', label: '算力供应链', items: navSupply },
        { key: 'crm', label: '客户经营 CRM', items: navCrm },
        { key: 'finance', label: '财务管理', items: navMarketplace },
      ],
      role,
    ),
  }
}
