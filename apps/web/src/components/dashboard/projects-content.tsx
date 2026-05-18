'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  ArrowUpRight,
  GitBranch,
  Users,
  Edit,
  Eye,
  Trash,
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
import { Textarea } from '@workspace/ui/components/textarea'
import { mockProjects, mockCustomers } from '@/lib/data/mock-data'

export function ProjectsContent() {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredProjects = mockProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.customerName.toLowerCase().includes(search.toLowerCase()) ||
      project.accountManager.toLowerCase().includes(search.toLowerCase())
    const matchesStage = stageFilter === 'all' || project.stage === stageFilter
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStage && matchesStatus
  })

  const leadCount = mockProjects.filter(p => p.stage === 'lead').length
  const testingCount = mockProjects.filter(p => p.stage === 'testing').length
  const convertedCount = mockProjects.filter(p => p.stage === 'converted').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目管理</h1>
          <p className="text-muted-foreground">管理所有项目，跟踪项目阶段和进度</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>新建项目</DialogTitle>
              <DialogDescription>
                创建新项目并关联客户
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>选择客户</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择客户" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        <span className="text-muted-foreground ml-2">
                          ({c.type === 'B' ? '企业' : '个人'})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>项目名称</Label>
                <Input placeholder="请输入项目名称" />
              </div>
              <div className="grid gap-2">
                <Label>项目描述</Label>
                <Textarea placeholder="请输入项目描述" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>售前经理</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chen">陈思思</SelectItem>
                      <SelectItem value="zhang">张伟</SelectItem>
                      <SelectItem value="li">李娜</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>客户经理</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wang">王磊</SelectItem>
                      <SelectItem value="zhou">周明</SelectItem>
                      <SelectItem value="zhao">赵敏</SelectItem>
                      <SelectItem value="liq">李强</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>月度预算</Label>
                  <Input type="number" placeholder="¥" />
                </div>
                <div className="grid gap-2">
                  <Label>开始日期</Label>
                  <Input type="date" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsDialogOpen(false)}>
                创建项目
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">线索孵化</p>
                <p className="text-2xl font-bold">{leadCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              需完成需求确认、技术评估
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">测试中</p>
                <p className="text-2xl font-bold">{testingCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              需完成 POC、性能测试、签订合同
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已转正</p>
                <p className="text-2xl font-bold">{convertedCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              正式运营，持续维护跟进
            </p>
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
                placeholder="搜索项目名称、客户、客户经理..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="项目阶段" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部阶段</SelectItem>
                  <SelectItem value="lead">线索孵化</SelectItem>
                  <SelectItem value="testing">测试中</SelectItem>
                  <SelectItem value="converted">已转正</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="paused">已暂停</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead>售前</TableHead>
                <TableHead>客户经理</TableHead>
                <TableHead>月度预算</TableHead>
                <TableHead>总消费</TableHead>
                <TableHead>状态</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link 
                      href={`/crm/projects/${project.id}`}
                      className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                    >
                      {project.name}
                      <ArrowUpRight className="w-3 h-3 opacity-50" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/crm/customers/${project.customerId}`}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {project.customerName}
                      </Link>
                      <Badge variant="outline" className="text-xs">
                        {project.customerType === 'B' ? '企业' : '个人'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.stage} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.preSalesManager}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.accountManager}
                  </TableCell>
                  <TableCell>¥{project.monthlyBudget.toLocaleString()}</TableCell>
                  <TableCell className="font-medium">
                    ¥{project.totalConsumption.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} />
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
                          <Link href={`/crm/projects/${project.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          编辑项目
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>转为测试中</DropdownMenuItem>
                        <DropdownMenuItem>转为已转正</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>查看账单</DropdownMenuItem>
                        <DropdownMenuItem>发放算力券</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash className="w-4 h-4 mr-2" />
                          暂停项目
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
