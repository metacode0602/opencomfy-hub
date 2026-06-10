'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  User,
  Wallet,
  Banknote,
  Receipt,
  CreditCard,
  Download,
  Ticket,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Label } from '@workspace/ui/components/label'
import type { Project } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { productLineNames } from '@/lib/data/types'
import { getRoleLabel, stageSteps } from '@/components/dashboard/project-detail-constants'
import { ProjectConsumptionTrendChart } from '@/components/dashboard/project-consumption-trend-chart'
import { ProjectBalanceTrendChart } from '@/components/dashboard/project-balance-trend-chart'
import { getActivityIcon } from '@/components/dashboard/project-detail-utils'
import { ProjectTimelinePanel } from '@/components/dashboard/project-timeline-panel'
import { ProjectDailyConsumptionPanel } from '@/components/dashboard/project-daily-consumption-panel'
import { ProjectTasksPanel } from '@/components/dashboard/project-tasks-panel'
import { ProjectOrdersPanel } from '@/components/dashboard/project-orders-panel'
import { ProjectCouponsPanel } from '@/components/dashboard/project-coupons-panel'
import { ProjectRechargesPanel } from '@/components/dashboard/project-recharges-panel'
import { ProjectBillsPanel } from '@/components/dashboard/project-bills-panel'
import { ProjectMonthlyCostPanel } from '@/components/dashboard/project-monthly-cost-panel'
import { EditProjectDialog } from '@/components/dashboard/edit-project-dialog'
import { ProjectMonthMetricCell } from '@/components/dashboard/project-month-metric-cell'
import { ProjectBillingSyncDialog } from '@/components/dashboard/project-billing-sync-dialog'
import { ProjectCommissionInfoCard } from '@/components/dashboard/project-commission-info-card'
import { IconCloudDownload } from '@tabler/icons-react'
import { CopyToClipboard } from '@/components/shared/copy-to-clipboard'

interface ProjectDetailContentProps {
  project: Project
}

function runningHoursSince(startTime: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(startTime).getTime()) / 3_600_000)
}

function RunningTaskElapsedHours({ startTime }: { startTime: string }) {
  const [nowMs, setNowMs] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setNowMs(Date.now())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [startTime])

  if (nowMs === null) {
    return <span className="text-muted-foreground">—</span>
  }

  return <>{runningHoursSince(startTime, nowMs)}h</>
}

export function ProjectDetailContent({ project: initialProject }: ProjectDetailContentProps) {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const validTabs = new Set([
    'overview',
    'timeline',
    'consumption',
    'tasks',
    'orders',
    'coupons',
    'recharges',
    'bills',
    'finance',
  ])
  const [project, setProject] = useState(initialProject)
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && validTabs.has(tabFromUrl) ? tabFromUrl : 'overview',
  )
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [billingSyncOpen, setBillingSyncOpen] = useState(false)

  const { data: businessLines = [] } = trpc.crm.businessLines.listActive.useQuery()
  const { data: activities = [] } = trpc.crm.projects.listActivities.useQuery({
    projectId: project.id,
  })
  const { data: tasks = [] } = trpc.crm.projects.listTasks.useQuery({
    projectId: project.id,
  })
  const utils = trpc.useUtils()
  const currentStageIndex = stageSteps.findIndex((s) => s.key === project.stage)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/crm/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <StatusBadge status={project.stage} />
            <StatusBadge status={project.status} />
            <Badge variant="secondary">{project.businessLineName}</Badge>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{project.revenueDepartment}</Badge>
            </div>
          </div>
          <p className="text-muted-foreground">{project.description}</p>

        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setBillingSyncOpen(true)}>
            <IconCloudDownload className="mr-1.5 size-4" />
            同步账单
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            编辑项目
          </Button>
          <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">阶段转换</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>项目阶段转换</DialogTitle>
                <DialogDescription>将项目从当前阶段转换到下一阶段</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-muted-foreground">当前阶段:</span>
                  <StatusBadge status={project.stage} />
                </div>
                <div className="grid gap-2">
                  <Label>目标阶段</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择目标阶段" />
                    </SelectTrigger>
                    <SelectContent>
                      {stageSteps.map((stage) => (
                        <SelectItem
                          key={stage.key}
                          value={stage.key}
                          disabled={stage.key === project.stage}
                        >
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 mt-4">
                  <Label>转换说明</Label>
                  <Textarea placeholder="请输入转换说明" rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsStageDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={() => setIsStageDialogOpen(false)}>确认转换</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      <EditProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        businessLines={businessLines}
        onUpdated={async () => {
          const updated = await utils.crm.projects.getById.fetch({ id: project.id })
          if (updated) setProject(updated)
        }}
      />

      <ProjectBillingSyncDialog
        open={billingSyncOpen}
        onOpenChange={setBillingSyncOpen}
        projectId={project.id}
        projectName={project.name}
        onSynced={async () => {
          const updated = await utils.crm.projects.getById.fetch({ id: project.id })
          if (updated) setProject(updated)
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Banknote className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">充值（上月/本月）</p>
                <ProjectMonthMetricCell
                  lastMonth={project.lastMonthRecharge}
                  thisMonth={project.thisMonthRecharge}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">消费（上月/本月）</p>
                <ProjectMonthMetricCell
                  lastMonth={project.lastMonthConsumption}
                  thisMonth={project.thisMonthConsumption}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">总消费</p>
                <p className="font-medium">¥{project.totalConsumption.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">余额</p>
                <p className="font-medium">¥{project.balance.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="timeline">活动时间线</TabsTrigger>
          <TabsTrigger value="consumption">消费明细</TabsTrigger>
          {/* <TabsTrigger value="tasks">任务列表</TabsTrigger> */}
          <TabsTrigger value="orders">订单列表</TabsTrigger>
          <TabsTrigger value="coupons">算力券</TabsTrigger>
          <TabsTrigger value="recharges">充值记录</TabsTrigger>
          <TabsTrigger value="bills">月度账单</TabsTrigger>
          <TabsTrigger value="finance">收入/成本</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">售前经理</p>
                    <p className="font-medium">{project.preSalesManager}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">客户经理</p>
                    <p className="font-medium">{project.accountManager}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">交付经理</p>
                    <p className="font-medium">{project.deliveryManager}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">项目经理</p>
                    <p className="font-medium">{project.projectManager}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <ProjectCommissionInfoCard project={project} />


          <div className="grid grid-cols-1 gap-6">
            <ProjectBalanceTrendChart projectId={project.id} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProjectConsumptionTrendChart projectId={project.id} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">最近动态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.slice(0, 5).map((activity) => {
                    const Icon = getActivityIcon(activity.type)
                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{activity.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {getRoleLabel(activity.authorRole)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {activity.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activity.author} ·{' '}
                            {new Date(activity.createdAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">运行中的任务</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('tasks')}>
                查看全部
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务名称</TableHead>
                    <TableHead>资源类型</TableHead>
                    <TableHead>GPU 数量</TableHead>
                    <TableHead>运行时长</TableHead>
                    <TableHead>当前费用</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks
                    .filter((t) => t.status === 'running')
                    .map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {productLineNames[task.resourceType] || task.resourceType}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.gpuCount || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <RunningTaskElapsedHours startTime={task.startTime} />
                        </TableCell>
                        <TableCell>¥{task.cost.toLocaleString()}</TableCell>
                        <TableCell>
                          <StatusBadge status={task.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card> */}

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center mb-4 gap-6">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">项目阶段</h3>
                  <span className="text-sm text-muted-foreground">创建于 {project.createdAt}</span>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">所属客户</p>
                    <Link
                      href={`/crm/customers/${project.customerId}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {project.customerName}
                    </Link>
                  </div>
                </div>
                <div className="flex flex-row items-center gap-2">
                  <span className="text-xs text-muted-foreground">平台租户Id：</span>
                  <span className="font-medium font-mono">{project.platformTenantId ?? '—'}</span>
                  {project.platformTenantId && <CopyToClipboard text={project.platformTenantId} />}
                </div>
              </div>
              <div className="relative">
                <div className="flex justify-between mb-2">
                  {stageSteps.map((step, index) => (
                    <div key={step.key} className="flex-1 text-center">
                      <div
                        className={`
                    w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center
                    ${index <= currentStageIndex
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                          }
                  `}
                      >
                        {index < currentStageIndex ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <span className="font-medium">{index + 1}</span>
                        )}
                      </div>
                      <p
                        className={`text-sm font-medium ${index <= currentStageIndex ? '' : 'text-muted-foreground'}`}
                      >
                        {step.name}
                      </p>
                      <div className="mt-2 space-y-1">
                        {step.requirements.map((req) => (
                          <p key={req} className="text-xs text-muted-foreground">
                            {req}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-muted -z-10">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(currentStageIndex / (stageSteps.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <ProjectTimelinePanel project={project} />
        </TabsContent>

        <TabsContent value="consumption" className="mt-6 space-y-6">
          <ProjectDailyConsumptionPanel project={project} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <ProjectTasksPanel project={project} />
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <ProjectOrdersPanel project={project} />
        </TabsContent>

        <TabsContent value="coupons" className="mt-6">
          <ProjectCouponsPanel project={project} />
        </TabsContent>

        <TabsContent value="recharges" className="mt-6">
          <ProjectRechargesPanel project={project} />
        </TabsContent>

        <TabsContent value="bills" className="mt-6">
          <ProjectBillsPanel project={project} />
        </TabsContent>

        <TabsContent value="finance" className="mt-6">
          <ProjectMonthlyCostPanel project={project} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
