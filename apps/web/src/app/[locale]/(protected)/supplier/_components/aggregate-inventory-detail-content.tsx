'use client'

import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FlaskConical,
  Loader2,
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
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'
import type { DataCenterDevice, PhysicalDevice } from '@/lib/data/types'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'
import { trpc } from '@/lib/trpc/client'

const statusNames: Record<DataCenterDevice['status'], string> = {
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
}

const deviceStatusColors: Record<DataCenterDevice['status'], string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

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

function formatDeviceIp(device: PhysicalDevice): string {
  if (device.internalIp && device.externalIp) {
    return `${device.internalIp} / ${device.externalIp}`
  }
  return device.internalIp ?? device.externalIp ?? '—'
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm text-foreground sm:text-right">{children}</div>
    </div>
  )
}

export function AggregateInventoryDetailContent({ inventoryId }: { inventoryId: string }) {
  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.getGpuInventoryDetail.useQuery({ inventoryId }, { retry: 1 })

  const physicalDevices = detail?.physicalDevices ?? []
  const pagination = useListPagination(physicalDevices)

  const onlineRate = useMemo(() => {
    if (!detail) return 0
    const { quantity, onlineQuantity } = detail.inventory
    return quantity > 0 ? (onlineQuantity / quantity) * 100 : 0
  }, [detail])

  const cost = useMemo(() => {
    if (!detail) return 0
    const { inventory } = detail
    return inventory.cardTimeCostPerHour ?? inventory.revenueShareCostPerHour ?? 0
  }, [detail])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载库存详情...
      </div>
    )
  }

  if (isError || !detail) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/inventory">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回设备库存
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{isError ? getErrorMessage(error) : '未找到该聚合库存'}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { inventory, physicalDeviceStats } = detail

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/supplier/inventory">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground">
              {inventory.dataCenterName}
            </h1>
            <span className="text-muted-foreground">·</span>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-semibold text-foreground">{inventory.cardTypeName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Badge variant="outline" className={deviceStatusColors[inventory.status]}>
              {statusNames[inventory.status]}
            </Badge>
            {inventory.isInternalTest && (
              <Badge
                variant="outline"
                className="bg-purple-500/10 text-purple-400 border-purple-500/30"
              >
                内部测试中
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              机房×卡型聚合库存（L1）
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {inventory.quantity.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">GPU 总量</p>
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
                <p className="text-2xl font-semibold text-foreground">
                  {inventory.onlineQuantity.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">在线 GPU</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
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
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {cost > 0 ? `¥${cost.toFixed(0)}/小时` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">参考成本</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
            <CardDescription>聚合维度：供应商 + 机房 + 卡型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="供应商">
              <Link
                href={`/supplier/suppliers/${inventory.supplierId}`}
                className="text-primary hover:underline"
              >
                {inventory.supplierShortName ?? inventory.supplierId}
              </Link>
            </InfoRow>
            <InfoRow label="机房">{inventory.dataCenterName}</InfoRow>
            <InfoRow label="卡型">{inventory.cardTypeName}</InfoRow>
            <InfoRow label="运行状态">
              <Badge variant="outline" className={deviceStatusColors[inventory.status]}>
                {statusNames[inventory.status]}
              </Badge>
            </InfoRow>
            <InfoRow label="最后同步">{formatDt(inventory.lastSyncedAt)}</InfoRow>
            <InfoRow label="更新时间">{formatDt(inventory.updatedAt)}</InfoRow>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">物理机汇总（L2）</CardTitle>
            <CardDescription>由物理机台账按同维度汇总刷新</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="物理机台数">{physicalDeviceStats.total}</InfoRow>
            <InfoRow label="在线台数">{physicalDeviceStats.online}</InfoRow>
            <InfoRow label="维护中台数">{physicalDeviceStats.maintenance}</InfoRow>
            <InfoRow label="汇总 GPU">
              {inventory.quantity} 总量 / {inventory.onlineQuantity} 在线
            </InfoRow>
            {inventory.isInternalTest && (
              <>
                <div className="border-t border-border pt-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FlaskConical className="w-4 h-4 text-purple-400" />
                    内部测试
                  </div>
                  <InfoRow label="占用范围">
                    {inventory.internalTestScope ?? '—'}
                  </InfoRow>
                  <InfoRow label="计划结束">
                    {formatDt(inventory.internalTestUntil)}
                  </InfoRow>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border overflow-x-auto">
        <CardHeader>
          <CardTitle className="text-base">物理机明细</CardTitle>
          <CardDescription>
            本聚合库存下的物理机台账，点击可查看单机详情
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">SN / 资产号</TableHead>
                <TableHead className="text-muted-foreground">GPU</TableHead>
                <TableHead className="text-muted-foreground">生命周期</TableHead>
                <TableHead className="text-muted-foreground">运营状态</TableHead>
                <TableHead className="text-muted-foreground">IP 地址</TableHead>
                <TableHead className="text-muted-foreground">维修中</TableHead>
                <TableHead className="text-muted-foreground">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.totalItems === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    暂无关联物理机，请通过「运维数据导入」入库后自动汇总
                  </TableCell>
                </TableRow>
              ) : (
                pagination.items.map((device) => (
                  <TableRow key={device.id} className="border-border">
                    <TableCell>
                      <div className="font-mono text-sm text-foreground">{device.sn}</div>
                      <div className="text-xs text-muted-foreground">{device.assetNo}</div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {device.gpuCount} × {device.cardTypeName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={LIFECYCLE_STATUS_COLORS[device.lifecycleStatus] ?? ''}
                      >
                        {device.lifecycleStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">{device.opsStatus ?? '—'}</TableCell>
                    <TableCell className="text-sm text-foreground">{formatDeviceIp(device)}</TableCell>
                    <TableCell>
                      {device.inMaintenance ? (
                        <Badge
                          variant="outline"
                          className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                        >
                          是
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/supplier/devices/${device.id}`}>
                          详情
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </Button>
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
