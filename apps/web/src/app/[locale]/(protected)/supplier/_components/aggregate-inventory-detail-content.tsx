'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  Building2,
  ChevronRight,
  Cpu,
  Factory,
  FlaskConical,
  Layers,
  Server,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Progress } from '@workspace/ui/components/progress'
import type { DataCenterDevice, InventoryChangeLog } from '@/lib/data/types'
import { contractPricingModeNames } from '@/lib/data/types'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import {
  lifecycleToAggregateStatus,
  matchPhysicalDevicesToInventory,
} from '@/lib/supplier/inventory-device-bridge'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'

const statusNames: Record<string, string> = {
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
}

const deviceStatusColors: Record<string, string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const changeTypeLabels: Record<InventoryChangeLog['changeType'], string> = {
  status: '状态',
  quantity: '数量',
  internal_test: '测试',
  sync: '同步',
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

export function AggregateInventoryDetailContent({
  inventory,
  supplierName,
  cooperationMode,
  changeLogs,
}: {
  inventory: DataCenterDevice
  supplierName: string
  cooperationMode: 'card_time' | 'revenue_share'
  changeLogs: InventoryChangeLog[]
}) {
  const domainDevices = useSupplierDomainMockStore((s) => s.devices)

  const matchedDevices = useMemo(
    () => matchPhysicalDevicesToInventory(inventory, domainDevices),
    [inventory, domainDevices],
  )

  const onlineRate =
    inventory.quantity > 0 ? (inventory.onlineQuantity / inventory.quantity) * 100 : 0
  const cost =
    inventory.cardTimeCostPerHour ?? inventory.revenueShareCostPerHour ?? 0
  const costMode = inventory.cardTimeCostPerHour != null ? '卡时成本' : '分成成本'

  const detailStats = useMemo(() => {
    const online = matchedDevices.filter((d) => d.lifecycle_status === '在线').length
    const onboarding = matchedDevices.filter((d) => d.lifecycle_status === '接入中').length
    const maintenance = matchedDevices.filter((d) => d.lifecycle_status === '维护中').length
    return { online, onboarding, maintenance, mapped: matchedDevices.length }
  }, [matchedDevices])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/supplier/devices">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground">{inventory.cardTypeName}</h1>
            <Badge variant="outline" className={deviceStatusColors[inventory.status]}>
              {statusNames[inventory.status]}
            </Badge>
            {inventory.isInternalTest && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                <FlaskConical className="w-3 h-3 mr-1" />
                内部测试中
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            {inventory.dataCenterName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">设备总量</p>
            <p className="text-2xl font-semibold mt-1">{inventory.quantity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">在线数量</p>
            <p className="text-2xl font-semibold mt-1">{inventory.onlineQuantity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已映射物理机</p>
            <p className="text-2xl font-semibold mt-1">{detailStats.mapped}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{costMode}</p>
            <p className="text-2xl font-semibold mt-1">¥{cost.toFixed(0)}/小时</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="details">
            聚合明细 ({matchedDevices.length})
          </TabsTrigger>
          <TabsTrigger value="changes">变更记录 ({changeLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">库存标识</CardTitle>
                <CardDescription>L1 聚合层 · 机房 × 卡型</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="库存 ID" value={<code>{inventory.id}</code>} />
                <InfoRow
                  label="供应商"
                  value={
                    <Link
                      href={`/supplier/suppliers/${inventory.supplierId}`}
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Factory className="w-3.5 h-3.5" />
                      {supplierName}
                    </Link>
                  }
                />
                <InfoRow label="合作模式" value={contractPricingModeNames[cooperationMode]} />
                <InfoRow label="机房 ID" value={inventory.dataCenterId} />
                <InfoRow label="卡型 ID" value={inventory.cardTypeId} />
                <InfoRow label="最近更新" value={formatDt(inventory.updatedAt)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">运行与测试</CardTitle>
                <CardDescription>聚合层运行指标</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">在线率</span>
                    <span className="font-medium">
                      {inventory.onlineQuantity}/{inventory.quantity} ({onlineRate.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={onlineRate} className="h-2" />
                </div>
                <div className="pt-4 border-t border-border space-y-3 text-sm">
                  <InfoRow
                    label="内部测试"
                    value={inventory.isInternalTest ? '已开启' : '未开启'}
                  />
                  {inventory.isInternalTest && (
                    <>
                      <InfoRow label="占用范围" value={inventory.internalTestScope ?? '全部'} />
                      <InfoRow label="计划结束" value={formatDt(inventory.internalTestUntil)} />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {matchedDevices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  L2 物理机状态分布
                </CardTitle>
                <CardDescription>已映射到该聚合行的物理机生命周期统计</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-md border border-border">
                  <p className="text-2xl font-semibold text-green-500">{detailStats.online}</p>
                  <p className="text-xs text-muted-foreground">在线</p>
                </div>
                <div className="p-3 rounded-md border border-border">
                  <p className="text-2xl font-semibold text-blue-500">{detailStats.onboarding}</p>
                  <p className="text-xs text-muted-foreground">接入中</p>
                </div>
                <div className="p-3 rounded-md border border-border">
                  <p className="text-2xl font-semibold text-yellow-500">{detailStats.maintenance}</p>
                  <p className="text-xs text-muted-foreground">维护中</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                物理机聚合明细
              </CardTitle>
              <CardDescription>
                按供应商、机房、卡型映射的 L2 物理机列表；未入库的差额在 L1 总量中体现
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {matchedDevices.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm space-y-2">
                  <p>暂无已映射的物理机明细</p>
                  <p className="text-xs">
                    聚合总量 {inventory.quantity} 台，可通过「设备上架」批次继续入库
                  </p>
                  <Link href="/supplier/online-tasks">
                    <Button variant="outline" size="sm" className="mt-2">
                      前往设备上架
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SN / 资产号</TableHead>
                      <TableHead>生命周期</TableHead>
                      <TableHead>子阶段</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>映射状态</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedDevices.map((device) => {
                      const mappedStatus = lifecycleToAggregateStatus(device.lifecycle_status)
                      return (
                        <TableRow key={device.id}>
                          <TableCell>
                            <div className="font-mono text-sm">{device.sn}</div>
                            <div className="text-xs text-muted-foreground">{device.asset_no}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={LIFECYCLE_STATUS_COLORS[device.lifecycle_status] ?? ''}
                            >
                              {device.lifecycle_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {device.onboarding_substage}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {device.external_ip}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              → {statusNames[mappedStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Link href={`/supplier/devices/machines/${device.id}`}>
                              <Button variant="ghost" size="sm" className="gap-1">
                                详情
                                <ChevronRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {matchedDevices.length > 0 && inventory.quantity > matchedDevices.length && (
                <div className="p-4 border-t border-border text-xs text-muted-foreground">
                  注：L1 总量 {inventory.quantity} 台，已映射 L2 物理机 {matchedDevices.length} 台，
                  差额 {inventory.quantity - matchedDevices.length} 台可能尚未入库或处于异步同步窗口
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                库存变更记录
              </CardTitle>
              <CardDescription>聚合层数量、状态、测试占用与同步事件（Mock）</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {changeLogs.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">暂无变更记录</p>
              ) : (
                <ul className="divide-y divide-border">
                  {changeLogs.map((log) => (
                    <li key={log.id} className="p-4 flex gap-4">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Cpu className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{log.summary}</span>
                          <Badge variant="outline" className="text-xs">
                            {changeTypeLabels[log.changeType]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {log.fromValue} → {log.toValue}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {log.operatorName} · {log.reasonCode} · {formatDt(log.occurredAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  )
}
