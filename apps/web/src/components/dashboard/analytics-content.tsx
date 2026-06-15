'use client'

import { useState } from 'react'
import { 
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Server,
  Cloud,
  Cpu,
  HardDrive,
  Database,
  Package,
  Layers,
  Zap,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Badge } from '@workspace/ui/components/badge'
import { Progress } from '@workspace/ui/components/progress'
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
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { trpc } from '@/lib/trpc/client'

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']


const PRODUCT_LINE_ICONS: Record<string, typeof Zap> = {
  serverless: Zap,
  cloud_vm: Cloud,
  job: Cpu,
  bare_metal: Server,
  storage: HardDrive,
}

// 客户消费排名
const topTenants = [
  { name: '上海云算科技股份公司', consumption: 650000, change: 12.5 },
  { name: '北京深智科技有限公司', consumption: 328000, change: 8.3 },
  { name: '杭州智图数据有限公司', consumption: 195000, change: -5.2 },
  { name: '成都创新视觉工作室', consumption: 89000, change: 15.7 },
  { name: '王小明', consumption: 6500, change: 3.2 },
]

// 日消费趋势
const dailyConsumption = [
  { date: '05-01', amount: 28500 },
  { date: '05-02', amount: 32000 },
  { date: '05-03', amount: 29800 },
  { date: '05-04', amount: 35600 },
  { date: '05-05', amount: 31200 },
  { date: '05-06', amount: 28900 },
  { date: '05-07', amount: 34500 },
  { date: '05-08', amount: 38200 },
  { date: '05-09', amount: 36800 },
  { date: '05-10', amount: 42500 },
  { date: '05-11', amount: 39800 },
  { date: '05-12', amount: 35600 },
  { date: '05-13', amount: 41200 },
  { date: '05-14', amount: 38900 },
]

export function AnalyticsContent() {
  const [period, setPeriod] = useState('month')
  const { data: summary } = trpc.crm.dashboard.summary.useQuery()
  const { data: productLineRaw = [] } = trpc.crm.analytics.productLineBreakdown.useQuery()
  const { data: monthlyTrendRaw = [] } = trpc.crm.analytics.consumptionTrend.useQuery()
  const monthlyTrend = monthlyTrendRaw.map((row) =>
    'month' in row
      ? { month: row.month, consumption: row.consumption }
      : { month: row.date.slice(0, 7), consumption: row.consumption },
  )

  const productLineData = productLineRaw.map((p, i) => ({
    name: p.name,
    value: p.value,
    color: CHART_COLORS[i % CHART_COLORS.length]!,
    icon: PRODUCT_LINE_ICONS[p.name] ?? Zap,
    change: 0,
  }))

  const totalConsumption =
    productLineData.reduce((acc, p) => acc + p.value, 0) ||
    summary?.thisMonthConsumption ||
    0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">消费统计</h1>
          <p className="text-muted-foreground">查看和分析各产品线的消费数据</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">最近 7 天</SelectItem>
              <SelectItem value="month">最近 30 天</SelectItem>
              <SelectItem value="quarter">最近 3 个月</SelectItem>
              <SelectItem value="year">最近 1 年</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总消费</p>
                <p className="text-2xl font-bold">¥{(totalConsumption / 10000).toFixed(1)}万</p>
              </div>
              <div className="flex items-center text-green-500 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                12.5%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">日均消费</p>
                <p className="text-2xl font-bold">¥{(totalConsumption / 30 / 1000).toFixed(1)}k</p>
              </div>
              <div className="flex items-center text-green-500 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                8.3%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">活跃客户</p>
                <p className="text-2xl font-bold">{summary?.activeCustomerCount ?? 0}</p>
              </div>
              <div className="flex items-center text-green-500 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                25%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">活跃项目</p>
                <p className="text-2xl font-bold">{summary?.activeProjectCount ?? 0}</p>
              </div>
              <div className="flex items-center text-red-500 text-sm">
                <TrendingDown className="w-4 h-4 mr-1" />
                5.2%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="products">产品线分析</TabsTrigger>
          <TabsTrigger value="tenants">客户分析</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Daily Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">日消费趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyConsumption}>
                    <defs>
                      <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
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
                      labelStyle={{ color: '#fafafa' }}
                      formatter={(value) => [`¥${Number(value ?? 0).toLocaleString()}`, '消费金额']}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDaily)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Product Line & Top Tenants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Line Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">产品线分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                      <Pie
                        data={productLineData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {productLineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => [`¥${Number(value ?? 0).toLocaleString()}`, '消费金额']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {productLineData.slice(0, 6).map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-muted-foreground flex-1 truncate">{item.name}</span>
                        <span className="text-sm font-medium">
                          {((item.value / totalConsumption) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Tenants */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">客户消费排名</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topTenants.map((tenant, index) => (
                    <div key={tenant.name} className="flex items-center gap-4">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm
                        ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                          index === 1 ? 'bg-gray-400/20 text-gray-400' :
                          index === 2 ? 'bg-orange-500/20 text-orange-500' :
                          'bg-muted text-muted-foreground'}
                      `}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ¥{tenant.consumption.toLocaleString()}
                        </p>
                      </div>
                      <div className={`flex items-center text-sm ${
                        tenant.change >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {tenant.change >= 0 ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        {Math.abs(tenant.change)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-6 mt-6">
          {/* Product Line Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">产品线消费趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
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
                      formatter={(value) => [`¥${Number(value ?? 0).toLocaleString()}`, '消费']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="consumption"
                      name="总消费"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Product Line Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {productLineData.map((product) => {
              const Icon = product.icon
              return (
                <Card key={product.name}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${product.color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: product.color }} />
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {((product.value / totalConsumption) * 100).toFixed(1)}% 占比
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold">
                        ¥{(product.value / 10000).toFixed(1)}万
                      </p>
                      <div className={`flex items-center text-sm ${
                        product.change >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {product.change >= 0 ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        {Math.abs(product.change)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-6 mt-6">
          {/* Tenant Consumption Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">客户消费明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>排名</TableHead>
                    <TableHead>客户名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>消费金额</TableHead>
                    <TableHead>占比</TableHead>
                    <TableHead>环比变化</TableHead>
                    <TableHead>消费占比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topTenants.map((tenant, index) => (
                    <TableRow key={tenant.name}>
                      <TableCell>
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center font-medium text-xs
                          ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                            index === 1 ? 'bg-gray-400/20 text-gray-400' :
                            index === 2 ? 'bg-orange-500/20 text-orange-500' :
                            'bg-muted text-muted-foreground'}
                        `}>
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tenant.consumption > 100000 ? '企业' : '个人'}
                        </Badge>
                      </TableCell>
                      <TableCell>¥{tenant.consumption.toLocaleString()}</TableCell>
                      <TableCell>
                        {((tenant.consumption / topTenants.reduce((a, t) => a + t.consumption, 0)) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center ${
                          tenant.change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {tenant.change >= 0 ? (
                            <TrendingUp className="w-4 h-4 mr-1" />
                          ) : (
                            <TrendingDown className="w-4 h-4 mr-1" />
                          )}
                          {Math.abs(tenant.change)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress 
                            value={(tenant.consumption / (topTenants[0]?.consumption ?? 1)) * 100} 
                            className="h-1.5 flex-1" 
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
