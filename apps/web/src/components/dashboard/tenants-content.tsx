'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  Search, 
  Filter,
  MoreHorizontal,
  Building2,
  User,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Eye,
  Edit,
  Gift,
  FolderKanban,
  Pause,
} from 'lucide-react'
  import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  } from '@workspace/ui/components/dialog'
import { Label } from '@workspace/ui/components/label'
import { mockTenants } from '@/lib/data/mock-data'
import type { Tenant } from '@/lib/data/types'

export function TenantsContent() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredTenants = mockTenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.contactPerson.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || tenant.type === typeFilter
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const totalRecharge = mockTenants.reduce((acc, t) => acc + t.totalRecharge, 0)
  const totalConsumption = mockTenants.reduce((acc, t) => acc + t.totalConsumption, 0)
  const bTenants = mockTenants.filter(t => t.type === 'B').length
  const cTenants = mockTenants.filter(t => t.type === 'C').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">客户管理</h1>
          <p className="text-muted-foreground">管理所有 B 端和 C 端客户信息</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建客户
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>新建客户</DialogTitle>
              <DialogDescription>
                填写客户基本信息，创建新的客户账号
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>客户类型</Label>
                <Select defaultValue="B">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B">B 端（企业）</SelectItem>
                    <SelectItem value="C">C 端（个人）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>客户名称</Label>
                <Input placeholder="请输入客户名称" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>联系人</Label>
                  <Input placeholder="请输入联系人姓名" />
                </div>
                <div className="grid gap-2">
                  <Label>联系电话</Label>
                  <Input placeholder="请输入联系电话" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>联系邮箱</Label>
                <Input type="email" placeholder="请输入联系邮箱" />
              </div>
              <div className="grid gap-2">
                <Label>所属行业</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择行业" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">人工智能</SelectItem>
                    <SelectItem value="cloud">云计算</SelectItem>
                    <SelectItem value="bigdata">大数据</SelectItem>
                    <SelectItem value="design">视觉设计</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>地址</Label>
                <Input placeholder="请输入地址" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsDialogOpen(false)}>
                创建客户
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              B 端客户
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bTenants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              C 端客户
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cTenants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              总充值
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{(totalRecharge / 10000).toFixed(1)}万</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              总消费
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{(totalConsumption / 10000).toFixed(1)}万</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索客户名称、联系人..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="客户类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="B">B 端</SelectItem>
                  <SelectItem value="C">C 端</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">未激活</SelectItem>
                  <SelectItem value="suspended">已暂停</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenant List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>联系人</TableHead>
                <TableHead>行业</TableHead>
                <TableHead>项目数</TableHead>
                <TableHead>总充值</TableHead>
                <TableHead>总消费</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <Link 
                      href={`/crm/tenants/${tenant.id}`}
                      className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                    >
                      {tenant.name}
                      <ArrowUpRight className="w-3 h-3 opacity-50" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {tenant.type === 'B' ? '企业' : '个人'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{tenant.contactPerson}</div>
                      <div className="text-xs text-muted-foreground">{tenant.contactPhone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tenant.industry}</TableCell>
                  <TableCell>{tenant.projectCount}</TableCell>
                  <TableCell>¥{tenant.totalRecharge.toLocaleString()}</TableCell>
                  <TableCell>¥{tenant.totalConsumption.toLocaleString()}</TableCell>
                  <TableCell className="font-medium">¥{tenant.balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <StatusBadge status={tenant.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/crm/tenants/${tenant.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          编辑信息
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <CreditCard className="w-4 h-4 mr-2" />
                          充值
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Gift className="w-4 h-4 mr-2" />
                          发放算力券
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FolderKanban className="w-4 h-4 mr-2" />
                          查看项目
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Pause className="w-4 h-4 mr-2" />
                          暂停客户
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
