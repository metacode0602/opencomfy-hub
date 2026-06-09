'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Cpu,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Power,
  Server,
  Settings2,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Progress } from '@workspace/ui/components/progress'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
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
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'
import type { DataCenterDevice, OpsStatusBreakdownItem } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { DEVICE_OPS_STATUS_SEEDS } from '@workspace/db/schema'
import { dcStatusColors, statusNames } from '@/components/dashboard/supplier-detail-constants'
import { DeviceImportCards } from '@/components/dashboard/device-import/device-import-cards'
import { SupplierUnitCostsPanel } from '@/components/dashboard/supplier-unit-costs-panel'
import { DatacenterDeviceRetireDialog } from '@/app/[locale]/(protected)/supplier/_components/datacenter-device-retire-dialog'
import { DatacenterPlannedBatchesPanel } from './datacenter-planned-batches-panel'
import { DatacenterOnboardingDialog } from '@/app/[locale]/(protected)/supplier/_components/datacenter-onboarding-dialog'
import { EditDatacenterDialog } from '@/components/dashboard/edit-datacenter-dialog'
import { SupplierOpsEngineersList } from '@/components/dashboard/supplier-ops-engineers-list'
import { toast } from 'sonner'

const inventoryStatusColors: Record<DataCenterDevice['status'], string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const DEFAULT_OPS_STATUS_BREAKDOWN: OpsStatusBreakdownItem[] = DEVICE_OPS_STATUS_SEEDS.map(
  (s) => ({ opsStatus: s.stateCode, count: 0 }),
)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '加载失败，请稍后重试'
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground sm:text-right">{children}</div>
    </div>
  )
}

export function DatacenterDetailContent({ dataCenterId }: { dataCenterId: string }) {
  const [retireDialogOpen, setRetireDialogOpen] = useState(false)
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<'online' | 'offline' | null>(null)
  const utils = trpc.useUtils()
  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.getDataCenterDetail.useQuery({ dataCenterId }, { retry: 1 })
  const { data: opsEngineers = [] } = trpc.supplier.listOpsEngineers.useQuery({ dataCenterId })

  const invalidateAfterImport = () => {
    const supplierId = detail?.dataCenter.supplierId
    void utils.supplier.getDataCenterDetail.invalidate({ dataCenterId })
    void utils.supplier.listAllDataCenters.invalidate()
    void utils.supplier.getDataCenterStats.invalidate()
    void utils.supplier.listGpuInventory.invalidate()
    void utils.supplier.listPhysicalDevices.invalidate()
    void utils.supplier.getPhysicalDeviceStats.invalidate()
    void utils.supplier.onboardingBatch.list.invalidate()
    void utils.supplier.internalTestHold.list.invalidate()
    if (supplierId) {
      void utils.supplier.deviceImport.getContext.invalidate({ supplierId })
      void utils.supplier.listDataCenters.invalidate({ supplierId })
    }
  }

  const updateStatusMutation = trpc.supplier.updateDataCenterStatus.useMutation({
    onSuccess: (result) => {
      toast.success(
        `机房「${result.dataCenter.name}」已${result.dataCenter.status === 'online' ? '上线' : '下线'}`,
      )
      setStatusConfirmTarget(null)
      invalidateAfterImport()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleConfirmStatusChange = () => {
    if (!statusConfirmTarget) return
    updateStatusMutation.mutate({ dataCenterId, status: statusConfirmTarget })
  }

  const gpuInventory = detail?.gpuInventory ?? []
  const pagination = useListPagination(gpuInventory)

  const onlineRate = useMemo(() => {
    if (!detail) return 0
    const { totalGpu, onlineGpu } = detail.inventoryStats
    return totalGpu > 0 ? (onlineGpu / totalGpu) * 100 : 0
  }, [detail])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        加载机房详情...
      </div>
    )
  }

  if (isError || !detail) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/datacenters">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回机房管理
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{isError ? getErrorMessage(error) : '未找到该机房'}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { dataCenter, physicalDeviceStats, inventoryStats } = detail
  const gpuDeviceStats = physicalDeviceStats.gpu ?? { total: 0, online: 0, maintenance: 0 }
  const cpuDeviceStats = physicalDeviceStats.cpu ?? { total: 0, online: 0, maintenance: 0 }
  const opsStatusBreakdown =
    physicalDeviceStats.opsStatusBreakdown ?? DEFAULT_OPS_STATUS_BREAKDOWN
  const nextStatus: 'online' | 'offline' | null =
    dataCenter.status === 'online'
      ? 'offline'
      : dataCenter.status === 'offline' || dataCenter.status === 'maintenance'
        ? 'online'
        : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
        <Link href="/supplier/datacenters">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{dataCenter.name}</h1>
            <Badge variant="outline" className={dcStatusColors[dataCenter.status]}>
              {statusNames[dataCenter.status]}
            </Badge>
            {dataCenter.sourceDeleted && (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-400"
              >
                源系统已删除
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {dataCenter.address || dataCenter.location || '—'}
            </span>
            <span>
              编码:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                {dataCenter.code}
              </code>
            </span>
            <Link
              href={`/supplier/suppliers/${dataCenter.supplierId}?tab=datacenters`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {dataCenter.supplierName}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <Button variant="outline" className="gap-2" onClick={() => setEditDialogOpen(true)}>
            <Pencil className="h-4 w-4" />
            编辑信息
          </Button>
          {nextStatus && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setStatusConfirmTarget(nextStatus)}
            >
              <Power className="h-4 w-4" />
              {nextStatus === 'online' ? '设为在线' : '设为离线'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setOnboardingDialogOpen(true)}>
            设备上架 / 接入
          </Button>
          <Button onClick={() => setRetireDialogOpen(true)}>设备下架 / 裁撤</Button>
        </div>
      </div>

      <EditDatacenterDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        dataCenter={dataCenter}
        onUpdated={invalidateAfterImport}
      />

      <AlertDialog
        open={statusConfirmTarget !== null}
        onOpenChange={(open) => !open && setStatusConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusConfirmTarget === 'online' ? '确认设为在线？' : '确认设为离线？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusConfirmTarget === 'online'
                ? `将机房「${dataCenter.name}」切换为在线状态，该机房将恢复对外可用。`
                : `将机房「${dataCenter.name}」切换为离线状态，该机房将标记为不可用。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={updateStatusMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={updateStatusMutation.isPending}
              onClick={handleConfirmStatusChange}
            >
              {updateStatusMutation.isPending
                ? '处理中…'
                : statusConfirmTarget === 'online'
                  ? '确认上线'
                  : '确认下线'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DatacenterDeviceRetireDialog
        open={retireDialogOpen}
        onOpenChange={setRetireDialogOpen}
        dataCenterId={dataCenter.id}
        dataCenterName={dataCenter.name}
        onSuccess={invalidateAfterImport}
      />

      <DatacenterOnboardingDialog
        open={onboardingDialogOpen}
        onOpenChange={setOnboardingDialogOpen}
        supplierId={dataCenter.supplierId}
        supplierName={dataCenter.supplierName}
        dataCenterId={dataCenter.id}
        dataCenterName={dataCenter.name}
        onSuccess={invalidateAfterImport}
      />

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">运维工程师</CardTitle>
          <CardDescription>本机房运维工程师联系方式</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SupplierOpsEngineersList
            engineers={opsEngineers}
            emptyMessage="暂无运维工程师，可在机房列表「运维通讯录」中维护"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {inventoryStats.totalGpu.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">GPU 总量</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {inventoryStats.onlineGpu.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">在线 GPU</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xl font-semibold text-foreground">{onlineRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">在线率</p>
              </div>
              <Progress value={onlineRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {inventoryStats.cardTypeCount}
                </p>
                <p className="text-xs text-muted-foreground">卡型种类</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DeviceImportCards
        supplierId={dataCenter.supplierId}
        defaultDataCenterId={dataCenter.id}
        dataCenterName={dataCenter.name}
        lockDataCenter
        onSuccess={invalidateAfterImport}
        sectionTitle="运维数据导入"
        sectionDescription="在本机房下导入设备主数据、变更记录或故障记录，导入完成后将自动刷新库存与设备统计"
      />

      <DatacenterPlannedBatchesPanel dataCenterId={dataCenterId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">基本信息</CardTitle>
              <CardDescription>机房基础属性与平台映射</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="供应商">
              <Link
                href={`/supplier/suppliers/${dataCenter.supplierId}`}
                className="text-primary hover:underline"
              >
                {dataCenter.supplierName}
              </Link>
            </InfoRow>
            <InfoRow label="机房名称">{dataCenter.name}</InfoRow>
            <InfoRow label="机房编码">
              <code className="rounded bg-muted px-2 py-0.5">{dataCenter.code}</code>
            </InfoRow>
            <InfoRow label="区域">{dataCenter.location || '—'}</InfoRow>
            <InfoRow label="地址">{dataCenter.address || '—'}</InfoRow>
            <InfoRow label="运行状态">
              <Badge variant="outline" className={dcStatusColors[dataCenter.status]}>
                {statusNames[dataCenter.status]}
              </Badge>
            </InfoRow>
            <InfoRow label="区域标签">
              {dataCenter.regionTags && dataCenter.regionTags.length > 0
                ? dataCenter.regionTags.join('、')
                : '—'}
            </InfoRow>
            <InfoRow label="规模">{dataCenter.scale || '—'}</InfoRow>
            <InfoRow label="描述">{dataCenter.description || '—'}</InfoRow>
            <InfoRow label="创建时间">{formatDt(dataCenter.createdAt)}</InfoRow>
            <InfoRow label="更新时间">{formatDt(dataCenter.updatedAt)}</InfoRow>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">费用与网络</CardTitle>
            <CardDescription>配套费用、平台映射与审核信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="网络费用 (月)">
              ¥{dataCenter.networkFee.toLocaleString()}
            </InfoRow>
            <InfoRow label="管控节点费用 (月)">
              ¥{dataCenter.managementNodeFee.toLocaleString()}
            </InfoRow>
            <InfoRow label="公网 IP 数量">
              {dataCenter.publicIpCount ?? '—'}
            </InfoRow>
            <InfoRow label="内网网段">
              {dataCenter.internalNetworkCidr || '—'}
            </InfoRow>
            <InfoRow label="入驻系统 ID">
              {dataCenter.externalOnboardingId || '—'}
            </InfoRow>
            <InfoRow label="平台租户 ID">
              {dataCenter.platformTenantId || '—'}
            </InfoRow>
            <InfoRow label="容器实例区域">
              {dataCenter.containerInstanceRegion || '—'}
            </InfoRow>
            <InfoRow label="裸金属区域">
              {dataCenter.bareMetalRegion || '—'}
            </InfoRow>
            <InfoRow label="审核状态">
              {dataCenter.auditStatus || '—'}
            </InfoRow>
            <InfoRow label="审核备注">
              {dataCenter.auditRemark || '—'}
            </InfoRow>
          </CardContent>
        </Card>
      </div>

      <SupplierUnitCostsPanel
        supplier={{
          id: dataCenter.supplierId,
          name: dataCenter.supplierName,
          shortName: dataCenter.supplierName,
        }}
        dataCenter={{ id: dataCenter.id, name: dataCenter.name }}
      />
      <Card className="overflow-x-auto border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">聚合库存</CardTitle>
          <CardDescription>本机房各卡型 GPU 汇总（L1）</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">卡型</TableHead>
                <TableHead className="text-muted-foreground">数量</TableHead>
                <TableHead className="text-muted-foreground">在线</TableHead>
                <TableHead className="text-muted-foreground">在线率</TableHead>
                <TableHead className="text-muted-foreground">成本</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.totalItems === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    暂无聚合库存，请通过「运维数据导入」入库设备后自动汇总
                  </TableCell>
                </TableRow>
              ) : (
                pagination.items.map((device) => {
                  const deviceOnlineRate =
                    device.quantity > 0 ? (device.onlineQuantity / device.quantity) * 100 : 0
                  const cost =
                    device.cardTimeCostPerHour ?? device.revenueShareCostPerHour ?? 0
                  return (
                    <TableRow key={device.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{device.cardTypeName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{device.quantity}</TableCell>
                      <TableCell className="text-foreground">{device.onlineQuantity}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={deviceOnlineRate} className="h-2 w-16" />
                          <span className="text-sm text-foreground">
                            {deviceOnlineRate.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {cost > 0 ? `¥${cost.toFixed(0)}/小时` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={inventoryStatusColors[device.status]}>
                          {statusNames[device.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/supplier/inventory/${device.id}`}>
                            详情
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          {pagination.totalItems > 0 && (
            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
            />
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">物理机汇总</CardTitle>
          <CardDescription>本机房下的物理机台账统计</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">GPU 算力设备</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">设备台数</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {gpuDeviceStats.total.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">在线台数</p>
                  <p className="mt-1 text-2xl font-semibold text-green-500">
                    {gpuDeviceStats.online.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings2 className="h-4 w-4" />
                    维护中台数
                  </div>
                  <p className="mt-1 text-2xl font-semibold text-yellow-500">
                    {gpuDeviceStats.maintenance.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">CPU 设备台数</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {cpuDeviceStats.total.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">按设备状态汇总</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">设备状态</TableHead>
                      <TableHead className="text-right text-muted-foreground">台数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opsStatusBreakdown.map((item) => (
                      <TableRow key={item.opsStatus} className="border-border">
                        <TableCell className="text-foreground">{item.opsStatus}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-foreground">
                          {item.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-border bg-muted/20 font-medium">
                      <TableCell className="text-foreground">合计</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">
                        {physicalDeviceStats.total.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          {physicalDeviceStats.total > 0 && (
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/supplier/devices">
                  查看物理机列表
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
