'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Cpu,
  FileText,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  Banknote,
  Server,
  Plus,
  MoreHorizontal,         
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ChevronRight,
  Download,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Progress } from '@workspace/ui/components/progress'
import {
  getDataCentersBySupplierId,
  getDevicesBySupplierId,
  getSupplierContractsBySupplierId,
  getSupplierBillsBySupplierId,
  mockGPUCardTypes,
} from '@/lib/data/mock-data'
import type { Supplier } from '@/lib/data/types'
import { cooperationModeNames, statusColors } from '@/lib/data/types'

const statusNames: Record<string, string> = {
  negotiating: '洽谈中',
  cooperating: '合作中',
  suspended: '已暂停',
  terminated: '已终止',
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
  draft: '草稿',
  pending: '待签署',
  active: '生效中',
  expired: '已过期',
  confirmed: '已确认',
  paid: '已结算',
}

const dcStatusColors: Record<string, string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const billStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
}

interface SupplierDetailContentProps {
  supplier: Supplier
}

export function SupplierDetailContent({ supplier }: SupplierDetailContentProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const dataCenters = getDataCentersBySupplierId(supplier.id)
  const devices = getDevicesBySupplierId(supplier.id)
  const contracts = getSupplierContractsBySupplierId(supplier.id)
  const bills = getSupplierBillsBySupplierId(supplier.id)

  const totalOnlineDevices = devices.reduce((sum, d) => sum + d.onlineQuantity, 0)
  const totalDevices = devices.reduce((sum, d) => sum + d.quantity, 0)
  const onlineDataCenters = dataCenters.filter((dc) => dc.status === 'online').length
  const totalNetworkFee = dataCenters.reduce((sum, dc) => sum + dc.networkFee, 0)
  const totalManagementFee = dataCenters.reduce((sum, dc) => sum + dc.managementNodeFee, 0)

  // Group devices by card type
  const devicesByCardType = devices.reduce(
    (acc, device) => {
      const existing = acc.find((d) => d.cardTypeName === device.cardTypeName)
      if (existing) {
        existing.quantity += device.quantity
        existing.onlineQuantity += device.onlineQuantity
      } else {
        acc.push({
          cardTypeName: device.cardTypeName,
          cardTypeId: device.cardTypeId,
          quantity: device.quantity,
          onlineQuantity: device.onlineQuantity,
        })
      }
      return acc
    },
    [] as { cardTypeName: string; cardTypeId: string; quantity: number; onlineQuantity: number }[]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">{supplier.name}</h1>
              <Badge variant="outline" className={statusColors[supplier.status]}>
                {statusNames[supplier.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {supplier.address}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                合作始于 {supplier.createdAt}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">编辑信息</Button>
          <Button>新增机房</Button>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">合作模式</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={
                      supplier.cooperationMode === 'card_time'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                    }
                  >
                    {cooperationModeNames[supplier.cooperationMode]}
                  </Badge>
                  {supplier.revenueShareRatio && (
                    <span className="text-sm text-foreground font-medium">
                      {supplier.revenueShareRatio}%
                    </span>
                  )}
                </div>
              </div>
              <Banknote className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">机房数量</p>
                <p className="text-2xl font-semibold text-foreground mt-1">
                  {onlineDataCenters}/{dataCenters.length}
                </p>
                <p className="text-xs text-green-500">在线/总数</p>
              </div>
              <Building2 className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">设备数量</p>
                <p className="text-2xl font-semibold text-foreground mt-1">
                  {totalOnlineDevices.toLocaleString()}/{totalDevices.toLocaleString()}
                </p>
                <p className="text-xs text-green-500">
                  在线率 {((totalOnlineDevices / totalDevices) * 100).toFixed(1)}%
                </p>
              </div>
              <Cpu className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">月结算额</p>
                <p className="text-2xl font-semibold text-foreground mt-1">
                  ¥{supplier.monthlySettlement.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  含配套费用 ¥{(totalNetworkFee + totalManagementFee).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="datacenters">机房管理</TabsTrigger>
          <TabsTrigger value="devices">设备资源</TabsTrigger>
          <TabsTrigger value="contracts">合同管理</TabsTrigger>
          <TabsTrigger value="bills">账单结算</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Contact Info */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">联系信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">联系人</p>
                    <p className="text-foreground">{supplier.contactPerson}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">联系电话</p>
                    <p className="text-foreground">{supplier.contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">邮箱</p>
                    <p className="text-foreground">{supplier.contactEmail}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">商务经理</p>
                  <p className="text-foreground font-medium">{supplier.businessManager}</p>
                </div>
                {supplier.bankAccount && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">银行账户</p>
                    <p className="text-foreground text-sm">{supplier.bankAccount}</p>
                    <p className="text-xs text-muted-foreground">{supplier.bankName}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Centers Summary */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">机房分布</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('datacenters')}>
                  查看全部
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {dataCenters.map((dc) => (
                  <div key={dc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{dc.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {dc.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={dcStatusColors[dc.status]}>
                        {statusNames[dc.status]}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dc.onlineDeviceCount}/{dc.totalDeviceCount} 设备
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Device Types Summary */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">设备类型</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('devices')}>
                  查看全部
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {devicesByCardType.map((device) => (
                  <div key={device.cardTypeId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{device.cardTypeName}</span>
                      <span className="text-sm text-muted-foreground">
                        {device.onlineQuantity}/{device.quantity}
                      </span>
                    </div>
                    <Progress
                      value={(device.onlineQuantity / device.quantity) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recent Bills */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">近期账单</CardTitle>
                <CardDescription>最近的结算记录</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('bills')}>
                查看全部
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">账单月份</TableHead>
                    <TableHead className="text-muted-foreground">结算模式</TableHead>
                    <TableHead className="text-muted-foreground">使用卡时</TableHead>
                    <TableHead className="text-muted-foreground">配套费用</TableHead>
                    <TableHead className="text-muted-foreground">结算金额</TableHead>
                    <TableHead className="text-muted-foreground">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.slice(0, 3).map((bill) => (
                    <TableRow key={bill.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{bill.month}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            bill.cooperationMode === 'card_time'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          }
                        >
                          {cooperationModeNames[bill.cooperationMode]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {bill.totalUsageHours.toLocaleString()} 小时
                      </TableCell>
                      <TableCell className="text-foreground">
                        ¥{(bill.networkFee + bill.managementFee).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        ¥{bill.finalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={billStatusColors[bill.status]}>
                          {statusNames[bill.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Centers Tab */}
        <TabsContent value="datacenters" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-foreground">机房管理</h2>
              <p className="text-sm text-muted-foreground">管理供应商的数据中心和配套费用</p>
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新增机房
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {dataCenters.map((dc) => {
              const dcDevices = devices.filter((d) => d.dataCenterId === dc.id)
              const dcOnlineDevices = dcDevices.reduce((sum, d) => sum + d.onlineQuantity, 0)
              const dcTotalDevices = dcDevices.reduce((sum, d) => sum + d.quantity, 0)

              return (
                <Card key={dc.id} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{dc.name}</CardTitle>
                          <Badge variant="outline" className={dcStatusColors[dc.status]}>
                            {statusNames[dc.status]}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {dc.address}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>编辑机房</DropdownMenuItem>
                          <DropdownMenuItem>管理设备</DropdownMenuItem>
                          <DropdownMenuItem>调整费用</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">机房编码:</span>
                      <code className="px-2 py-0.5 rounded bg-muted text-foreground">{dc.code}</code>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                      <div>
                        <p className="text-sm text-muted-foreground">设备在线率</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress
                            value={dcTotalDevices > 0 ? (dcOnlineDevices / dcTotalDevices) * 100 : 0}
                            className="h-2 flex-1"
                          />
                          <span className="text-sm font-medium text-foreground">
                            {dcOnlineDevices}/{dcTotalDevices}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">设备类型</p>
                        <p className="text-foreground font-medium mt-1">
                          {dcDevices.length} 种卡型
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">网络费用 (月)</p>
                        <p className="text-lg font-semibold text-foreground">
                          ¥{dc.networkFee.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">管控节点费用 (月)</p>
                        <p className="text-lg font-semibold text-foreground">
                          ¥{dc.managementNodeFee.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">设备分布</p>
                      <div className="flex flex-wrap gap-1">
                        {dcDevices.map((device) => (
                          <Badge key={device.id} variant="secondary" className="text-xs">
                            {device.cardTypeName}: {device.onlineQuantity}/{device.quantity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-foreground">设备资源</h2>
              <p className="text-sm text-muted-foreground">管理各机房的GPU设备和成本配置</p>
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新增设备
            </Button>
          </div>

          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">机房</TableHead>
                  <TableHead className="text-muted-foreground">卡型</TableHead>
                  <TableHead className="text-muted-foreground">数量</TableHead>
                  <TableHead className="text-muted-foreground">在线</TableHead>
                  <TableHead className="text-muted-foreground">在线率</TableHead>
                  <TableHead className="text-muted-foreground">
                    {supplier.cooperationMode === 'card_time' ? '卡时成本' : '分成成本'}
                  </TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const onlineRate = (device.onlineQuantity / device.quantity) * 100
                  return (
                    <TableRow key={device.id} className="border-border">
                      <TableCell className="font-medium text-foreground">
                        {device.dataCenterName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">{device.cardTypeName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{device.quantity}</TableCell>
                      <TableCell className="text-foreground">{device.onlineQuantity}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={onlineRate} className="h-2 w-16" />
                          <span className="text-sm text-foreground">{onlineRate.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        ¥
                        {(device.cardTimeCostPerHour || device.revenueShareCostPerHour || 0).toFixed(
                          0
                        )}
                        /小时
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={dcStatusColors[device.status]}>
                          {statusNames[device.status]}
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
                            <DropdownMenuItem>编辑设备</DropdownMenuItem>
                            <DropdownMenuItem>调整成本</DropdownMenuItem>
                            <DropdownMenuItem>查看使用记录</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Cost Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Server className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{totalDevices}</p>
                    <p className="text-xs text-muted-foreground">设备总数</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{totalOnlineDevices}</p>
                    <p className="text-xs text-muted-foreground">在线设备</p>
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
                    <p className="text-2xl font-semibold text-foreground">
                      {devicesByCardType.length}
                    </p>
                    <p className="text-xs text-muted-foreground">卡型种类</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-foreground">合同管理</h2>
              <p className="text-sm text-muted-foreground">管理与供应商签署的合作合同</p>
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新增合同
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {contracts.map((contract) => (
              <Card key={contract.id} className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{contract.contractNo}</CardTitle>
                        <Badge variant="outline" className={statusColors[contract.status]}>
                          {statusNames[contract.status]}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">
                        {contract.type === 'cooperation'
                          ? '合作协议'
                          : contract.type === 'supplement'
                            ? '补充协议'
                            : '续签协议'}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>查看合同</DropdownMenuItem>
                        <DropdownMenuItem>下载合同</DropdownMenuItem>
                        <DropdownMenuItem>编辑合同</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        contract.cooperationMode === 'card_time'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                      }
                    >
                      {cooperationModeNames[contract.cooperationMode]}
                    </Badge>
                    {contract.revenueShareRatio && (
                      <span className="text-sm text-foreground">
                        分成比例: {contract.revenueShareRatio}%
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border text-sm">
                    <div>
                      <p className="text-muted-foreground">合同期限</p>
                      <p className="text-foreground">
                        {contract.startDate} ~ {contract.endDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">签署日期</p>
                      <p className="text-foreground">{contract.signedAt || '待签署'}</p>
                    </div>
                  </div>

                  {contract.signerName && (
                    <div className="pt-3 border-t border-border text-sm">
                      <p className="text-muted-foreground">签署人</p>
                      <p className="text-foreground">{contract.signerName}</p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border text-sm">
                    <p className="text-muted-foreground">合同条款</p>
                    <p className="text-foreground">{contract.terms}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Bills Tab */}
        <TabsContent value="bills" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-foreground">账单结算</h2>
              <p className="text-sm text-muted-foreground">按月查看与供应商的结算账单</p>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              导出账单
            </Button>
          </div>

          {bills.map((bill) => (
            <Card key={bill.id} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <CardTitle className="text-base">{bill.month} 月度账单</CardTitle>
                      <CardDescription>
                        账单生成于 {new Date(bill.createdAt).toLocaleDateString('zh-CN')}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={billStatusColors[bill.status]}>
                      {statusNames[bill.status]}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-foreground">
                      ¥{bill.finalAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">应结金额</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Bill Summary */}
                <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm text-muted-foreground">结算模式</p>
                    <Badge
                      variant="outline"
                      className={
                        bill.cooperationMode === 'card_time'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 mt-1'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/30 mt-1'
                      }
                    >
                      {cooperationModeNames[bill.cooperationMode]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">总使用卡时</p>
                    <p className="text-lg font-semibold text-foreground">
                      {bill.totalUsageHours.toLocaleString()} 小时
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">网络费用</p>
                    <p className="text-lg font-semibold text-foreground">
                      ¥{bill.networkFee.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">管控节点费用</p>
                    <p className="text-lg font-semibold text-foreground">
                      ¥{bill.managementFee.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Bill Details */}
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">机房</TableHead>
                      <TableHead className="text-muted-foreground">卡型</TableHead>
                      <TableHead className="text-muted-foreground">使用卡时</TableHead>
                      <TableHead className="text-muted-foreground">单价</TableHead>
                      {bill.cooperationMode === 'revenue_share' && (
                        <TableHead className="text-muted-foreground">租户消费</TableHead>
                      )}
                      <TableHead className="text-muted-foreground">金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bill.details.map((detail, index) => (
                      <TableRow key={index} className="border-border">
                        <TableCell className="text-foreground">{detail.dataCenterName}</TableCell>
                        <TableCell className="text-foreground">{detail.cardTypeName}</TableCell>
                        <TableCell className="text-foreground">
                          {detail.usageHours.toLocaleString()} 小时
                        </TableCell>
                        <TableCell className="text-foreground">¥{detail.unitCost}/小时</TableCell>
                        {bill.cooperationMode === 'revenue_share' && (
                          <TableCell className="text-foreground">
                            ¥{(detail.tenantConsumption || 0).toLocaleString()}
                          </TableCell>
                        )}
                        <TableCell className="font-medium text-foreground">
                          {bill.cooperationMode === 'card_time' ? (
                            `¥${detail.amount.toLocaleString()}`
                          ) : (
                            <span>
                              ¥
                              {(
                                ((detail.tenantConsumption || 0) * (supplier.revenueShareRatio || 0)) /
                                100
                              ).toLocaleString()}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Payment Info */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      结算截止: {bill.dueDate}
                    </span>
                    {bill.paidAt && (
                      <span className="text-green-500 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        已于 {new Date(bill.paidAt).toLocaleDateString('zh-CN')} 结算
                      </span>
                    )}
                  </div>
                  {bill.status === 'pending' && (
                    <Button>确认结算</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
