'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Wallet,
  CreditCard,
  FolderKanban,
  Plus,
  Download,
  Ticket,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { StatusBadge } from '@/components/dashboard/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type { Tenant } from '@/lib/data/types'
import { 
  getProjectsByTenantId, 
  getRechargesByTenantId, 
  getConsumptionsByTenantId,
  getCouponsByTenantId,
  getContractsByTenantId,
} from '@/lib/data/mock-data'
import { productLineNames } from '@/lib/data/types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface TenantDetailContentProps {
  tenant: Tenant
}

const consumptionByProduct = [
  { name: 'Serverless', value: 35, color: '#6366f1' },
  { name: '云主机', value: 25, color: '#22c55e' },
  { name: 'Job 计算', value: 20, color: '#f59e0b' },
  { name: '裸金属', value: 12, color: '#ef4444' },
  { name: '存储', value: 8, color: '#8b5cf6' },
]

const monthlyConsumption = [
  { month: '1月', amount: 45000 },
  { month: '2月', amount: 52000 },
  { month: '3月', amount: 68000 },
  { month: '4月', amount: 75000 },
  { month: '5月', amount: 88000 },
]

export function TenantDetailContent({ tenant }: TenantDetailContentProps) {
  const [activeTab, setActiveTab] = useState('overview')
  
  const projects = getProjectsByTenantId(tenant.id)
  const recharges = getRechargesByTenantId(tenant.id)
  const consumptions = getConsumptionsByTenantId(tenant.id)
  const coupons = getCouponsByTenantId(tenant.id)
  const contracts = getContractsByTenantId(tenant.id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tenants">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <Badge variant="outline">
              {tenant.type === 'B' ? '企业' : '个人'}
            </Badge>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="text-muted-foreground">{tenant.industry}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            导出数据
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            充值
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">账户余额</p>
                <p className="text-xl font-bold">¥{tenant.balance.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总充值</p>
                <p className="text-xl font-bold">¥{tenant.totalRecharge.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总消费</p>
                <p className="text-xl font-bold">¥{tenant.totalConsumption.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">项目数量</p>
                <p className="text-xl font-bold">{tenant.projectCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">联系信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">联系人</p>
                <p className="font-medium">{tenant.contactPerson}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">电话</p>
                <p className="font-medium">{tenant.contactPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">邮箱</p>
                <p className="font-medium">{tenant.contactEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">地址</p>
                <p className="font-medium">{tenant.address}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="projects">项目</TabsTrigger>
          <TabsTrigger value="recharges">充值记录</TabsTrigger>
          <TabsTrigger value="consumptions">消费记录</TabsTrigger>
          <TabsTrigger value="coupons">算力券</TabsTrigger>
          <TabsTrigger value="contracts">合同</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consumption Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">消费趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyConsumption}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
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
                        fill="url(#colorAmount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Consumption Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">产品线分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] flex items-center">
                  <ResponsiveContainer width="60%" height="100%">
                    <PieChart>
                      <Pie
                        data={consumptionByProduct}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {consumptionByProduct.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number | undefined) => [`${value?.toLocaleString()}%`, '占比']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {consumptionByProduct.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-muted-foreground">{item.name}</span>
                        <span className="text-sm font-medium ml-auto">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">项目列表</CardTitle>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                新建项目
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目名称</TableHead>
                    <TableHead>阶段</TableHead>
                    <TableHead>客户经理</TableHead>
                    <TableHead>总消费</TableHead>
                    <TableHead>余额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Link 
                          href={`/projects/${project.id}`}
                          className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                        >
                          {project.name}
                          <ArrowUpRight className="w-3 h-3 opacity-50" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={project.stage} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.accountManager}
                      </TableCell>
                      <TableCell>¥{project.totalConsumption.toLocaleString()}</TableCell>
                      <TableCell>¥{project.balance.toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={project.status} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="ghost" size="sm">查看</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recharges" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">充值记录</CardTitle>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                新增充值
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>交易编号</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>支付方式</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>完成时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recharges.map((recharge) => (
                    <TableRow key={recharge.id}>
                      <TableCell className="font-mono text-sm">
                        {recharge.transactionId}
                      </TableCell>
                      <TableCell className="font-medium">
                        ¥{recharge.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recharge.paymentMethod === 'bank_transfer' && '银行转账'}
                        {recharge.paymentMethod === 'alipay' && '支付宝'}
                        {recharge.paymentMethod === 'wechat' && '微信支付'}
                        {recharge.paymentMethod === 'invoice' && '发票对公'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={recharge.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(recharge.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recharge.completedAt 
                          ? new Date(recharge.completedAt).toLocaleString('zh-CN')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumptions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">消费记录</CardTitle>
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
                    <TableHead>状态</TableHead>
                    <TableHead>过期时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
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
                      <TableCell>
                        <StatusBadge status={coupon.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(coupon.expiredAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">合同列表</CardTitle>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                新建合同
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>合同编号</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>合同金额</TableHead>
                    <TableHead>已支付</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-mono text-sm">
                        {contract.contractNo}
                      </TableCell>
                      <TableCell className="font-medium">
                        {contract.projectName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {contract.type === 'standard' && '标准合同'}
                          {contract.type === 'enterprise' && '企业合同'}
                          {contract.type === 'custom' && '定制合同'}
                        </Badge>
                      </TableCell>
                      <TableCell>¥{contract.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>¥{contract.paidAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {contract.startDate} ~ {contract.endDate}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={contract.status} />
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
