'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Factory,
  Search,
  MoreHorizontal,
  Building2,
  Cpu,
  TrendingUp,
  MapPin,
  Phone,
  Mail,
  User,
  FileText,
  ChevronRight,
  Eye,
  Edit,
  CreditCard,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
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
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { contractPricingModeNames, statusColors } from '@/lib/data/types'
import type { Supplier } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import {
  CreateSupplierDialog,
  EditSupplierDialog,
} from '@/components/dashboard/supplier-form-dialog'
import { SupplierImportTrigger } from '@/components/dashboard/supplier-import-dialog'

const statusNames: Record<string, string> = {
  negotiating: '洽谈中',
  cooperating: '合作中',
  suspended: '已暂停',
  terminated: '已终止',
}

export function SuppliersContent() {
  const utils = trpc.useUtils()
  const { data: suppliers = [], isLoading, refetch } = trpc.supplier.list.useQuery()
  const { data: activeStaff = [] } = trpc.crm.staff.listActive.useQuery()
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')

  const handleEditOpenChange = (open: boolean) => {
    setEditDialogOpen(open)
    if (!open) setEditSupplier(null)
  }

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.businessManager.includes(searchTerm)
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter
    const matchesMode = modeFilter === 'all' || supplier.cooperationMode === modeFilter
    return matchesSearch && matchesStatus && matchesMode
  })

  const stats = {
    total: suppliers.length,
    cooperating: suppliers.filter((s) => s.status === 'cooperating').length,
    totalDataCenters: suppliers.reduce((sum, s) => sum + s.dataCenterCount, 0),
    totalDevices: suppliers.reduce((sum, s) => sum + s.totalDeviceCount, 0),
    monthlySettlement: suppliers.reduce((sum, s) => sum + s.monthlySettlement, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">供应商管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理算力供应商、机房和设备资源
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SupplierImportTrigger
            activeStaff={activeStaff}
            onSuccess={() => void utils.supplier.list.invalidate()}
          />
          <CreateSupplierDialog
            activeStaff={activeStaff}
            onCreated={() => void refetch()}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Factory className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">供应商总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.cooperating}</p>
                <p className="text-xs text-muted-foreground">合作中</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.totalDataCenters}</p>
                <p className="text-xs text-muted-foreground">机房总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.totalDevices.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">设备总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  ¥{(stats.monthlySettlement / 10000).toFixed(0)}万
                </p>
                <p className="text-xs text-muted-foreground">月结算额</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索供应商名称、商务经理..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="合作状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="cooperating">合作中</SelectItem>
                <SelectItem value="negotiating">洽谈中</SelectItem>
                <SelectItem value="suspended">已暂停</SelectItem>
                <SelectItem value="terminated">已终止</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="合作模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部模式</SelectItem>
                <SelectItem value="card_time">卡时模式</SelectItem>
                <SelectItem value="revenue_share">分成模式</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 ml-auto">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'card')}>
                <TabsList className="h-9">
                  <TabsTrigger value="table" className="text-xs px-3">列表</TabsTrigger>
                  <TabsTrigger value="card" className="text-xs px-3">卡片</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers List */}
      {viewMode === 'table' ? (
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">供应商</TableHead>
                <TableHead className="text-muted-foreground">合作模式</TableHead>
                <TableHead className="text-muted-foreground">商务经理</TableHead>
                <TableHead className="text-muted-foreground">机房数</TableHead>
                <TableHead className="text-muted-foreground">设备数</TableHead>
                <TableHead className="text-muted-foreground">月结算额</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="border-border">
                  <TableCell>
                    <Link href={`/supplier/suppliers/${supplier.id}`} className="block group">
                      <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {supplier.name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {supplier.address.split('市')[0]}市
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        supplier.cooperationMode === 'card_time'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                      }
                    >
                      {contractPricingModeNames[supplier.cooperationMode]}
                      {supplier.revenueShareRatio && ` ${supplier.revenueShareRatio}%`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{supplier.businessManager}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground">{supplier.dataCenterCount}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground">{supplier.totalDeviceCount.toLocaleString()}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground font-medium">
                      ¥{supplier.monthlySettlement.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[supplier.status]}>
                      {statusNames[supplier.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/supplier/suppliers/${supplier.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditSupplier(supplier)
                            setEditDialogOpen(true)
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          编辑信息
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="w-4 h-4 mr-2" />
                          查看合同
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <CreditCard className="w-4 h-4 mr-2" />
                          查看账单
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredSuppliers.map((supplier) => {
            return (
              <Link key={supplier.id} href={`/supplier/suppliers/${supplier.id}`}>
                <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-medium text-foreground">
                          {supplier.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {supplier.address}
                        </p>
                      </div>
                      <Badge variant="outline" className={statusColors[supplier.status]}>
                        {statusNames[supplier.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge
                        variant="outline"
                        className={
                          supplier.cooperationMode === 'card_time'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }
                      >
                        {contractPricingModeNames[supplier.cooperationMode]}
                        {supplier.revenueShareRatio && ` ${supplier.revenueShareRatio}%`}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        商务: {supplier.businessManager}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{supplier.dataCenterCount}</p>
                        <p className="text-xs text-muted-foreground">机房</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {supplier.totalDeviceCount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">设备</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          ¥{(supplier.monthlySettlement / 10000).toFixed(1)}万
                        </p>
                        <p className="text-xs text-muted-foreground">月结算</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        {supplier.dataCenterCount > 0
                          ? `已接入 ${supplier.dataCenterCount} 个机房`
                          : '暂无机房'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {supplier.contactPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {supplier.contactEmail}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <EditSupplierDialog
        open={editDialogOpen}
        onOpenChange={handleEditOpenChange}
        supplier={editSupplier}
        activeStaff={activeStaff}
        onUpdated={() => void refetch()}
      />

      {filteredSuppliers.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Factory className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">没有找到匹配的供应商</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
