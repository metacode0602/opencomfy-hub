'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, Loader2 } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
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
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'
import { onlineReasonLabel } from '@/lib/supplier-ops/ui-meta'
import {
  BATCH_KIND_BADGE,
  IMPORT_STATUS_LABELS,
  onboardingBatchDetailPath,
  type PlannedBatchKind,
} from '@/lib/supplier/onboarding-batch-utils'
import { getDeviceRetireReasonLabel, type DeviceRetireReason } from '@/lib/types/device-retire'
import {
  INTERNAL_TEST_HOLD_DEPARTMENT_LABELS,
  INTERNAL_TEST_HOLD_SETTLEMENT_LABELS,
} from '@/lib/types/supplier-domain'
import type { InternalTestHoldListItem } from '@/lib/types/internal-test-hold-api'
import { trpc } from '@/lib/trpc/client'
import type { OnboardingBatchRow } from '@workspace/db/schema'

type PanelTab = 'batches' | 'internal'

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  none: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  parsed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  committed: 'bg-green-500/20 text-green-400 border-green-500/30',
  parse_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
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
  lines:
    | Array<{
        gpuCardTypeCode?: string
        gpu_card_type_code?: string
        plannedQuantity?: number
        planned_quantity?: number
      }>
    | null
    | undefined,
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

function isHoldActive(hold: InternalTestHoldListItem) {
  const now = Date.now()
  const from = new Date(hold.holdFrom).getTime()
  const until = hold.holdUntil ? new Date(hold.holdUntil).getTime() : null
  if (now < from) return false
  if (until != null && now > until) return false
  return true
}

function extraBatchInfo(batch: OnboardingBatchRow): string {
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

function isOnboardingKind(kind: string): kind is 'online' | 'order_access' {
  return kind === 'online' || kind === 'order_access'
}

export function DatacenterPlannedBatchesPanel({
  dataCenterId,
  highlightBatchId,
  compact = false,
}: {
  dataCenterId: string
  highlightBatchId?: string
  compact?: boolean
}) {
  const [activeTab, setActiveTab] = useState<PanelTab>('batches')

  const {
    data: batchesData,
    isLoading: batchesLoading,
    isError: batchesError,
  } = trpc.supplier.onboardingBatch.list.useQuery(
    { batchKind: 'all', dataCenterId },
    { enabled: activeTab === 'batches' },
  )

  const {
    data: holdsData,
    isLoading: holdsLoading,
    isError: holdsError,
  } = trpc.supplier.internalTestHold.list.useQuery(
    { dataCenterId, activeOnly: 'all' },
    { enabled: activeTab === 'internal' },
  )

  const {
    data: occupancyBatchesData,
    isLoading: occupancyLoading,
  } = trpc.supplier.onboardingBatch.list.useQuery(
    { batchKind: 'internal_occupancy', dataCenterId },
    { enabled: activeTab === 'internal' },
  )

  const plannedBatches = batchesData?.items ?? []
  const holds = holdsData?.items ?? []
  const occupancyBatches = occupancyBatchesData?.items ?? []

  const batchPagination = useListPagination(plannedBatches)
  const holdsPagination = useListPagination(holds)

  const batchStats = useMemo(() => {
    const onlineCount = plannedBatches.filter((b) => b.batchKind === 'online').length
    const orderAccessCount = plannedBatches.filter((b) => b.batchKind === 'order_access').length
    const retireCount = plannedBatches.filter((b) => b.batchKind === 'device_retire').length
    const plannedTotal = plannedBatches.reduce((s, b) => s + (b.plannedDeviceCount ?? 0), 0)
    const touchedTotal = plannedBatches.reduce((s, b) => s + (b.touchedDeviceCount ?? 0), 0)

    return { onlineCount, orderAccessCount, retireCount, plannedTotal, touchedTotal }
  }, [plannedBatches])

  const holdStats = useMemo(() => {
    const holdUnits = holds.reduce((s, h) => s + h.unitCount, 0)
    const activeHolds = holds.filter(isHoldActive).length
    return { holdCount: holds.length, holdUnits, activeHolds }
  }, [holds])

  const emptyBatchHint = compact
    ? '暂无计划批次'
    : '暂无计划批次，可点击右上角「设备上架」或「设备下架 / 裁撤」创建'
  const emptyHoldHint = compact
    ? '暂无内部占用记录'
    : '暂无内部占用记录，可点击「设备上架 / 接入」→ 内部占用创建'

  return (
    <Card className="overflow-x-auto border-border bg-card">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PanelTab)}>
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-base">计划与占用</CardTitle>
            <CardDescription>
              本机房的上架、订单接入、下架计划及内部占用台账
            </CardDescription>
          </div>
          <TabsList>
            <TabsTrigger value="batches">计划批次</TabsTrigger>
            <TabsTrigger value="internal">内部占用</TabsTrigger>
          </TabsList>

          {activeTab === 'batches' && !batchesLoading && !batchesError && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">批次总数</p>
                <p className="text-lg font-semibold">{plannedBatches.length}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">设备上架</p>
                <p className="text-lg font-semibold">{batchStats.onlineCount}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">订单接入</p>
                <p className="text-lg font-semibold">{batchStats.orderAccessCount}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">设备下架</p>
                <p className="text-lg font-semibold">{batchStats.retireCount}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">计划 / 已触达</p>
                <p className="text-lg font-semibold">
                  {batchStats.plannedTotal} / {batchStats.touchedTotal}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'internal' && !holdsLoading && !holdsError && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">占用记录</p>
                <p className="text-lg font-semibold">{holdStats.holdCount}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">计划台数</p>
                <p className="text-lg font-semibold">{holdStats.holdUnits}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">进行中</p>
                <p className="text-lg font-semibold">{holdStats.activeHolds}</p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6 p-0 pb-4">
          <TabsContent value="batches" className="mt-0">
            {batchesLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载计划批次...
              </div>
            ) : batchesError ? (
              <div className="py-12 text-center text-sm text-destructive">加载计划批次失败</div>
            ) : (
              <PlannedBatchTable
                batches={batchPagination.items}
                emptyHint={emptyBatchHint}
                highlightBatchId={highlightBatchId}
                pagination={
                  batchPagination.totalItems > 0
                    ? {
                        page: batchPagination.page,
                        totalPages: batchPagination.totalPages,
                        totalItems: batchPagination.totalItems,
                        pageSize: batchPagination.pageSize,
                        onPageChange: batchPagination.setPage,
                      }
                    : undefined
                }
              />
            )}
          </TabsContent>

          <TabsContent value="internal" className="mt-0">
            {occupancyLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载内部占用计划...
              </div>
            ) : occupancyBatches.length > 0 ? (
              <div className="mb-6 space-y-2">
                <p className="px-4 text-sm font-medium">内部占用计划批次</p>
                <PlannedBatchTable
                  batches={occupancyBatches}
                  emptyHint=""
                  highlightBatchId={highlightBatchId}
                />
              </div>
            ) : null}
            {holdsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载内部占用...
              </div>
            ) : holdsError ? (
              <div className="py-12 text-center text-sm text-destructive">加载内部占用失败</div>
            ) : (
              <InternalHoldTable
                holds={holdsPagination.items}
                emptyHint={emptyHoldHint}
                pagination={
                  holdsPagination.totalItems > 0
                    ? {
                        page: holdsPagination.page,
                        totalPages: holdsPagination.totalPages,
                        totalItems: holdsPagination.totalItems,
                        pageSize: holdsPagination.pageSize,
                        onPageChange: holdsPagination.setPage,
                      }
                    : undefined
                }
              />
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

function PlannedBatchTable({
  batches,
  emptyHint,
  highlightBatchId,
  pagination,
}: {
  batches: OnboardingBatchRow[]
  emptyHint: string
  highlightBatchId?: string
  pagination?: {
    page: number
    totalPages: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
  }
}) {
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">批次号</TableHead>
            <TableHead className="text-muted-foreground">类型</TableHead>
            <TableHead className="text-muted-foreground">计划明细</TableHead>
            <TableHead className="text-muted-foreground">进度</TableHead>
            <TableHead className="text-muted-foreground">导入状态</TableHead>
            <TableHead className="text-muted-foreground">批次状态</TableHead>
            <TableHead className="text-muted-foreground">补充信息</TableHead>
            <TableHead className="text-muted-foreground">飞书工单</TableHead>
            <TableHead className="text-muted-foreground">计划完成</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.length === 0 ? (
            <TableRow className="border-border">
              <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                {emptyHint}
              </TableCell>
            </TableRow>
          ) : (
            batches.map((batch) => {
              const kind = batch.batchKind as PlannedBatchKind
              const badge = BATCH_KIND_BADGE[kind]
              const isHighlighted = batch.id === highlightBatchId
              return (
                <TableRow
                  key={batch.id}
                  className={`border-border ${isHighlighted ? 'bg-primary/5' : ''}`}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={onboardingBatchDetailPath(batch)}
                      className="text-primary hover:underline"
                    >
                      {batch.batchCode}
                    </Link>
                    {isHighlighted && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        当前
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {badge && (
                      <Badge variant="outline" className={badge.className}>
                        {badge.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                    {batch.plannedDeviceCount ?? 0} 台
                    {kind !== 'device_retire' &&
                      ` · ${formatPlanSummary(batch.plannedLinesJson as Parameters<typeof formatPlanSummary>[0])}`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.touchedDeviceCount ?? 0} / {batch.plannedDeviceCount ?? 0}
                    {isOnboardingKind(kind) && (batch.onlineDeviceCount ?? 0) > 0 && (
                      <span className="ml-1 block text-xs text-muted-foreground">
                        已上线 {batch.onlineDeviceCount}
                      </span>
                    )}
                    {kind === 'device_retire' && (batch.retiredDeviceCount ?? 0) > 0 && (
                      <span className="ml-1 block text-xs text-muted-foreground">
                        退订 {batch.retiredDeviceCount}
                      </span>
                    )}
                    {kind === 'internal_occupancy' && (
                      <span className="ml-1 block text-xs text-muted-foreground">已挂接</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={importStatusColor[batch.importStatus] ?? ''}>
                      {IMPORT_STATUS_LABELS[batch.importStatus] ?? batch.importStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {batch.batchStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm" title={extraBatchInfo(batch)}>
                    {extraBatchInfo(batch)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.workOrderNo ? (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{batch.workOrderNo}</code>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {kind === 'device_retire'
                      ? formatDt(batch.expectedCompletionDate ?? batch.updatedAt)
                      : formatDt(batch.plannedReadyAt ?? batch.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={onboardingBatchDetailPath(batch)}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {pagination && <ListPagination {...pagination} />}
    </div>
  )
}

function InternalHoldTable({
  holds,
  emptyHint,
  pagination,
}: {
  holds: InternalTestHoldListItem[]
  emptyHint: string
  pagination?: {
    page: number
    totalPages: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
  }
}) {
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">飞书工单</TableHead>
            <TableHead className="text-muted-foreground">使用者</TableHead>
            <TableHead className="text-muted-foreground">部门</TableHead>
            <TableHead className="text-muted-foreground">计划明细</TableHead>
            <TableHead className="text-muted-foreground">结算</TableHead>
            <TableHead className="text-muted-foreground">占用时段</TableHead>
            <TableHead className="text-muted-foreground">关联设备</TableHead>
            <TableHead className="text-muted-foreground">状态</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {holds.length === 0 ? (
            <TableRow className="border-border">
              <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                {emptyHint}
              </TableCell>
            </TableRow>
          ) : (
            holds.map((hold) => {
              const active = isHoldActive(hold)
              return (
                <TableRow key={hold.id} className="border-border">
                  <TableCell className="text-sm">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{hold.workOrderNo}</code>
                  </TableCell>
                  <TableCell className="text-sm">{hold.userName}</TableCell>
                  <TableCell className="text-sm">
                    {INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[hold.department]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {hold.cardTypeCode} × {hold.unitCount} 台
                  </TableCell>
                  <TableCell className="text-sm">
                    {INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[hold.settlementMode]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDt(hold.holdFrom)}
                    {hold.holdUntil ? ` → ${formatDt(hold.holdUntil)}` : ' → 长期'}
                  </TableCell>
                  <TableCell className="text-sm">{hold.deviceCount}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        active
                          ? 'border-purple-500/30 bg-purple-500/20 text-purple-400'
                          : 'border-gray-500/30 bg-gray-500/20 text-gray-400'
                      }
                    >
                      {active ? '进行中' : '已结束'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/supplier/test-holds/${hold.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {pagination && <ListPagination {...pagination} />}
    </div>
  )
}
