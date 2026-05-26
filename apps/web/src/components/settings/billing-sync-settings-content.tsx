'use client'

import { useState } from 'react'
import { IconClock, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { toast } from 'sonner'
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
import { trpc } from '@/lib/trpc/client'
import type { BillingSyncJobRunDto } from '@/lib/types/billing-scheduled-sync'

function formatDt(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function statusBadge(status: string) {
  const variant =
    status === 'success'
      ? 'default'
      : status === 'partial'
        ? 'secondary'
        : status === 'running'
          ? 'outline'
          : 'destructive'
  const labels: Record<string, string> = {
    success: '成功',
    partial: '部分成功',
    failed: '失败',
    running: '运行中',
    skipped: '跳过',
  }
  return <Badge variant={variant}>{labels[status] ?? status}</Badge>
}

function JobRunDetail({ runId }: { runId: string }) {
  const { data, isLoading } = trpc.crm.billingSync.getRunById.useQuery({ id: runId })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">加载明细…</p>
  }
  if (!data) {
    return <p className="text-sm text-destructive p-4">未找到任务记录</p>
  }

  return (
    <div className="border-t bg-muted/20 p-4 space-y-3">
      {data.errorSummary ? (
        <p className="text-sm text-destructive">{data.errorSummary}</p>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>租户</TableHead>
            <TableHead>项目</TableHead>
            <TableHead>日期范围</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>摘要</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.tenantName}</div>
                {item.platformTenantId ? (
                  <div className="text-xs text-muted-foreground">平台 ID：{item.platformTenantId}</div>
                ) : null}
              </TableCell>
              <TableCell>{item.projectName ?? '—'}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {item.startDate} ~ {item.endDate}
              </TableCell>
              <TableCell>{statusBadge(item.status)}</TableCell>
              <TableCell className="text-xs max-w-xs">
                {item.error ? (
                  <span className="text-destructive">{item.error}</span>
                ) : (
                  (item.summary ?? '—')
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function JobRunRow({ run }: { run: BillingSyncJobRunDto }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setExpanded((v) => !v)}>
        <TableCell>{formatDt(run.startedAt)}</TableCell>
        <TableCell>{run.trigger === 'manual' ? '手动' : '定时'}</TableCell>
        <TableCell>{statusBadge(run.status)}</TableCell>
        <TableCell>{run.syncEndDate}</TableCell>
        <TableCell>
          {run.successCount}/{run.tenantCount}
          {run.failedCount > 0 ? `（失败 ${run.failedCount}）` : ''}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDt(run.finishedAt)}</TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={6} className="p-0">
            <JobRunDetail runId={run.id} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

export function BillingSyncSettingsContent() {
  const utils = trpc.useUtils()
  const { data: config } = trpc.crm.billingSync.getConfig.useQuery()
  const { data: runsData, isLoading } = trpc.crm.billingSync.listRuns.useQuery({ limit: 30 })
  const runNow = trpc.crm.billingSync.runNow.useMutation()

  const handleRunNow = async () => {
    try {
      const result = await runNow.mutateAsync()
      if (!result.acquiredLock) {
        toast.warning(result.message ?? '已有同步任务正在运行')
        return
      }
      toast.success(`同步任务已完成（${result.status ?? 'unknown'}）`)
      void utils.crm.billingSync.listRuns.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '触发同步失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">账单定时同步</h2>
          <p className="text-sm text-muted-foreground mt-1">
            每日自动从算算力平台增量同步 active 项目关联租户的账单数据
          </p>
        </div>
        <Button onClick={() => void handleRunNow()} disabled={runNow.isPending}>
          {runNow.isPending ? (
            <>
              <IconLoader2 className="mr-2 size-4 animate-spin" />
              同步中…
            </>
          ) : (
            <>
              <IconRefresh className="mr-2 size-4" />
              立即同步
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <IconClock className="size-4" />
            调度配置
          </CardTitle>
          <CardDescription>以下配置来自环境变量，修改后需重启服务</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">启用状态</p>
            <p className="font-medium">{config?.enabled ? '已启用' : '未启用'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cron 表达式</p>
            <p className="font-medium font-mono">{config?.cron ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">时区</p>
            <p className="font-medium">{config?.timezone ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">安全窗口</p>
            <p className="font-medium">{config?.safetyDays ?? '—'} 天</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">项目状态过滤</p>
            <p className="font-medium">{config?.projectStatuses.join('、') ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">同步历史</CardTitle>
          <CardDescription>点击行展开租户级明细</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : !runsData?.runs.length ? (
            <p className="p-6 text-sm text-muted-foreground">暂无同步记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>开始时间</TableHead>
                  <TableHead>触发方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>数据结束日</TableHead>
                  <TableHead>成功/租户数</TableHead>
                  <TableHead>结束时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsData.runs.map((run) => (
                  <JobRunRow key={run.id} run={run} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
