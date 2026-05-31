'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Server } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'
import { DEVICE_COOPERATION_TYPE_LABELS } from '@/lib/types/supplier-domain'
import { trpc } from '@/lib/trpc/client'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'

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

export function OnboardingBatchProgressDevices({ batchId }: { batchId: string }) {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = trpc.supplier.onboardingBatch.listDatacenterUploadedDevices.useQuery(
    { batchId },
    { retry: 1 },
  )

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const devices = data?.devices ?? []

  const pagination = useListPagination(devices)

  const linkedDeviceIds = useMemo(
    () => devices.filter((d) => d.linkedToBatch).map((d) => d.id),
    [devices],
  )

  useEffect(() => {
    if (linkedDeviceIds.length > 0) {
      setExpanded(new Set(linkedDeviceIds))
    }
  }, [linkedDeviceIds])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载机房设备主数据...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-3">
          <p>机房设备列表加载失败</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.devices.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          该机房尚未上传设备主数据，请先在机房详情页导入设备表
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Server className="w-4 h-4" />
            机房已上传设备
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data.dataCenterName}（{data.idcCode}）· 主数据 {data.totalDevices} 台 · 已关联本批次{' '}
            {data.linkedDevices} 台
          </p>
        </div>
        <p className="text-xs text-muted-foreground">展开设备行可查看设备变更表记录</p>
      </div>

      <div className="space-y-2">
        {pagination.items.map((device) => {
          const isOpen = expanded.has(device.id)
          const batchChangeCount = device.changeLogs.filter((l) => l.linkedToCurrentBatch).length
          return (
            <Collapsible
              key={device.id}
              open={isOpen}
              onOpenChange={() => toggle(device.id)}
            >
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 p-3 sm:p-4">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-md -m-1 p-1 hover:bg-muted/50 transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <p className="font-mono text-xs font-medium">{device.sn}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {device.externalDeviceId ?? device.assetNo ?? '—'}
                          </p>
                        </div>
                        <div className="font-mono text-xs">
                          <p>{device.internalIp ?? '—'}</p>
                          <p className="text-muted-foreground">{device.externalIp ?? '—'}</p>
                        </div>
                        <div>
                          <p>{device.cardTypeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {device.gpuCount} 卡 ·{' '}
                            {DEVICE_COOPERATION_TYPE_LABELS[
                              device.cooperationType as keyof typeof DEVICE_COOPERATION_TYPE_LABELS
                            ] ?? device.cooperationType}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={LIFECYCLE_STATUS_COLORS[device.lifecycleStatus] ?? ''}
                          >
                            {device.lifecycleStatus}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {device.opsStatus}
                          </Badge>
                          {device.inMaintenance && (
                            <Badge variant="outline" className="text-xs">
                              维修中
                            </Badge>
                          )}
                          {device.linkedToBatch && (
                            <Badge variant="default" className="text-xs">
                              已关联
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      变更 {device.changeLogs.length}
                      {batchChangeCount > 0 ? ` · 本批次 ${batchChangeCount}` : ''}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/supplier/devices/${device.id}`}>详情</Link>
                    </Button>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="border-t px-3 pb-3 sm:px-4 sm:pb-4">
                    {device.changeLogs.length === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground text-center">
                        暂无设备变更表记录
                      </p>
                    ) : (
                      <div className="overflow-x-auto pt-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">行</TableHead>
                              <TableHead>操作时间</TableHead>
                              <TableHead>变更动作</TableHead>
                              <TableHead>变更内容</TableHead>
                              <TableHead>工单</TableHead>
                              <TableHead>生命周期</TableHead>
                              <TableHead>运维状态</TableHead>
                              <TableHead>批次</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {device.changeLogs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell className="text-muted-foreground">
                                  {log.importRowNo ?? '—'}
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {formatDt(log.occurredAt)}
                                </TableCell>
                                <TableCell>{log.changeAction}</TableCell>
                                <TableCell
                                  className="max-w-[180px] truncate text-xs"
                                  title={log.changeContent ?? log.description ?? undefined}
                                >
                                  {log.changeContent ?? log.description ?? '—'}
                                </TableCell>
                                <TableCell className="text-xs">{log.ticketNo ?? '—'}</TableCell>
                                <TableCell className="text-xs">
                                  {log.previousLifecycleStatus || log.newLifecycleStatus ? (
                                    <>
                                      {log.previousLifecycleStatus ?? '—'} →{' '}
                                      {log.newLifecycleStatus ?? '—'}
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {log.previousOpsStatus || log.newOpsStatus ? (
                                    <>
                                      {log.previousOpsStatus ?? '—'} → {log.newOpsStatus ?? '—'}
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell>
                                  {log.linkedToCurrentBatch ? (
                                    <Badge variant="default" className="text-xs">
                                      本批次
                                    </Badge>
                                  ) : log.businessOnboardingBatchId ? (
                                    <Badge variant="outline" className="text-xs">
                                      其他批次
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">未关联</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}
      </div>

      {pagination.totalItems > 0 && (
        <ListPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
        />
      )}
    </div>
  )
}
