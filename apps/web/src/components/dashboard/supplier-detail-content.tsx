'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Settings2,
  FlaskConical,
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
import { SupplierContractsPanel } from '@/components/dashboard/supplier-contracts-panel'
import { SupplierUnitCostsPanel } from '@/components/dashboard/supplier-unit-costs-panel'
import { SupplierBillsPanel } from '@/components/dashboard/supplier-bills-panel'
import {
  SupplierActivityTimelinePanel,
  SupplierOnboardingBatchesPanel,
} from '@/components/dashboard/supplier-activity-timeline-panel'
import { PhysicalDevicesContent } from '@/app/[locale]/(protected)/supplier/_components/physical-devices-content'
import { EditSupplierDialog } from '@/components/dashboard/supplier-form-dialog'
import { resolveDomainSupplierId } from '@/lib/supplier/supplier-id-bridge'
import { toast } from 'sonner'
import { SupplierDeviceRetireDialog } from './supplier-device-retire-dialog'

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
])

export function SupplierDetailContent({ supplier: initialSupplier }: SupplierDetailContentProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabFromUrl = searchParams.get('tab')
  const [supplier, setSupplier] = useState(initialSupplier)
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : 'overview',
  )
  const [retireDialogOpen, setRetireDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const domainSupplierId = resolveDomainSupplierId(supplier.id)
  const utils = trpc.useUtils()

  const { data: activeStaff = [] } = trpc.crm.staff.listActive.useQuery()

  const updateSupplierMutation = trpc.supplier.update.useMutation({
    onSuccess: (updated) => {
      setSupplier(updated)
      void utils.supplier.getById.invalidate({ id: updated.id })
      void utils.supplier.list.invalidate()
      router.refresh()
      toast.success('供应商信息已更新')
    },
    onError: (error) => {
      toast.error(error.message || '更新失败，请稍后重试')
    },
  })

  useEffect(() => {
    setSupplier(initialSupplier)
  }, [initialSupplier])

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
  const maintenanceResourceGroups = devices.filter((d) => d.status === 'maintenance').length
  const internalTestResourceGroups = devices.filter((d) => d.isInternalTest).length
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Link href="/supplier/suppliers" className="shrink-0">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{supplier.name}</h1>
              <Badge variant="outline" className={statusColors[supplier.status]}>
                {statusNames[supplier.status]}
              </Badge>
            </div>
            <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <span className="flex min-w-0 items-start gap-1 sm:items-center">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
                <span className="break-words">{supplier.address}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Calendar className="h-4 w-4 shrink-0" />
                合作始于 {supplier.createdAt}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setEditDialogOpen(true)}>
            编辑信息
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => setRetireDialogOpen(true)}>
            设备下架
          </Button>
        </div>
      </div>

      <EditSupplierDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        supplier={supplier}
        activeStaff={activeStaff}
        onUpdated={async (updated) => {
          const businessManagerStaffId = activeStaff.find(
            (s) => s.display_name === updated.businessManager,
          )?.id
          if (!businessManagerStaffId) {
            toast.error('请选择有效的商务经理')
            throw new Error('invalid business manager')
          }
          await updateSupplierMutation.mutateAsync({
            id: updated.id,
            name: updated.name,
            shortName: updated.shortName,
            status: updated.status,
            cooperationMode: updated.cooperationMode,
            revenueShareRatio: updated.revenueShareRatio,
            businessManagerStaffId,
            contactPerson: updated.contactPerson,
            contactPhone: updated.contactPhone,
            contactEmail: updated.contactEmail,
            address: updated.address,
            bankAccount: updated.bankAccount,
            bankName: updated.bankName,
          })
        }}
      />

      <SupplierDeviceRetireDialog
        open={retireDialogOpen}
        onOpenChange={setRetireDialogOpen}
        supplierId={supplier.id}
        supplierName={supplier.name}
        onSuccess={() => {
          void utils.supplier.listGpuInventory.invalidate({ supplierId: supplier.id })
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">计价模式</p>
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
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">维护中资源组</p>
                <p className="text-2xl font-semibold text-foreground mt-1">
                  {maintenanceResourceGroups}
                </p>
              </div>
              <Settings2 className="w-8 h-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">内部测试中</p>
                <p className="text-2xl font-semibold text-foreground mt-1">
                  {internalTestResourceGroups}
                </p>
              </div>
              <FlaskConical className="w-8 h-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-max min-w-full flex-nowrap sm:w-fit">
            <TabsTrigger value="overview" className="shrink-0">
              概览
            </TabsTrigger>
            <TabsTrigger value="datacenters" className="shrink-0">
              机房管理
            </TabsTrigger>
            <TabsTrigger value="devices" className="shrink-0">
              设备资源
            </TabsTrigger>
            <TabsTrigger value="contracts" className="shrink-0">
              合同管理
            </TabsTrigger>
            <TabsTrigger value="unit-costs" className="shrink-0">
              卡型成本
            </TabsTrigger>
            <TabsTrigger value="bills" className="shrink-0">
              账单结算
            </TabsTrigger>
            <TabsTrigger value="batches" className="shrink-0">
              接入批次
            </TabsTrigger>
            <TabsTrigger value="timeline" className="shrink-0">
              活动时间线
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">联系信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">联系人</p>
                    <p className="break-words text-foreground">{supplier.contactPerson}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">联系电话</p>
                    <p className="break-all text-foreground">{supplier.contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">邮箱</p>
                    <p className="break-all text-foreground">{supplier.contactEmail}</p>
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
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">机房分布</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit self-start sm:self-auto"
                  onClick={() => setActiveTab('datacenters')}
                >
                  查看全部
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {dataCenters.map((dc) => (
                  <div
                    key={dc.id}
                    className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{dc.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dc.location}</span>
                      </p>
                    </div>
                    <div className="shrink-0 sm:text-right">
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

            <Card className="bg-card border-border md:col-span-2 xl:col-span-1">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">设备类型</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit self-start sm:self-auto"
                  onClick={() => setActiveTab('devices')}
                >
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
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">近期账单</CardTitle>
                <CardDescription>最近的结算记录</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit self-start sm:self-auto"
                onClick={() => setActiveTab('bills')}
              >
                查看全部
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="divide-y p-0 md:hidden">
                {bills.slice(0, 3).map((bill) => (
                  <div key={bill.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{bill.month}</p>
                      <Badge variant="outline" className={billStatusColors[bill.status]}>
                        {statusNames[bill.status]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
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
                      <span className="text-muted-foreground">
                        {bill.totalUsageHours.toLocaleString()} 小时
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        配套 ¥{(bill.networkFee + bill.managementFee).toLocaleString()}
                      </span>
                      <span className="font-medium text-foreground">
                        ¥{bill.finalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
            </CardContent>

            <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[720px]">
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
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="datacenters" className="space-y-4">
          <SupplierDatacentersPanel supplier={supplier} />
        </TabsContent>

        <TabsContent value="unit-costs" className="space-y-4">
          <SupplierUnitCostsPanel supplier={supplier} />
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <PhysicalDevicesContent supplierIdFilter={supplier.id} />
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
      </Tabs>
    </div>
  )
}
