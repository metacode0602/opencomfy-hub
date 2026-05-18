'use client'

import { 
  Building2, 
  FolderKanban, 
  FileText, 
  TrendingUp,
  ArrowUpRight,
  Wallet,
  CreditCard,
} from 'lucide-react'
import Link from 'next/link'
import { StatCard } from '@/components/dashboard/stat-card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { mockCustomers, mockProjects, mockContracts, mockBills, mockActivities } from '@/lib/data/mock-data'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'

// 消费趋势数据
const consumptionTrend = [
  { month: '1月', consumption: 280000 },
  { month: '2月', consumption: 320000 },
  { month: '3月', consumption: 450000 },
  { month: '4月', consumption: 520000 },
  { month: '5月', consumption: 380000 },
]

// 产品线消费数据
const productLineData = [
  { name: 'Serverless', value: 125000, color: '#6366f1' },
  { name: '云主机', value: 280000, color: '#22c55e' },
  { name: 'Job 计算', value: 180000, color: '#f59e0b' },
  { name: '裸金属', value: 350000, color: '#ef4444' },
  { name: '存储服务', value: 85000, color: '#8b5cf6' },
]

export function DashboardContent() {
  const activeProjects = mockProjects.filter(p => p.status === 'active').length
  const totalConsumption = mockCustomers.reduce((acc, t) => acc + t.totalConsumption, 0)
  const totalBalance = mockCustomers.reduce((acc, t) => acc + t.balance, 0)
  const activeContracts = mockContracts.filter(c => c.status === 'active').length

  const recentProjects = mockProjects.slice(0, 5)
  const recentActivities = mockActivities.slice(0, 6)
  const pendingBills = mockBills.filter(b => b.status === 'pending' || b.status === 'overdue')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作台</h1>
          <p className="text-muted-foreground">欢迎回来，系统管理员</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">导出报表</Button>
          <Button>新建项目</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="活跃客户"
          value={mockCustomers.filter(t => t.status === 'active').length}
          description="较上月"
          icon={Building2}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="运行项目"
          value={activeProjects}
          description="较上月"
          icon={FolderKanban}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="本月消费"
          value={`¥${(totalConsumption / 10000).toFixed(1)}万`}
          description="较上月"
          icon={CreditCard}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="账户余额"
          value={`¥${(totalBalance / 10000).toFixed(1)}万`}
          description="总余额"
          icon={Wallet}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumption Trend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">消费趋势</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={consumptionTrend}>
                  <defs>
                    <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(value) => `${value / 10000}万`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fafafa' }}
                    formatter={(value: number | undefined) => [`¥${value?.toLocaleString()}`, '消费金额']}
                  />
                  <Area
                    type="monotone"
                    dataKey="consumption"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorConsumption)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Product Line Distribution */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">产品线消费分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productLineData} layout="vertical">
                  <XAxis 
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(value) => `${value / 10000}万`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fafafa' }}
                    formatter={(value: number | undefined) => [`¥${value?.toLocaleString()}`, '消费金额']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {productLineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">最近项目</CardTitle>
            <Link href="/projects">
              <Button variant="ghost" size="sm">
                查看全部
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>阶段</TableHead>
                  <TableHead>客户经理</TableHead>
                  <TableHead className="text-right">本月消费</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link 
                        href={`/projects/${project.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{project.customerName}</span>
                        <Badge variant="outline" className="text-xs">
                          {project.customerType === 'B' ? '企业' : '个人'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.stage} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.accountManager}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ¥{(project.totalConsumption / 10).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">最近动态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const project = mockProjects.find(p => p.id === activity.projectId)
                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{activity.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {project?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.createdAt.split('T')[0]}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Bills */}
      {pendingBills.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-medium">待处理账单</CardTitle>
              <Badge variant="destructive">{pendingBills.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账单月份</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>到期日</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.month}</TableCell>
                    <TableCell>{bill.projectName}</TableCell>
                    <TableCell>¥{bill.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{bill.dueDate}</TableCell>
                    <TableCell>
                      <StatusBadge status={bill.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
