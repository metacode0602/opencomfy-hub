'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
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
  MoreHorizontal,
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
import { trpc } from '@/lib/trpc/client'
import type { Customer } from '@/lib/data/types'
import { CreateCustomerDialog } from './create-customer-dialog'
import { EditCustomerDialog } from './edit-customer-dialog'
import { useListPagination } from '@/hooks/use-list-pagination'
import { ListPagination } from '@/components/shared/list-pagination'

export function CustomersContent() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const { data: customers = [], isLoading, refetch } = trpc.crm.customers.list.useQuery({
    search: search || undefined,
    type: typeFilter as 'B' | 'C' | 'all',
    status: statusFilter,
  })

  const pagination = useListPagination(customers, {
    resetDeps: [search, typeFilter, statusFilter],
  })

  const totalRecharge = customers.reduce((acc, t) => acc + t.totalRecharge, 0)
  const totalConsumption = customers.reduce((acc, t) => acc + t.totalConsumption, 0)
  const bCustomers = customers.filter((t) => t.type === 'B').length
  const cCustomers = customers.filter((t) => t.type === 'C').length

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setEditOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">客户管理</h1>
          <p className="text-muted-foreground">管理所有 B 端和 C 端客户信息</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新建客户
        </Button>
      </div>

      <CreateCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refetch()}
      />

      <EditCustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={editingCustomer}
        onUpdated={() => void refetch()}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              B 端客户
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bCustomers}</div>
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
            <div className="text-2xl font-bold">{cCustomers}</div>
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

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索客户名称、联系人、信用代码..."
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">加载中…</p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>联系人</TableHead>
                <TableHead>销售经理</TableHead>
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
              {pagination.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/crm/customers/${row.id}`}
                      className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                    >
                      {row.name}
                      <ArrowUpRight className="w-3 h-3 opacity-50" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.type === 'B' ? '企业' : '个人'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{row.contactPerson}</div>
                      <div className="text-xs text-muted-foreground">{row.contactPhone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.salesManagerName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.industry}</TableCell>
                  <TableCell>{row.projectCount}</TableCell>
                  <TableCell>¥{row.totalRecharge.toLocaleString()}</TableCell>
                  <TableCell>¥{row.totalConsumption.toLocaleString()}</TableCell>
                  <TableCell className="font-medium">¥{row.balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
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
                          <Link href={`/crm/customers/${row.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Edit className="w-4 h-4 mr-2" />
                          编辑信息
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <CreditCard className="w-4 h-4 mr-2" />
                          充值
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
          )}
          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
