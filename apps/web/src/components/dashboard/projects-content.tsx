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
  Tag,
  ChevronDown,
  DollarSignIcon,
  UserCircle,
  Building2,
  FlaskConical,
  Receipt,
  Pause,
  Handshake,
  FileCheck,
} from 'lucide-react'
import { toast } from 'sonner'
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
  DropdownMenuCheckboxItem,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import type { Project } from '@/lib/data/types'
import { TENANT_PROJECT_IMPORT_TAG_NAMES } from '@/lib/crm/tenant-project-import-utils'
import { STAFF_DEPARTMENTS, type StaffDepartment } from '@/lib/crm/staff-constants'
import { trpc } from '@/lib/trpc/client'
import { CreateProjectDialog } from './create-project-dialog'
import { EditProjectDialog } from './edit-project-dialog'
import { ProjectTagsDialog } from './project-tags-dialog'
import { ProjectCostAllocationDialog } from './project-cost-allocation-dialog'
import { ProjectAccountManagerDialog } from './project-account-manager-dialog'
import { ProjectRevenueDepartmentDialog } from './project-revenue-department-dialog'
import { ProjectOpportunitySourceDialog } from './project-opportunity-source-dialog'
import { ProjectConversionSettingDialog } from './project-conversion-setting-dialog'
import { ProjectMonthMetricCell } from './project-month-metric-cell'
import { CrmProjectImportDialog } from './crm-project-import-dialog'
import { CrmTenantProjectImportDialog } from './crm-tenant-project-import-dialog'
import { ConversionQueryDialog } from './conversion-query-dialog'
import { IconUpload, IconClipboardSearch } from '@tabler/icons-react'
import { useListPagination } from '@/hooks/use-list-pagination'
import { ListPagination } from '@/components/shared/list-pagination'

const STAFF_FILTER_ALL = 'all'
const STAFF_FILTER_ME = '__me__'
const DEPARTMENT_FILTER_ALL = 'all'

export function ProjectsContent() {
  const { data: businessLines = [] } = trpc.crm.businessLines.listActive.useQuery()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [staffFilter, setStaffFilter] = useState<string>(STAFF_FILTER_ALL)
  const [accountManagerFilter, setAccountManagerFilter] = useState<string>(STAFF_FILTER_ALL)
  const [departmentFilter, setDepartmentFilter] = useState<string>(DEPARTMENT_FILTER_ALL)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [taggingProject, setTaggingProject] = useState<Project | null>(null)
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [allocatingProject, setAllocatingProject] = useState<Project | null>(null)
  const [amOpen, setAmOpen] = useState(false)
  const [amProject, setAmProject] = useState<Project | null>(null)
  const [deptOpen, setDeptOpen] = useState(false)
  const [deptProject, setDeptProject] = useState<Project | null>(null)
  const [oppSourceOpen, setOppSourceOpen] = useState(false)
  const [oppSourceProject, setOppSourceProject] = useState<Project | null>(null)
  const [conversionOpen, setConversionOpen] = useState(false)
  const [conversionProject, setConversionProject] = useState<Project | null>(null)
  const [testingProject, setTestingProject] = useState<Project | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [tenantProjectImportOpen, setTenantProjectImportOpen] = useState(false)
  const [conversionQueryOpen, setConversionQueryOpen] = useState(false)
  const [pausingProject, setPausingProject] = useState<Project | null>(null)

  const utils = trpc.useUtils()

  const { data: allTags = [] } = trpc.crm.projectTags.list.useQuery()
  const tagFilterOptions = useMemo(() => {
    const allowed = new Set<string>(TENANT_PROJECT_IMPORT_TAG_NAMES)
    return allTags.filter((tag) => allowed.has(tag.name))
  }, [allTags])

  const { data: staffFilterOptions } = trpc.crm.projects.listStaffFilterOptions.useQuery()
  const { data: accountManagerFilterOptions } =
    trpc.crm.projects.listAccountManagerFilterOptions.useQuery()

  const effectiveStaffId =
    staffFilter === STAFF_FILTER_ME
      ? (staffFilterOptions?.currentUserStaffId ?? undefined)
      : staffFilter === STAFF_FILTER_ALL
        ? undefined
        : staffFilter

  const effectiveAccountManagerStaffId =
    accountManagerFilter === STAFF_FILTER_ME
      ? (accountManagerFilterOptions?.currentUserStaffId ?? undefined)
      : accountManagerFilter === STAFF_FILTER_ALL
        ? undefined
        : accountManagerFilter

  const { data: projects = [], isLoading, refetch } = trpc.crm.projects.list.useQuery({
    search: search || undefined,
    stage: stageFilter,
    status: statusFilter,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    staffId: effectiveStaffId,
    accountManagerStaffId: effectiveAccountManagerStaffId,
    revenueDepartment:
      departmentFilter === DEPARTMENT_FILTER_ALL
        ? undefined
        : (departmentFilter as StaffDepartment),
  })

  const pauseMutation = trpc.crm.projects.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('项目已暂停')
      setPausingProject(null)
      void refetch()
      void utils.crm.projects.stageCounts.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const updateStageMutation = trpc.crm.projects.updateStage.useMutation({
    onSuccess: () => {
      toast.success('项目阶段已更新')
      setTestingProject(null)
      void refetch()
      void utils.crm.projects.stageCounts.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: stageCounts } = trpc.crm.projects.stageCounts.useQuery()

  const pagination = useListPagination(projects, {
    resetDeps: [
      search,
      stageFilter,
      statusFilter,
      staffFilter,
      accountManagerFilter,
      departmentFilter,
      selectedTagIds.join(','),
    ],
  })

  const staffFilterLabel =
    staffFilter === STAFF_FILTER_ALL
      ? '全部负责人'
      : staffFilter === STAFF_FILTER_ME
        ? '我'
        : (staffFilterOptions?.staff.find((staff) => staff.id === staffFilter)?.displayName ??
          '负责人')

  const accountManagerFilterLabel =
    accountManagerFilter === STAFF_FILTER_ALL
      ? '全部客户经理'
      : accountManagerFilter === STAFF_FILTER_ME
        ? '我'
        : (accountManagerFilterOptions?.staff.find((staff) => staff.id === accountManagerFilter)
            ?.displayName ?? '客户经理')

  const toggleTagFilter = (tagId: string, checked: boolean) => {
    setSelectedTagIds((prev) =>
      checked ? (prev.includes(tagId) ? prev : [...prev, tagId]) : prev.filter((id) => id !== tagId),
    )
  }

  const tagFilterLabel =
    selectedTagIds.length === 0
      ? '全部标签'
      : selectedTagIds.length === 1
        ? (tagFilterOptions.find((tag) => tag.id === selectedTagIds[0])?.name ?? '已选 1 个标签')
        : `已选 ${selectedTagIds.length} 个标签`

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

  const openAllocation = (project: Project) => {
    setAllocatingProject(project)
    setAllocationOpen(true)
  }

  const openAccountManager = (project: Project) => {
    setAmProject(project)
    setAmOpen(true)
  }

  const openRevenueDepartment = (project: Project) => {
    setDeptProject(project)
    setDeptOpen(true)
  }

  const openOpportunitySource = (project: Project) => {
    setOppSourceProject(project)
    setOppSourceOpen(true)
  }

  const openConversionSetting = (project: Project) => {
    setConversionProject(project)
    setConversionOpen(true)
  }

  const handleConfirmTesting = () => {
    if (!testingProject) return
    updateStageMutation.mutate({ id: testingProject.id, stage: 'testing' })
  }

  const handleConfirmPause = () => {
    if (!pausingProject) return
    pauseMutation.mutate({ id: pausingProject.id, status: 'paused' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目管理</h1>
          <p className="text-muted-foreground">管理所有项目，跟踪项目阶段和进度</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            type="button"
            onClick={() => setConversionQueryOpen(true)}
          >
            <IconClipboardSearch className="size-4" />
            转正查询
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            type="button"
            onClick={() => setTenantProjectImportOpen(true)}
          >
            <IconUpload className="size-4" />
            导入租户项目
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            type="button"
            onClick={() => setImportOpen(true)}
          >
            <IconUpload className="size-4" />
            导入项目
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建项目
          </Button>
        </div>
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

      <ProjectCostAllocationDialog
        open={allocationOpen}
        onOpenChange={setAllocationOpen}
        project={allocatingProject}
      />

      <ProjectAccountManagerDialog
        open={amOpen}
        onOpenChange={setAmOpen}
        project={amProject}
        onSaved={() => void refetch()}
      />

      <ProjectRevenueDepartmentDialog
        open={deptOpen}
        onOpenChange={setDeptOpen}
        project={deptProject}
        onSaved={() => void refetch()}
      />

      <ProjectOpportunitySourceDialog
        open={oppSourceOpen}
        onOpenChange={setOppSourceOpen}
        project={oppSourceProject}
        onSaved={() => void refetch()}
      />

      <ProjectConversionSettingDialog
        open={conversionOpen}
        onOpenChange={setConversionOpen}
        project={conversionProject}
        onSaved={() => {
          void refetch()
          void utils.crm.projects.stageCounts.invalidate()
        }}
      />

      <AlertDialog
        open={testingProject !== null}
        onOpenChange={(open) => !open && setTestingProject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>转为测试中？</AlertDialogTitle>
            <AlertDialogDescription>
              将项目「{testingProject?.name}」阶段更新为测试中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={updateStageMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={updateStageMutation.isPending}
              onClick={handleConfirmTesting}
            >
              {updateStageMutation.isPending ? '处理中…' : '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CrmProjectImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => void refetch()}
      />

      <CrmTenantProjectImportDialog
        open={tenantProjectImportOpen}
        onOpenChange={setTenantProjectImportOpen}
        businessLines={businessLines}
        onSuccess={() => void refetch()}
      />

      <ConversionQueryDialog
        open={conversionQueryOpen}
        onOpenChange={setConversionQueryOpen}
        onSuccess={() => {
          void refetch()
          void utils.crm.projects.stageCounts.invalidate()
        }}
      />

      <AlertDialog
        open={pausingProject !== null}
        onOpenChange={(open) => !open && setPausingProject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认暂停项目？</AlertDialogTitle>
            <AlertDialogDescription>
              暂停后项目「{pausingProject?.name}」将从默认列表中隐藏，且不再参与成本和收入计算。你仍可通过状态筛选查看已暂停项目。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pauseMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pauseMutation.isPending}
              onClick={handleConfirmPause}
            >
              {pauseMutation.isPending ? '处理中…' : '确认暂停'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                placeholder="搜索项目名称、客户、租户 ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="负责人">{staffFilterLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STAFF_FILTER_ALL}>全部负责人</SelectItem>
                  {staffFilterOptions?.currentUserStaffId ? (
                    <SelectItem value={STAFF_FILTER_ME}>我</SelectItem>
                  ) : null}
                  {staffFilterOptions?.staff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={accountManagerFilter} onValueChange={setAccountManagerFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="客户经理">{accountManagerFilterLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STAFF_FILTER_ALL}>全部客户经理</SelectItem>
                  {accountManagerFilterOptions?.currentUserStaffId ? (
                    <SelectItem value={STAFF_FILTER_ME}>我</SelectItem>
                  ) : null}
                  {accountManagerFilterOptions?.staff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="归属部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEPARTMENT_FILTER_ALL}>全部部门</SelectItem>
                  {STAFF_DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-between font-normal">
                    <span className="truncate">{tagFilterLabel}</span>
                    <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {tagFilterOptions.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => toggleTagFilter(tag.id, checked === true)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {tag.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {selectedTagIds.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedTagIds([])}>清除筛选</DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
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
                <TableHead>租户 ID</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>业务线</TableHead>
                <TableHead>标签</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead>归属部门</TableHead>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-muted-foreground py-8 text-center text-sm">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-muted-foreground py-8 text-center text-sm">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                pagination.items.map((project) => (
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
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {project.platformTenantId ?? '—'}
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
                    {project.tags.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {project.tags.map((tag) => (
                          <Badge key={tag.id} variant="secondary" className="font-normal">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.stage} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {project.revenueDepartment ?? '—'}
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
                      <DropdownMenuContent
                        align="end"
                        className="w-auto min-w-44 whitespace-nowrap"
                      >
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/crm/projects/${project.id}`}
                            className="flex items-center gap-1.5"
                          >
                            <Eye className="size-4 shrink-0" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(project)}>
                          <Edit className="size-4 shrink-0" />
                          编辑项目
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAccountManager(project)}>
                          <UserCircle className="size-4 shrink-0" />
                          设置客户经理
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openRevenueDepartment(project)}>
                          <Building2 className="size-4 shrink-0" />
                          设置归属部门
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openTags(project)}>
                          <Tag className="size-4 shrink-0" />
                          设置标签
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openOpportunitySource(project)}>
                          <Handshake className="size-4 shrink-0" />
                          设置商机来源
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAllocation(project)}>
                          <DollarSignIcon className="size-4 shrink-0" />
                          项目分成
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {project.stage === 'lead' ? (
                          <DropdownMenuItem onClick={() => setTestingProject(project)}>
                            <FlaskConical className="size-4 shrink-0" />
                            转为测试中
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => openConversionSetting(project)}>
                          <FileCheck className="size-4 shrink-0" />
                          项目转正设置
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Receipt className="size-4 shrink-0" />
                          查看账单
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {project.status === 'active' ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPausingProject(project)}
                          >
                            <Pause className="size-4 shrink-0" />
                            暂停项目
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
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
