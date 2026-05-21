'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Cpu,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  Banknote,
  TrendingUp,
  ChevronRight,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Progress } from '@workspace/ui/components/progress'
import type { Supplier } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { statusColors } from '@/lib/data/types'
import {
  billStatusColors,
  cooperationModeLabels,
  dcStatusColors,
  statusNames,
} from '@/components/dashboard/supplier-detail-constants'
import { SupplierDatacentersPanel } from '@/components/dashboard/supplier-datacenters-panel'
import { SupplierDevicesPanel } from '@/components/dashboard/supplier-devices-panel'
import { SupplierContractsPanel } from '@/components/dashboard/supplier-contracts-panel'
import { SupplierUnitCostsPanel } from '@/components/dashboard/supplier-unit-costs-panel'
import { SupplierBillsPanel } from '@/components/dashboard/supplier-bills-panel'
import {
  SupplierActivityTimelinePanel,
  SupplierOnboardingBatchesPanel,
} from '@/components/dashboard/supplier-activity-timeline-panel'
import { PhysicalDevicesContent } from '@/app/[locale]/(protected)/supplier/_components/physical-devices-content'
import { SupplierDeviceImportPanel } from '@/components/dashboard/supplier-device-import-panel'
import { SupplierDeviceRetireDialog } from '@/components/dashboard/supplier-device-retire-dialog'
import { resolveDomainSupplierId } from '@/lib/supplier/supplier-id-bridge'

interface SupplierDetailContentProps {
  supplier: Supplier
}

const VALID_TABS = new Set([
  'overview',
  'datacenters',
  'devices',
  'contracts',
  'unit-costs',
  'bills',
  'batches',
  'timeline',
  'machines',
  'ops-import',
])

export function SupplierDetailContent({ supplier }: SupplierDetailContentProps) {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : 'overview',
  )
  const [retireDialogOpen, setRetireDialogOpen] = useState(false)
  const domainSupplierId = resolveDomainSupplierId(supplier.id)
  const utils = trpc.useUtils()

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.has(tabFromUrl)) setActiveTab(tabFromUrl)
  }, [tabFromUrl])

  const { data: dataCenters = [] } = trpc.supplier.listDataCenters.useQuery({
    supplierId: supplier.id,
  })
  const { data: devices = [] } = trpc.supplier.listGpuInventory.useQuery({
    supplierId: supplier.id,
  })
  const { data: bills = [] } = trpc.supplier.listBills.useQuery({
    supplierId: supplier.id,
  })

  const totalOnlineDevices = devices.reduce((sum, d) => sum + d.onlineQuantity, 0)
  const totalDevices = devices.reduce((sum, d) => sum + d.quantity, 0)
  const onlineDataCenters = dataCenters.filter((dc) => dc.status === 'online').length
  const totalNetworkFee = dataCenters.reduce((sum, dc) => sum + dc.networkFee, 0)
  const totalManagementFee = dataCenters.reduce((sum, dc) => sum + dc.managementNodeFee, 0)

  const devicesByCardType = useMemo(
    () =>
      devices.reduce(
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
        [] as { cardTypeName: string; cardTypeId: string; quantity: number; onlineQuantity: number }[],
      ),
    [devices],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/supplier/suppliers">
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
          <Button>同步数据</Button>
          <Button onClick={() => setRetireDialogOpen(true)}>设备下架</Button>
        </div>
      </div>

      <SupplierDeviceRetireDialog
        open={retireDialogOpen}
        onOpenChange={setRetireDialogOpen}
        supplierId={supplier.id}
        supplierName={supplier.name}
        onSuccess={() => {
          void utils.supplier.listGpuInventory.invalidate({ supplierId: supplier.id })
        }}
      />

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
                    {cooperationModeLabels[supplier.cooperationMode]}
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
                  在线率{' '}
                  {totalDevices > 0
                    ? ((totalOnlineDevices / totalDevices) * 100).toFixed(1)
                    : '0.0'}
                  %
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="datacenters">机房管理</TabsTrigger>
          <TabsTrigger value="devices">设备资源</TabsTrigger>
          <TabsTrigger value="contracts">合同管理</TabsTrigger>
          <TabsTrigger value="unit-costs">卡型成本</TabsTrigger>
          <TabsTrigger value="bills">账单结算</TabsTrigger>
          <TabsTrigger value="batches">接入批次</TabsTrigger>
          <TabsTrigger value="timeline">活动时间线</TabsTrigger>
          <TabsTrigger value="machines">物理机</TabsTrigger>
          <TabsTrigger value="ops-import">运维导入</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
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
                  <div
                    key={dc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
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
                      value={
                        device.quantity > 0
                          ? (device.onlineQuantity / device.quantity) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

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
                          {cooperationModeLabels[bill.cooperationMode]}
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

        <TabsContent value="datacenters" className="space-y-4">
          <SupplierDatacentersPanel supplier={supplier} />
        </TabsContent>

        <TabsContent value="unit-costs" className="space-y-4">
          <SupplierUnitCostsPanel supplier={supplier} />
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <SupplierDevicesPanel
            supplier={supplier}
            onOpenOpsImport={() => setActiveTab('ops-import')}
          />
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <SupplierContractsPanel supplier={supplier} />
        </TabsContent>

        <TabsContent value="bills" className="space-y-4">
          <SupplierBillsPanel supplier={supplier} />
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <SupplierOnboardingBatchesPanel supplierId={domainSupplierId} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <SupplierActivityTimelinePanel supplierId={domainSupplierId} />
        </TabsContent>

        <TabsContent value="machines" className="space-y-4">
          <PhysicalDevicesContent supplierIdFilter={supplier.id} />
        </TabsContent>

        <TabsContent value="ops-import" className="space-y-4">
          <SupplierDeviceImportPanel supplierId={supplier.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
