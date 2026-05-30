'use client'

import { Loader2 } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { trpc } from '@/lib/trpc/client'

function formatDt(iso: Date | string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function sourceLabel(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '系统'
  const p = payload as Record<string, unknown>
  if (p.source === 'manual_ui') return '人工调整'
  if (p.source === 'changelog') return '变更表'
  return '系统'
}

export function BatchProgressTimeline({ batchId }: { batchId: string }) {
  const { data: events = [], isLoading } = trpc.supplier.onboardingBatch.listProgressEvents.useQuery({
    batchId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载进度时间轴...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          暂无进度事件；新建批次或同步进度后将在此展示
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>事件</TableHead>
              <TableHead>来源</TableHead>
              <TableHead className="text-right">计划台/GPU</TableHead>
              <TableHead className="text-right">触达台/GPU</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>备注</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => {
              const payload = ev.payload as Record<string, unknown> | null
              const reason =
                typeof payload?.reason === 'string' ? payload.reason : null
              return (
                <TableRow key={ev.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDt(ev.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{ev.eventTypeLabel}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {sourceLabel(ev.payload)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {ev.plannedDeviceCount} / {ev.plannedGpuCount}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {ev.touchedDeviceCount} / {ev.touchedPipelineGpu}
                  </TableCell>
                  <TableCell className="text-sm">{ev.batchStatus}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {reason ?? '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function BatchAdjustHistoryList({ batchId }: { batchId: string }) {
  const { data: items = [], isLoading } = trpc.supplier.onboardingBatch.listAdjustHistory.useQuery({
    batchId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载调整记录...
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">暂无手动调整记录</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const meta = item.metadata as {
          before?: { planned_device_count?: number; planned_gpu_count?: number }
          after?: { planned_device_count?: number; planned_gpu_count?: number }
        } | null
        return (
          <Card key={item.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground">{formatDt(item.occurredAt)}</span>
                <span className="text-muted-foreground">· {item.authorName ?? '—'}</span>
              </div>
              <p className="text-sm">{item.description}</p>
              {meta?.before && meta?.after ? (
                <p className="text-xs text-muted-foreground">
                  台数 {meta.before.planned_device_count}→{meta.after.planned_device_count}；GPU{' '}
                  {meta.before.planned_gpu_count}→{meta.after.planned_gpu_count}
                </p>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
