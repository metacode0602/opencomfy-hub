'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  MoreHorizontal,
  ArrowUpRight,
  GitBranch,
  Edit,
  Eye,
  Trash,
  Tag,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
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
import type { Project } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { CreateProjectDialog } from './create-project-dialog'
import { EditProjectDialog } from './edit-project-dialog'
import { ProjectTagsDialog } from './project-tags-dialog'
import { ProjectMonthMetricCell } from './project-month-metric-cell'

export function ProjectsContent() {
  const { data: businessLines = [] } = trpc.crm.businessLines.listActive.useQuery()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [taggingProject, setTaggingProject] = useState<Project | null>(null)

  const { data: projects = [], isLoading, refetch } = trpc.crm.projects.list.useQuery({
    search: search || undefined,
    stage: stageFilter,
    status: statusFilter,
  })

  const { data: stageCounts } = trpc.crm.projects.stageCounts.useQuery()

  const filteredProjects = projects

  const leadCount = stageCounts?.lead ?? 0
  const testingCount = stageCounts?.testing ?? 0
  const convertedCount = stageCounts?.converted ?? 0

  const openEdit = (project: Project) => {
    setEditingProject(project)
    setEditOpen(true)
  }

  const openTags = (project: Project) => {
    setTaggingProject(project)
    setTagsOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目管理</h1>
          <p className="text-muted-foreground">管理所有项目，跟踪项目阶段和进度</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新建项目
        </Button>
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        businessLines={businessLines}
        onCreated={() => void refetch()}
      />

      <EditProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={editingProject}
        businessLines={businessLines}
        onUpdated={() => void refetch()}
      />

      <ProjectTagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        project={taggingProject}
        onSaved={() => void refetch()}
      />

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
            <p className="text-xs text-muted-foreground mt-2">需完成需求确认、技术评估</p>
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
            <p className="text-xs text-muted-foreground mt-2">需完成 POC、性能测试、签订合同</p>
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
            <p className="text-xs text-muted-foreground mt-2">正式运营，持续维护跟进</p>
          </CardContent>
        </Card>
      </div>

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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>业务线</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead>售前</TableHead>
                <TableHead>客户经理</TableHead>
                <TableHead>充值</TableHead>
                <TableHead>消费</TableHead>
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
                  <TableCell className="text-muted-foreground text-sm">
                    {project.businessLineName}
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
                  <TableCell>
                    <ProjectMonthMetricCell
                      lastMonth={project.lastMonthRecharge}
                      thisMonth={project.thisMonthRecharge}
                    />
                  </TableCell>
                  <TableCell>
                    <ProjectMonthMetricCell
                      lastMonth={project.lastMonthConsumption}
                      thisMonth={project.thisMonthConsumption}
                    />
                  </TableCell>
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
                        <DropdownMenuItem onClick={() => openEdit(project)}>
                          <Edit className="w-4 h-4 mr-2" />
                          编辑项目
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openTags(project)}>
                          <Tag className="w-4 h-4 mr-2" />
                          设置标签
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
