'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Factory,
  Plus,
  Search,
  Filter,
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
import { mockSuppliers, mockDataCenters } from '@/lib/data/mock-data'
import { contractPricingModeNames, statusColors } from '@/lib/data/types'
import type { CooperationMode, Supplier } from '@/lib/data/types'
import { useCrmMockStore } from '@/lib/stores/crm-mock-store'
import { toast } from 'sonner'

const statusNames: Record<string, string> = {
  negotiating: '洽谈中',
  cooperating: '合作中',
  suspended: '已暂停',
  terminated: '已终止',
}

type SupplierFormValues = {
  name: string
  shortName: string
  status: Supplier['status']
  cooperationMode: CooperationMode
  revenueShareRatio: string
  businessManagerStaffId: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  bankAccount: string
  bankName: string
}

const emptySupplierForm: SupplierFormValues = {
  name: '',
  shortName: '',
  status: 'negotiating',
  cooperationMode: 'card_time',
  revenueShareRatio: '',
  businessManagerStaffId: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  bankAccount: '',
  bankName: '',
}

export function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => [...mockSuppliers])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [form, setForm] = useState<SupplierFormValues>(emptySupplierForm)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const userStaff = useCrmMockStore((s) => s.userStaff)
  const activeStaff = useMemo(
    () => userStaff.filter((s) => s.status === 'active'),
    [userStaff],
  )

  const updateForm = (patch: Partial<SupplierFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const resetForm = () => setForm(emptySupplierForm)

  const handleCreateSupplier = () => {
    if (!form.name.trim() || !form.shortName.trim()) {
      toast.error('请填写供应商全称和简称')
      return
    }
    const businessManager = activeStaff.find((s) => s.id === form.businessManagerStaffId)?.display_name
    if (!businessManager || !form.contactPerson.trim()) {
      toast.error('请选择商务经理并填写联系人')
      return
    }
    if (!form.contactPhone.trim() || !form.contactEmail.trim()) {
      toast.error('请填写联系电话和邮箱')
      return
    }
    if (!form.address.trim()) {
      toast.error('请填写地址')
      return
    }
    if (form.cooperationMode === 'revenue_share') {
      const ratio = Number(form.revenueShareRatio)
      if (!form.revenueShareRatio.trim() || Number.isNaN(ratio) || ratio <= 0 || ratio > 100) {
        toast.error('分成模式请填写有效的分成比例（1-100）')
        return
      }
    }

    const newSupplier: Supplier = {
      id: `sup${Date.now()}`,
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      status: form.status,
      cooperationMode: form.cooperationMode,
      revenueShareRatio:
        form.cooperationMode === 'revenue_share'
          ? Number(form.revenueShareRatio)
          : undefined,
      businessManager,
      contactPerson: form.contactPerson.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim(),
      address: form.address.trim(),
      bankAccount: form.bankAccount.trim() || undefined,
      bankName: form.bankName.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0]!,
      dataCenterCount: 0,
      totalDeviceCount: 0,
      monthlySettlement: 0,
    }

    setSuppliers((prev) => [...prev, newSupplier])
    resetForm()
    setCreateDialogOpen(false)
    toast.success('供应商已创建')
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
    totalDataCenters: mockDataCenters.length,
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
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新增供应商
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增供应商</DialogTitle>
              <DialogDescription>
                填写供应商基本信息，创建后可继续维护机房与合同
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="supplier-name">供应商全称</Label>
                <Input
                  id="supplier-name"
                  placeholder="请输入公司全称"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier-short-name">简称</Label>
                <Input
                  id="supplier-short-name"
                  placeholder="请输入简称"
                  value={form.shortName}
                  onChange={(e) => updateForm({ shortName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>合作状态</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateForm({ status: v as Supplier['status'] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusNames).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>合作模式</Label>
                  <Select
                    value={form.cooperationMode}
                    onValueChange={(v) =>
                      updateForm({
                        cooperationMode: v as CooperationMode,
                        revenueShareRatio: v === 'card_time' ? '' : form.revenueShareRatio,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(contractPricingModeNames).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>商务经理</Label>
                  <Select
                    value={form.businessManagerStaffId || undefined}
                    onValueChange={(v) => updateForm({ businessManagerStaffId: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择商务经理" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.employee_no ? `${s.display_name}（${s.employee_no}）` : s.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier-contact-person">联系人</Label>
                  <Input
                    id="supplier-contact-person"
                    placeholder="供应商对接人"
                    value={form.contactPerson}
                    onChange={(e) => updateForm({ contactPerson: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supplier-phone">联系电话</Label>
                  <Input
                    id="supplier-phone"
                    placeholder="请输入联系电话"
                    value={form.contactPhone}
                    onChange={(e) => updateForm({ contactPhone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier-email">联系邮箱</Label>
                  <Input
                    id="supplier-email"
                    type="email"
                    placeholder="请输入联系邮箱"
                    value={form.contactEmail}
                    onChange={(e) => updateForm({ contactEmail: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier-address">地址</Label>
                <Input
                  id="supplier-address"
                  placeholder="请输入详细地址"
                  value={form.address}
                  onChange={(e) => updateForm({ address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supplier-bank-name">开户行（选填）</Label>
                  <Input
                    id="supplier-bank-name"
                    placeholder="银行名称"
                    value={form.bankName}
                    onChange={(e) => updateForm({ bankName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier-bank-account">银行账号（选填）</Label>
                  <Input
                    id="supplier-bank-account"
                    placeholder="对公账号"
                    value={form.bankAccount}
                    onChange={(e) => updateForm({ bankAccount: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm()
                  setCreateDialogOpen(false)
                }}
              >
                取消
              </Button>
              <Button onClick={handleCreateSupplier}>创建供应商</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                        <DropdownMenuItem>
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
            const dataCenters = mockDataCenters.filter((dc) => dc.supplierId === supplier.id)
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
                      <p className="text-xs text-muted-foreground mb-2">机房分布</p>
                      <div className="flex flex-wrap gap-1">
                        {dataCenters.slice(0, 3).map((dc) => (
                          <Badge key={dc.id} variant="secondary" className="text-xs">
                            {dc.location}
                          </Badge>
                        ))}
                        {dataCenters.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{dataCenters.length - 3}
                          </Badge>
                        )}
                      </div>
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
