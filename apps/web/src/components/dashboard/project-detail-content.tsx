'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft,
  Building2,
  User,
  Calendar,
  Wallet,
  CreditCard,
  Plus,
  Download,
  Ticket,
  MessageSquare,
  FileText,
  Video,
  CheckCircle,
  Clock,
  ArrowRight,
  Upload,
  Send,
  MoreHorizontal,
  Play,
  Pause,
  XCircle,
  Receipt,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Textarea } from '@workspace/ui/components/textarea'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Progress } from '@workspace/ui/components/progress'
import { Separator } from '@workspace/ui/components/separator'
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
import { Input } from '@workspace/ui/components/input'
import type { Project } from '@/lib/data/types'
import { 
  getActivitiesByProjectId,
  getTasksByProjectId,
  getOrdersByProjectId,
  getBillsByProjectId,
  mockTenants,
  mockConsumptions,
  mockCoupons,
} from '@/lib/data/mock-data'
import { productLineNames, stageNames } from '@/lib/data/types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ValueType } from 'recharts/types/component/DefaultTooltipContent'

interface ProjectDetailContentProps {
  project: Project
}

const stageSteps = [
  { key: 'lead', name: '线索孵化', requirements: ['需求确认', '技术评估', '方案设计'] },
  { key: 'testing', name: '测试中', requirements: ['POC 测试', '性能验证', '签订合同'] },
  { key: 'converted', name: '已转正', requirements: ['正式运营', '持续维护', '定期回顾'] },
]

const consumptionTrend = [
  { date: '05-01', amount: 8500 },
  { date: '05-03', amount: 12000 },
  { date: '05-05', amount: 9800 },
  { date: '05-07', amount: 15600 },
  { date: '05-09', amount: 11200 },
  { date: '05-11', amount: 18900 },
  { date: '05-13', amount: 14500 },
]

export function ProjectDetailContent({ project }: ProjectDetailContentProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [comment, setComment] = useState('')
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false)
  
  const tenant = mockTenants.find(t => t.id === project.tenantId)
  const activities = getActivitiesByProjectId(project.id)
  const tasks = getTasksByProjectId(project.id)
  const orders = getOrdersByProjectId(project.id)
  const bills = getBillsByProjectId(project.id)
  const consumptions = mockConsumptions.filter(c => c.projectId === project.id)
  const coupons = mockCoupons.filter(c => c.projectId === project.id)

  const currentStageIndex = stageSteps.findIndex(s => s.key === project.stage)

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment': return MessageSquare
      case 'file': return FileText
      case 'meeting': return Video
      case 'task': return CheckCircle
      case 'stage_change': return ArrowRight
      case 'recharge': return Wallet
      case 'consumption': return CreditCard
      default: return Clock
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'sales': return '销售'
      case 'account_manager': return '客户经理'
      case 'pre_sales': return '售前'
      case 'system': return '系统'
      default: return role
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <StatusBadge status={project.stage} />
            <StatusBadge status={project.status} />
          </div>
          <p className="text-muted-foreground">{project.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                阶段转换
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>项目阶段转换</DialogTitle>
                <DialogDescription>
                  将项目从当前阶段转换到下一阶段
                </DialogDescription>
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
                <Button onClick={() => setIsStageDialogOpen(false)}>
                  确认转换
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            导出数据
          </Button>
          <Button>
            <Ticket className="w-4 h-4 mr-2" />
            发放算力券
          </Button>
        </div>
      </div>

      {/* Stage Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">项目阶段</h3>
            <span className="text-sm text-muted-foreground">
              创建于 {project.createdAt}
            </span>
          </div>
          <div className="relative">
            <div className="flex justify-between mb-2">
              {stageSteps.map((step, index) => (
                <div 
                  key={step.key}
                  className="flex-1 text-center"
                >
                  <div className={`
                    w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center
                    ${index <= currentStageIndex 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'}
                  `}>
                    {index < currentStageIndex ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="font-medium">{index + 1}</span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${index <= currentStageIndex ? '' : 'text-muted-foreground'}`}>
                    {step.name}
                  </p>
                  <div className="mt-2 space-y-1">
                    {step.requirements.map((req) => (
                      <p key={req} className="text-xs text-muted-foreground">{req}</p>
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

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">所属租户</p>
                <Link 
                  href={`/tenants/${project.tenantId}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {project.tenantName}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="timeline">活动时间线</TabsTrigger>
          <TabsTrigger value="consumption">消费明细</TabsTrigger>
          <TabsTrigger value="tasks">任务列表</TabsTrigger>
          <TabsTrigger value="orders">订单列表</TabsTrigger>
          <TabsTrigger value="coupons">算力券</TabsTrigger>
          <TabsTrigger value="bills">月度账单</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consumption Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">消费趋势（近两周）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={consumptionTrend}>
                      <defs>
                        <linearGradient id="colorConsume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickFormatter={(value) => `${value / 1000}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number | undefined) => [`¥${value?.toLocaleString()}`, '消费金额']}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorConsume)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activities */}
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
                            {activity.author} · {new Date(activity.createdAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Running Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">运行中的任务</CardTitle>
              <Button variant="ghost" size="sm">查看全部</Button>
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
                  {tasks.filter(t => t.status === 'running').map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {productLineNames[task.resourceType] || task.resourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.gpuCount || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {Math.floor((Date.now() - new Date(task.startTime).getTime()) / 3600000)}h
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
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">活动时间线</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  上传文件
                </Button>
                <Button variant="outline" size="sm">
                  <Video className="w-4 h-4 mr-2" />
                  记录会议
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Add Comment */}
              <div className="flex gap-4 mb-6 pb-6 border-b">
                <Avatar className="w-10 h-10">
                  <AvatarFallback>管理</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    placeholder="添加评论或备注..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" disabled={!comment.trim()}>
                      <Send className="w-4 h-4 mr-2" />
                      发送
                    </Button>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-6">
                {activities.map((activity, index) => {
                  const Icon = getActivityIcon(activity.type)
                  return (
                    <div key={activity.id} className="flex gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        {index < activities.length - 1 && (
                          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-[calc(100%-12px)] bg-border" />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{activity.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {getRoleLabel(activity.authorRole)}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1">{activity.description}</p>
                        <p className="text-sm text-muted-foreground mt-2">{activity.author}</p>
                        
                        {activity.attachments && activity.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {activity.attachments.map((file) => (
                              <div 
                                key={file.id}
                                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                              >
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                                <Button variant="ghost" size="sm">
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {activity.metadata && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">
                                  {key === 'duration' ? '时长' : key === 'attendees' ? '参与人' : key}:
                                </span>
                                <span>
                                  {Array.isArray(value) ? (value as string[]).join(', ') : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumption" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">消费明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>产品线</TableHead>
                    <TableHead>资源名称</TableHead>
                    <TableHead>消费金额</TableHead>
                    <TableHead>使用量</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptions.map((consumption) => (
                    <TableRow key={consumption.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {productLineNames[consumption.productLine]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {consumption.resourceName}
                      </TableCell>
                      <TableCell>¥{consumption.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {consumption.duration} {consumption.unit === 'hour' && '小时'}
                        {consumption.unit === 'day' && '天'}
                        {consumption.unit === 'month' && '月'}
                        {consumption.unit === 'count' && '次'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(consumption.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">任务列表</CardTitle>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                创建任务
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>资源类型</TableHead>
                    <TableHead>GPU</TableHead>
                    <TableHead>内存</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>费用</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {task.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {productLineNames[task.resourceType] || task.resourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.gpuCount || '-'}</TableCell>
                      <TableCell>{task.memoryGB ? `${task.memoryGB}GB` : '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(task.startTime).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell>¥{task.cost.toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {task.status === 'running' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {task.status === 'pending' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">订单列表</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单编号</TableHead>
                    <TableHead>产品线</TableHead>
                    <TableHead>订单金额</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.orderNo}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {productLineNames[order.productLine] || order.productLine}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ¥{order.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">查看详情</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coupons" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">算力券</CardTitle>
              <Button size="sm">
                <Ticket className="w-4 h-4 mr-2" />
                发放算力券
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>券码</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>面值/折扣</TableHead>
                    <TableHead>最低消费</TableHead>
                    <TableHead>发放时间</TableHead>
                    <TableHead>过期时间</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.length > 0 ? coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono text-sm">
                        {coupon.code}
                      </TableCell>
                      <TableCell className="font-medium">{coupon.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {coupon.type === 'cash' ? '现金券' : '折扣券'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {coupon.type === 'cash' 
                          ? `¥${coupon.value.toLocaleString()}`
                          : `${coupon.value}% OFF`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ¥{coupon.minAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(coupon.issuedAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(coupon.expiredAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={coupon.status} />
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        暂无算力券
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bills" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">月度账单</CardTitle>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出账单
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {bills.map((bill) => (
                  <div key={bill.id} className="border rounded-lg">
                    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Receipt className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{bill.month} 月度账单</p>
                          <p className="text-sm text-muted-foreground">
                            到期日: {bill.dueDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            ¥{bill.totalAmount.toLocaleString()}
                          </p>
                        </div>
                        <StatusBadge status={bill.status} />
                      </div>
                    </div>
                    <div className="p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>产品线</TableHead>
                            <TableHead>资源名称</TableHead>
                            <TableHead>使用量</TableHead>
                            <TableHead>单价</TableHead>
                            <TableHead className="text-right">金额</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bill.details.map((detail, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Badge variant="outline">{detail.productLine}</Badge>
                              </TableCell>
                              <TableCell>{detail.resourceName}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {detail.usage} {detail.unit}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                ¥{detail.unitPrice}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ¥{detail.amount.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
