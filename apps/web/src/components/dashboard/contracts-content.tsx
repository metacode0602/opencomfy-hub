'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  ArrowUpRight,
  FileText,
  Calendar,
  Download,
  Eye,
  Edit,
  Trash,
  CreditCard,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Progress } from '@workspace/ui/components/progress'
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
import { Textarea } from '@workspace/ui/components/textarea'
import { mockContracts, mockProjects, mockTenants } from '@/lib/data/mock-data'

export function ContractsContent() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredContracts = mockContracts.filter(contract => {
    const matchesSearch = contract.contractNo.toLowerCase().includes(search.toLowerCase()) ||
      contract.tenantName.toLowerCase().includes(search.toLowerCase()) ||
      contract.projectName.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || contract.type === typeFilter
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const totalAmount = mockContracts.reduce((acc, c) => acc + c.totalAmount, 0)
  const paidAmount = mockContracts.reduce((acc, c) => acc + c.paidAmount, 0)
  const activeCount = mockContracts.filter(c => c.status === 'active').length
  const pendingCount = mockContracts.filter(c => c.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">合同管理</h1>
          <p className="text-muted-foreground">管理所有项目合同，跟踪合同状态和付款进度</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建合同
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>新建合同</DialogTitle>
              <DialogDescription>
                创建新合同并关联项目
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>选择项目</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProjects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                        <span className="text-muted-foreground ml-2">
                          ({project.tenantName})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>合同类型</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择合同类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">标准合同</SelectItem>
                    <SelectItem value="enterprise">企业合同</SelectItem>
                    <SelectItem value="custom">定制合同</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>合同金额</Label>
                  <Input type="number" placeholder="¥" />
                </div>
                <div className="grid gap-2">
                  <Label>首付金额</Label>
                  <Input type="number" placeholder="¥" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>开始日期</Label>
                  <Input type="date" />
                </div>
                <div className="grid gap-2">
                  <Label>结束日期</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>合同条款</Label>
                <Textarea placeholder="请输入合同条款说明" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsDialogOpen(false)}>
                创建合同
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
              <FileText className="w-4 h-4" />
              合同总额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{(totalAmount / 10000).toFixed(1)}万</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              已收款
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{(paidAmount / 10000).toFixed(1)}万</div>
            <Progress value={(paidAmount / totalAmount) * 100} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              生效中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              待签署
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
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
                placeholder="搜索合同编号、租户、项目..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="合同类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="standard">标准合同</SelectItem>
                  <SelectItem value="enterprise">企业合同</SelectItem>
                  <SelectItem value="custom">定制合同</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="pending">待签署</SelectItem>
                  <SelectItem value="active">生效中</SelectItem>
                  <SelectItem value="expired">已过期</SelectItem>
                  <SelectItem value="terminated">已终止</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>合同编号</TableHead>
                <TableHead>项目</TableHead>
                <TableHead>租户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>合同金额</TableHead>
                <TableHead>已支付</TableHead>
                <TableHead>付款进度</TableHead>
                <TableHead>有效期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => {
                const paymentProgress = (contract.paidAmount / contract.totalAmount) * 100
                return (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-sm">
                      {contract.contractNo}
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/crm/projects/${contract.projectId}`}
                        className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                      >
                        {contract.projectName}
                        <ArrowUpRight className="w-3 h-3 opacity-50" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/crm/tenants/${contract.tenantId}`}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {contract.tenantName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {contract.type === 'standard' && '标准'}
                        {contract.type === 'enterprise' && '企业'}
                        {contract.type === 'custom' && '定制'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ¥{contract.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      ¥{contract.paidAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={paymentProgress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {paymentProgress.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {contract.startDate} ~ {contract.endDate}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            下载合同
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            编辑合同
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <CreditCard className="w-4 h-4 mr-2" />
                            记录付款
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="w-4 h-4 mr-2" />
                            终止合同
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
