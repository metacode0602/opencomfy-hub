'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Factory,
  FlaskConical,
  Layers,
  Loader2,
  Server,
  TrendingUp,
  Upload,
  Wrench,
} from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { cn } from '@workspace/ui/lib/utils'
import type {
  OverviewFiltersInput,
  OverviewKpiMetric,
  OverviewKpisDto,
} from '@/lib/types/supplier-overview-api'
import { trpc } from '@/lib/trpc/client'
import { IMPORT_STATUS_LABELS } from '@/lib/supplier/onboarding-batch-utils'

const statusColors: Record<string, string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const severityColors: Record<string, string> = {
  P1: 'bg-red-500/20 text-red-400 border-red-500/30',
  P2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  P3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  P4: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const emptyMetric: OverviewKpiMetric = { deviceCount: 0, gpuCount: 0 }

function normalizeOverviewKpis(kpis: Partial<OverviewKpisDto> | undefined): OverviewKpisDto {
  return {
    total: kpis?.total ?? emptyMetric,
    online: kpis?.online ?? emptyMetric,
    pendingAccess: kpis?.pendingAccess ?? emptyMetric,
    onboarding: kpis?.onboarding ?? emptyMetric,
    maintenance: kpis?.maintenance ?? emptyMetric,
    sellable: kpis?.sellable ?? emptyMetric,
    retiring: kpis?.retiring,
    nonSchedulable: kpis?.nonSchedulable ?? emptyMetric,
    inMaintenance: kpis?.inMaintenance ?? emptyMetric,
    reservedIdle: kpis?.reservedIdle ?? emptyMetric,
    internalTestGpu: kpis?.internalTestGpu ?? 0,
    faultOpenCount: kpis?.faultOpenCount ?? 0,
    activeTestHolds: kpis?.activeTestHolds ?? 0,
    activeBatches: kpis?.activeBatches ?? 0,
    sellableRate: kpis?.sellableRate ?? 0,
  }
}

function KpiCard({
  title,
  metric,
  icon: Icon,
  hint,
  warn,
  accent,
}: {
  title: string
  metric: OverviewKpiMetric
  icon: React.ComponentType<{ className?: string }>
  hint?: string
  warn?: boolean
  accent?: 'primary' | 'green' | 'yellow' | 'purple' | 'destructive'
}) {
  const accentMap = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    purple: 'bg-purple-500/10 text-purple-500',
    destructive: 'bg-destructive/10 text-destructive',
  }

  return (
    <Card className={cn('border-border/80', warn && 'border-chart-4/40')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg',
              accentMap[accent ?? 'primary'],
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-muted-foreground">{title}</p>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              <span className={cn(warn && 'text-chart-4')}>
                {metric.gpuCount.toLocaleString()} 卡
              </span>
              <span className="mx-1 text-sm font-normal text-muted-foreground">·</span>
              <span className="text-sm font-medium text-muted-foreground">
                {metric.deviceCount.toLocaleString()} 台
              </span>
            </div>
            {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SupplierOverviewContent() {
  const [filters, setFilters] = useState<OverviewFiltersInput>({
    region: 'all',
    supplierId: 'all',
    cardType: 'all',
    poolCode: 'all',
  })

  const { data: filterOptions } = trpc.supplier.overview.getFilterOptions.useQuery()
  const {
    data: stats,
    isLoading,
    isError,
    error,
  } = trpc.supplier.overview.getStats.useQuery(filters)

  const kpis = normalizeOverviewKpis(stats?.kpis)
  const supplierRows = stats?.supplierRows ?? []
  const inventoryRows = stats?.inventoryRows ?? []
  const funnel = stats?.lifecycleFunnel ?? []
  const batchSummaries = stats?.batchSummaries ?? []
  const faultSla = stats?.faultSla ?? {
    openCount: 0,
    p1Count: 0,
    p2Count: 0,
    avgResolutionHours: null,
    recentOpen: [],
  }

  const sellableRate = kpis.sellableRate

  const suppliers = filterOptions?.suppliers ?? []
  const regions = filterOptions?.regions ?? []
  const cardTypes = filterOptions?.cardTypes ?? []
  const poolCodes = filterOptions?.poolCodes ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">资源总览</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            供应商算力资源大盘 · 总量 / 在线 / 待接入 / 接入中 / 维护 / 可售
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.region}
            onValueChange={(v) => setFilters((f) => ({ ...f, region: v }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="区域" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部区域</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.supplierId}
            onValueChange={(v) => setFilters((f) => ({ ...f, supplierId: v }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="供应商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部供应商</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.shortName ?? s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.cardType}
            onValueChange={(v) => setFilters((f) => ({ ...f, cardType: v }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="卡型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部卡型</SelectItem>
              {cardTypes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.poolCode}
            onValueChange={(v) => setFilters((f) => ({ ...f, poolCode: v }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="资源池" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部资源池</SelectItem>
              {poolCodes.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-sm text-destructive">
            加载资源总览失败：{error?.message ?? '未知错误'}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>正在聚合资源数据…</span>
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
          (isLoading || isError) && 'pointer-events-none opacity-50',
        )}
      >
        <KpiCard title="GPU 总量" metric={kpis.total} icon={Cpu} accent="primary" />
        <KpiCard title="在线" metric={kpis.online} icon={CheckCircle2} accent="green" />
        <KpiCard
          title="可售"
          metric={kpis.sellable}
          icon={TrendingUp}
          accent="green"
          hint={`可售率 ${sellableRate}%`}
        />
        <KpiCard title="不可调度" metric={kpis.nonSchedulable} icon={Server} accent="purple" />
        <KpiCard title="维修中" metric={kpis.inMaintenance} icon={Wrench} accent="yellow" />
        <KpiCard title="预留闲置" metric={kpis.reservedIdle} icon={FlaskConical} accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="border-border/80 lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">物理机生命周期漏斗</CardTitle>
            <CardDescription>L2 物理设备按 lifecycle_status 分布</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {funnel.map((row, idx) => (
              <div key={row.stage}>
                {idx > 0 && (
                  <div className="flex justify-center py-0.5 text-muted-foreground">
                    <ArrowDown className="size-3" />
                  </div>
                )}
                <div
                  className={cn(
                    'flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2',
                    row.warn && 'border-chart-4/40 bg-chart-4/5',
                  )}
                >
                  <span className="text-sm font-medium">{row.stage}</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {row.gpuCount} 卡 · {row.deviceCount} 台
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/supplier/online-tasks">
                  <Upload className="mr-1.5 size-3.5" />
                  接入工作台
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/supplier/devices">
                  物理机台账
                  <ChevronRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">供应商维度汇总</CardTitle>
              <CardDescription>点击行下钻至供应商 Hub</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/supplier/suppliers">
                全部供应商
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>供应商</TableHead>
                  <TableHead className="text-right">机房</TableHead>
                  <TableHead className="text-right">总量</TableHead>
                  <TableHead className="text-right">在线</TableHead>
                  <TableHead className="text-right">可售</TableHead>
                  <TableHead className="text-right">批次</TableHead>
                  <TableHead className="text-right">故障</TableHead>
                  <TableHead className="text-right">维护中</TableHead>
                  <TableHead className="text-right">待接入</TableHead>
                  <TableHead className="text-right">接入中</TableHead>
                  <TableHead className="text-right">下线中</TableHead>
                  <TableHead className="text-right">内部占用</TableHead>
                  <TableHead className="text-right">线下交付</TableHead>
                  <TableHead className="text-right">裸金属池</TableHead>
                  <TableHead className="text-right">弹性池</TableHead>
                  <TableHead className="text-right">双池</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierRows.map((row) => (
                  <TableRow key={row.supplierId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Factory className="size-3.5 text-muted-foreground" />
                        {row.supplierName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.regionCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.totalGpu.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.onlineGpu.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {row.sellableGpu.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.activeBatches > 0 ? (
                        <Badge variant="outline" className="border-chart-4/40 text-chart-4">
                          {row.activeBatches}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.openFaults > 0 ? (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          {row.openFaults}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.maintenanceGpu.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.pendingAccessGpu > 0 ? (
                        <Badge variant="outline" className="border-chart-4/40 text-chart-4">
                          {row.pendingAccessGpu}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.onboardingGpu > 0 ? (
                        <Badge variant="outline" className="border-chart-4/40 text-chart-4">
                          {row.onboardingGpu}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.retiringGpu > 0 ? (
                        <Badge variant="outline" className="border-muted-foreground/40">
                          {row.retiringGpu}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.internalTestGpu.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.offlineDeliveryGpu > 0 ? row.offlineDeliveryGpu.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.bareMetalPoolGpu > 0 ? row.bareMetalPoolGpu.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.elasticServiceGpu > 0 ? row.elasticServiceGpu.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.dualPoolGpu > 0 ? row.dualPoolGpu.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="size-8" asChild>
                        <Link href={`/supplier/suppliers/${row.supplierId}`}>
                          <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">机房 × 卡型库存（L1 聚合）</CardTitle>
            <CardDescription>
              sellable = online − 内部测试 − 故障不可用 · 点击行下钻设备页
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/supplier/devices">
              设备管理
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供应商</TableHead>
                <TableHead>机房</TableHead>
                <TableHead>区域</TableHead>
                <TableHead>卡型</TableHead>
                <TableHead className="text-right">总量</TableHead>
                <TableHead className="text-right">在线</TableHead>
                <TableHead className="text-right">维护</TableHead>
                <TableHead className="text-right">内部占用</TableHead>
                <TableHead className="text-right">可售</TableHead>
                <TableHead className="text-right">裸金属池</TableHead>
                <TableHead className="text-right">弹性池</TableHead>
                <TableHead className="text-right">双池</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{row.supplierName}</TableCell>
                  <TableCell className="text-sm">{row.dataCenterName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.region}</TableCell>
                  <TableCell className="text-sm">{row.cardTypeName}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.onlineQuantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.maintenanceQuantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.internalTestGpu > 0 ? row.internalTestGpu : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                    {row.sellableQuantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.bareMetalPoolGpu > 0 ? row.bareMetalPoolGpu : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.elasticServiceGpu > 0 ? row.elasticServiceGpu : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.dualPoolGpu > 0 ? row.dualPoolGpu : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[row.status]}>
                      {row.status === 'online'
                        ? '在线'
                        : row.status === 'maintenance'
                          ? '维护中'
                          : '离线'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <Link
                        href={`/supplier/inventory/${row.id}?supplier=${row.supplierId}&status=${row.status}`}
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {inventoryRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                    当前筛选条件下无库存数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">活跃接入批次</CardTitle>
              <CardDescription>接入中 / 待开始批次，催办上架进度</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/supplier/online-tasks">批次列表</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {batchSummaries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无活跃接入批次</p>
            ) : (
              <div className="space-y-3">
                {batchSummaries.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{batch.batchCode}</span>
                        <Badge variant="outline" className="text-xs">
                          {batch.batchKind === 'online' ? '设备上架' : '订单接入'}
                        </Badge>
                        <Badge variant="outline">{batch.batchStatus}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {batch.supplierName} · {batch.dataCenterName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.workOrderNo ? `工单 ${batch.workOrderNo} · ` : ''}
                        导入 {IMPORT_STATUS_LABELS[batch.importStatus] ?? batch.importStatus} · 接收{' '}
                        {batch.touchedDeviceCount}/{batch.plannedDeviceCount} · 在线{' '}
                        {batch.onlineDeviceCount} · 计划就绪 {formatDt(batch.plannedReadyAt)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={
                          batch.batchKind === 'online'
                            ? `/supplier/online-tasks/${batch.id}`
                            : `/supplier/order-access/${batch.id}`
                        }
                      >
                        查看
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">故障 SLA 概览</CardTitle>
              <CardDescription>
                未关闭 {faultSla.openCount} · P1 {faultSla.p1Count} · P2 {faultSla.p2Count}
                {faultSla.avgResolutionHours != null &&
                  ` · 平均关闭 ${faultSla.avgResolutionHours.toFixed(1)}h`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/supplier/fault-incidents">故障中心</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {faultSla.recentOpen.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-500/60" />
                <p className="text-sm">当前无未关闭故障</p>
              </div>
            ) : (
              <div className="space-y-3">
                {faultSla.recentOpen.map((fault) => (
                  <div
                    key={fault.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={severityColors[fault.severity]}>
                            {fault.severity}
                          </Badge>
                          <span className="truncate text-sm font-medium">{fault.faultType}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fault.incidentStatus} · 开启于 {formatDt(fault.openedAt)}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/supplier/fault-incidents">处理</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/supplier/test-holds">
                  <FlaskConical className="mr-1.5 size-3.5" />
                  内部占用台账
                </Link>
              </Button>
              {poolCodes.length > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/supplier/devices">
                    <Layers className="mr-1.5 size-3.5" />
                    资源池绑定
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-muted/10">
        <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Server className="size-4" />
            <span>
              可售量公式：<code className="text-xs">online − internal_test − fault_down − other_dept</code>
            </span>
          </div>
          <span className="hidden sm:inline">·</span>
          <span>
            裸金属池占用：直连/单机上架中、线下交付及已绑定裸金属池设备；弹性用量池：platform/elastic
            及网关代理裸金属；双池主要为代理裸金属，两列之和减去双池不等于独占 GPU 总数
          </span>
          <span className="hidden sm:inline">·</span>
          <span>KPI 与漏斗均展示 GPU 卡数与设备台数；lifecycle 按待接入 / 接入中 / 在线 / 维护中 / 下线中 五段统计</span>
        </CardContent>
      </Card>
    </div>
  )
}
