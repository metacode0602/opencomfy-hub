'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { onlineReasonLabel } from '@/lib/supplier-ops/ui-meta'
import type { SupplierOpsBatchKind } from '@/lib/types/supplier-ops-batch'
import { getDeviceRetireReasonLabel, type DeviceRetireReason } from '@/lib/types/device-retire'
import { DEVICE_RETIRE_IMPORT_STATUS_LABELS } from '@/lib/types/device-retire'
import { trpc } from '@/lib/trpc/client'
import {
  BATCH_KIND_BADGE,
  IMPORT_STATUS_LABELS,
  onboardingBatchDetailPath,
  type PlannedBatchKind,
  type PlannedBatchKindFilter,
} from '@/lib/supplier/onboarding-batch-utils'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'
import { OnboardingBatchWizardDialog } from './onboarding-batch-wizard-dialog'
import { InternalOccupancyBatchCreateDialog } from './internal-occupancy-batch-create-dialog'
import type { OnboardingBatchRow } from '@workspace/db/schema'

const TERMINAL_BATCH_STATUSES = ['已完成', '已取消', 'cancelled'] as const

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  none: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  parsed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  committed: 'bg-green-500/20 text-green-400 border-green-500/30',
  parse_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  committing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function formatDt(value: Date | string | null | undefined) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPlanSummary(
  lines: Array<{ gpuCardTypeCode?: string; gpu_card_type_code?: string; plannedQuantity?: number; planned_quantity?: number }> | null | undefined,
) {
  if (!lines?.length) return '—'
  return lines
    .map((l) => {
      const code = l.gpuCardTypeCode ?? l.gpu_card_type_code ?? '—'
      const qty = l.plannedQuantity ?? l.planned_quantity ?? 0
      return `${code}×${qty}`
    })
    .join('、')
}

function countParsedErrors(parsedRowsJson: unknown): number {
  const rows = parsedRowsJson as Array<{ parse_status?: string }> | null
  if (!Array.isArray(rows)) return 0
  return rows.filter((r) => r.parse_status === 'error').length
}

function parseBatchKindFilter(raw: string | null, fixed?: PlannedBatchKind): PlannedBatchKindFilter {
  if (fixed) return fixed
  if (raw === 'online' || raw === 'order_access' || raw === 'device_retire' || raw === 'internal_occupancy' || raw === 'all') {
    return raw
  }
  return 'all'
}

function importStatusLabel(batch: OnboardingBatchRow): string {
  if (batch.batchKind === 'device_retire') {
    return DEVICE_RETIRE_IMPORT_STATUS_LABELS[batch.importStatus] ?? batch.importStatus
  }
  return IMPORT_STATUS_LABELS[batch.importStatus] ?? batch.importStatus
}

function extraInfoLabel(batch: OnboardingBatchRow): string {
  if (batch.batchKind === 'online') return onlineReasonLabel(batch.onlineReason)
  if (batch.batchKind === 'order_access') return batch.orderNo ?? '—'
  if (batch.batchKind === 'device_retire' && batch.retireReason) {
    return getDeviceRetireReasonLabel(batch.retireReason as DeviceRetireReason)
  }
  if (batch.batchKind === 'internal_occupancy') {
    return batch.remark?.trim() || '内部占用计划'
  }
  return '—'
}

function isInProgress(batch: OnboardingBatchRow): boolean {
  return !(TERMINAL_BATCH_STATUSES as readonly string[]).includes(batch.batchStatus)
}

export function PlannedBatchesContent({
  fixedBatchKind,
  showLegacyHint = false,
}: {
  fixedBatchKind?: PlannedBatchKind
  showLegacyHint?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const utils = trpc.useUtils()

  const [kindFilter, setKindFilter] = useState<PlannedBatchKindFilter>(() =>
    parseBatchKindFilter(searchParams.get('batchKind'), fixedBatchKind),
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [importFilter, setImportFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [internalOccupancyOpen, setInternalOccupancyOpen] = useState(false)
  const [wizardRouteKind, setWizardRouteKind] = useState<
    Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>
  >('online-tasks')

  const syncUrl = useCallback(
    (kind: PlannedBatchKindFilter) => {
      if (fixedBatchKind) return
      const params = new URLSearchParams(searchParams.toString())
      if (kind === 'all') {
        params.delete('batchKind')
      } else {
        params.set('batchKind', kind)
      }
      const q = params.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [fixedBatchKind, pathname, router, searchParams],
  )

  useEffect(() => {
    if (fixedBatchKind) return
    const fromUrl = parseBatchKindFilter(searchParams.get('batchKind'))
    setKindFilter(fromUrl)
  }, [searchParams, fixedBatchKind])

  const handleKindChange = (value: PlannedBatchKindFilter) => {
    setKindFilter(value)
    syncUrl(value)
  }

  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, {
    enabled: kindFilter === 'device_retire' || kindFilter === 'all',
  })

  const { data, isLoading, isError } = trpc.supplier.onboardingBatch.list.useQuery({
    batchKind: kindFilter,
    search: search.trim() || undefined,
    batchStatus: statusFilter,
    importStatus: importFilter,
    supplierId: supplierFilter === 'all' ? undefined : supplierFilter,
  })

  const commitListMutation = trpc.supplier.onboardingBatch.commitList.useMutation({
    onSuccess: (result) => {
      toast.success(`已入库 ${result.committedCount} 台设备`)
      void utils.supplier.onboardingBatch.list.invalidate()
      invalidateGlobalDashboard(utils)
    },
    onError: (e) => toast.error(e.message),
  })

  const batches = data?.items ?? []

  const stats = useMemo(() => {
    if (kindFilter === 'device_retire') {
      return {
        mode: 'retire' as const,
        total: batches.length,
        committed: batches.filter((b) => b.importStatus === 'committed').length,
        retiredDevices: batches.reduce((sum, b) => sum + (b.retiredDeviceCount ?? 0), 0),
        errors: batches.reduce((sum, b) => sum + countParsedErrors(b.parsedRowsJson), 0),
      }
    }
    if (kindFilter === 'online' || kindFilter === 'order_access') {
      return {
        mode: 'onboard' as const,
        total: batches.length,
        onboarding: batches.filter((b) => b.batchStatus === '接入中').length,
        committed: batches.filter((b) => b.importStatus === 'committed').length,
        pendingParse: batches.filter((b) => b.importStatus === 'parsed').length,
      }
    }
    return {
      mode: 'all' as const,
      total: batches.length,
      inProgress: batches.filter(isInProgress).length,
      plannedDevices: batches.reduce((sum, b) => sum + (b.plannedDeviceCount ?? 0), 0),
      touchedDevices: batches.reduce((sum, b) => sum + (b.touchedDeviceCount ?? 0), 0),
    }
  }, [batches, kindFilter])

  const showTypeColumn = kindFilter === 'all'
  const showSupplierFilter = kindFilter === 'device_retire' || kindFilter === 'all'

  const openWizard = (routeKind: Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>) => {
    setWizardRouteKind(routeKind)
    setWizardOpen(true)
  }

  return (
    <div className="space-y-6">
      {showLegacyHint && (
        <Alert>
          <AlertDescription className="text-sm">
            此地址仍可直接访问。推荐从侧栏「计划批次」进入统一列表。
            <Link href="/supplier/online-tasks" className="text-primary hover:underline ml-1">
              前往计划批次
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">计划批次</h1>
          <p className="text-sm text-muted-foreground mt-1">
            集中查看上架、订单接入、下架与内部占用计划；进度由批次进度事件时间轴驱动。
          </p>
        </div>
        {!fixedBatchKind && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setInternalOccupancyOpen(true)}>
              新建内部占用
            </Button>
          </div>
        )}
      </div>

      {stats.mode === 'all' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">批次总数</p>
              <p className="text-2xl font-semibold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">进行中</p>
              <p className="text-2xl font-semibold mt-1">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">计划台数合计</p>
              <p className="text-2xl font-semibold mt-1">{stats.plannedDevices}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">已触达台数合计</p>
              <p className="text-2xl font-semibold mt-1">{stats.touchedDevices}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats.mode === 'onboard' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">批次总数</p>
              <p className="text-2xl font-semibold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">接入中</p>
              <p className="text-2xl font-semibold mt-1">{stats.onboarding}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">已入库</p>
              <p className="text-2xl font-semibold mt-1">{stats.committed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">待确认入库</p>
              <p className="text-2xl font-semibold mt-1">{stats.pendingParse}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats.mode === 'retire' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">批次总数</p>
              <p className="text-2xl font-semibold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">已下架批次</p>
              <p className="text-2xl font-semibold mt-1">{stats.committed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">累计下架设备</p>
              <p className="text-2xl font-semibold mt-1">{stats.retiredDevices}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">累计错误行</p>
              <p className="text-2xl font-semibold mt-1">{stats.errors}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索批次号、供应商、机房、工单..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!fixedBatchKind && (
            <Select value={kindFilter} onValueChange={(v) => handleKindChange(v as PlannedBatchKindFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="online">设备上架</SelectItem>
                <SelectItem value="order_access">订单接入</SelectItem>
                <SelectItem value="device_retire">设备下架</SelectItem>
                <SelectItem value="internal_occupancy">内部占用</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="批次状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="待开始">待开始</SelectItem>
              <SelectItem value="接入中">接入中</SelectItem>
              <SelectItem value="占用中">占用中</SelectItem>
              <SelectItem value="下架中">下架中</SelectItem>
              <SelectItem value="已完成">已完成</SelectItem>
              <SelectItem value="已取消">已取消</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={importFilter} onValueChange={setImportFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="导入状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部导入</SelectItem>
              <SelectItem value="none">未上传清单</SelectItem>
              <SelectItem value="parsed">待确认</SelectItem>
              <SelectItem value="committed">已入库/已下架</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="parse_failed">解析失败</SelectItem>
            </SelectContent>
          </Select>
          {showSupplierFilter && (
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="供应商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部供应商</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>批次号</TableHead>
              {showTypeColumn && <TableHead>类型</TableHead>}
              <TableHead>供应商 / 机房</TableHead>
              <TableHead>计划</TableHead>
              <TableHead>进度</TableHead>
              <TableHead>导入状态</TableHead>
              <TableHead>批次状态</TableHead>
              <TableHead>补充信息</TableHead>
              <TableHead>工单号</TableHead>
              <TableHead>时间</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={showTypeColumn ? 11 : 10} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={showTypeColumn ? 11 : 10} className="text-center text-destructive py-12">
                  加载失败，请稍后重试
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showTypeColumn ? 11 : 10} className="text-center text-muted-foreground py-12">
                  暂无批次
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => {
                const kind = b.batchKind as PlannedBatchKind
                const badge = BATCH_KIND_BADGE[kind]
                const isOnboard = kind === 'online' || kind === 'order_access'
                const isInternalOccupancy = kind === 'internal_occupancy'
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={onboardingBatchDetailPath(b)}
                        className="text-primary hover:underline"
                      >
                        {b.batchCode}
                      </Link>
                    </TableCell>
                    {showTypeColumn && badge && (
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div>{b.supplierShortName ?? b.supplierName}</div>
                      <div className="text-xs text-muted-foreground">
                        <Link
                          href={`/supplier/datacenters/${b.dataCenterId}`}
                          className="text-primary hover:underline"
                        >
                          {b.idcCode} · {b.dataCenterName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {b.plannedDeviceCount ?? 0} 台
                      {kind !== 'device_retire' &&
                        ` · ${formatPlanSummary(b.plannedLinesJson as Parameters<typeof formatPlanSummary>[0])}`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.touchedDeviceCount ?? 0} / {b.plannedDeviceCount ?? 0}
                      {isOnboard && (b.onlineDeviceCount ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground block">
                          已上线 {b.onlineDeviceCount}
                        </span>
                      )}
                      {isInternalOccupancy && (
                        <span className="text-xs text-muted-foreground block">已挂接</span>
                      )}
                      {kind === 'device_retire' && (b.retiredDeviceCount ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground block">
                          退订 {b.retiredDeviceCount}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={importStatusColor[b.importStatus] ?? ''}>
                        {importStatusLabel(b)}
                      </Badge>
                    </TableCell>
                    <TableCell>{b.batchStatus}</TableCell>
                    <TableCell className="text-sm max-w-[140px] truncate" title={extraInfoLabel(b)}>
                      {extraInfoLabel(b)}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{b.workOrderNo ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {kind === 'device_retire'
                        ? formatDt(b.expectedCompletionDate ?? b.updatedAt)
                        : formatDt(b.plannedReadyAt ?? b.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={onboardingBatchDetailPath(b)}>
                              <Eye className="w-4 h-4 mr-2" />
                              查看详情
                            </Link>
                          </DropdownMenuItem>
                          {isOnboard && b.importStatus === 'parsed' && (
                            <DropdownMenuItem
                              disabled={commitListMutation.isPending}
                              onClick={() => commitListMutation.mutate({ batchId: b.id })}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              确认入库
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <InternalOccupancyBatchCreateDialog
        open={internalOccupancyOpen}
        onOpenChange={setInternalOccupancyOpen}
      />
      <OnboardingBatchWizardDialog
        routeKind={wizardRouteKind}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          void utils.supplier.onboardingBatch.list.invalidate()
        }}
      />
    </div>
  )
}
