'use client'

import { useMemo, useState } from 'react'
import { IconClock, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { toast } from 'sonner'
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
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { formatCstDate, validateBillingDateRange } from '@/lib/crm/tenant-billing-import-utils'
import { trpc } from '@/lib/trpc/client'
import type { BillingSyncJobRunDto } from '@/lib/types/billing-scheduled-sync'

function defaultBackfillDate(): string {
  return formatCstDate(new Date())
}

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

function BillingSyncBackfillDialog({
  open,
  onOpenChange,
  safetyDays,
  onCompleted,
  runNow,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  safetyDays?: number
  onCompleted: () => void
  runNow: ReturnType<typeof trpc.crm.billingSync.runNow.useMutation>
}) {
  const [startDate, setStartDate] = useState(defaultBackfillDate)
  const [endDate, setEndDate] = useState(defaultBackfillDate)

  const dateRangeError = useMemo(() => {
    try {
      validateBillingDateRange(startDate, endDate)
      const todayCst = formatCstDate(new Date())
      if (endDate > todayCst) {
        return '结束日期不能晚于东八区今天'
      }
      return null
    } catch (e) {
      return e instanceof Error ? e.message : '日期范围无效'
    }
  }, [startDate, endDate])

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const today = defaultBackfillDate()
      setStartDate(today)
      setEndDate(today)
    }
    onOpenChange(next)
  }

  const handleConfirm = async () => {
    if (dateRangeError) {
      toast.error(dateRangeError)
      return
    }

    try {
      const result = await runNow.mutateAsync({
        mode: 'backfill',
        startDate,
        endDate,
      })
      if (!result.acquiredLock) {
        toast.warning(result.message ?? '已有同步任务正在运行')
        return
      }
      toast.success(`补同步已完成（${result.status ?? 'unknown'}）`)
      onCompleted()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '补同步失败')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>补同步遗漏账单</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                对所有 active 项目关联租户，按指定日期区间从算算力平台拉取账单。忽略各租户游标与安全窗口，且
                <span className="text-foreground">不会推进同步游标</span>。
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="billing-backfill-start">开始日期</Label>
                  <Input
                    id="billing-backfill-start"
                    type="date"
                    value={startDate}
                    disabled={runNow.isPending}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="billing-backfill-end">结束日期</Label>
                  <Input
                    id="billing-backfill-end"
                    type="date"
                    value={endDate}
                    disabled={runNow.isPending}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {dateRangeError ? (
                <p className="text-destructive text-xs">{dateRangeError}</p>
              ) : null}

              <p className="text-xs">
                默认可选至东八区今天；增量同步的安全窗口为 {safetyDays ?? '—'} 天，补同步不受此限制。
                同一区间可重复执行，数据写入幂等。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={runNow.isPending}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={runNow.isPending || Boolean(dateRangeError)}
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
          >
            {runNow.isPending ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                同步中…
              </>
            ) : (
              '开始补同步'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BillingSyncSettingsContent() {
  const utils = trpc.useUtils()
  const { data: config } = trpc.crm.billingSync.getConfig.useQuery()
  const { data: runsData, isLoading } = trpc.crm.billingSync.listRuns.useQuery({ limit: 30 })
  const runNow = trpc.crm.billingSync.runNow.useMutation()
  const [backfillOpen, setBackfillOpen] = useState(false)

  const handleRunNow = async () => {
    try {
      const result = await runNow.mutateAsync({ mode: 'incremental' })
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

  const invalidateRuns = () => {
    void utils.crm.billingSync.listRuns.invalidate()
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
        <div className="flex flex-wrap gap-2">
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
          <Button
            variant="outline"
            onClick={() => setBackfillOpen(true)}
            disabled={runNow.isPending}
          >
            补同步遗漏
          </Button>
        </div>
      </div>

      <BillingSyncBackfillDialog
        open={backfillOpen}
        onOpenChange={setBackfillOpen}
        safetyDays={config?.safetyDays}
        onCompleted={invalidateRuns}
        runNow={runNow}
      />

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

      <BalanceSnapshotSettingsSection />
    </div>
  )
}

function BalanceSnapshotRunRow({ run }: { run: import('@/lib/types/balance-snapshot').BalanceSnapshotJobRunDto }) {
  return (
    <TableRow>
      <TableCell>{formatDt(run.startedAt)}</TableCell>
      <TableCell>{run.trigger === 'manual' ? '手动' : '定时'}</TableCell>
      <TableCell>{run.granularity === 'hour' ? '小时' : run.granularity === 'day' ? '日' : run.granularity}</TableCell>
      <TableCell>{statusBadge(run.status)}</TableCell>
      <TableCell>
        {run.successCount}/{run.tenantCount}
        {run.failedCount > 0 ? `（失败 ${run.failedCount}）` : ''}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDt(run.finishedAt)}</TableCell>
    </TableRow>
  )
}

function BalanceSnapshotSettingsSection() {
  const utils = trpc.useUtils()
  const { data: config } = trpc.crm.balanceSnapshot.getConfig.useQuery()
  const { data: runsData, isLoading } = trpc.crm.balanceSnapshot.listRuns.useQuery({ limit: 20 })
  const runNow = trpc.crm.balanceSnapshot.runNow.useMutation()

  const handleRunNow = async () => {
    try {
      const results = await runNow.mutateAsync({ granularity: 'all' })
      void utils.crm.balanceSnapshot.listRuns.invalidate()

      const failed = results.filter((r) => r.status === 'failed')
      const partial = results.filter((r) => r.status === 'partial')
      if (failed.length > 0) {
        const detail =
          failed.map((r) => r.errorSummary).filter(Boolean).join('；') ||
          '平台接口调用失败'
        toast.error(detail)
        return
      }
      if (partial.length > 0) {
        toast.warning(
          `部分采集成功：${results.map((r) => `${r.status}(${r.successCount}/${r.tenantCount})`).join('、')}`,
        )
        return
      }
      toast.success(
        `余额快照采集完成：${results.map((r) => `${r.status}(${r.successCount}/${r.tenantCount})`).join('、')}`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '触发采集失败')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 pt-2 border-t">
        <div>
          <h2 className="font-semibold">余额快照采集</h2>
          <p className="text-sm text-muted-foreground mt-1">
            定时拉取平台租户 coin，写入小时/日余额快照，供项目详情页余额变动图使用
          </p>
        </div>
        <Button variant="secondary" onClick={() => void handleRunNow()} disabled={runNow.isPending}>
          {runNow.isPending ? (
            <>
              <IconLoader2 className="mr-2 size-4 animate-spin" />
              采集中…
            </>
          ) : (
            <>
              <IconRefresh className="mr-2 size-4" />
              立即采集
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <IconClock className="size-4" />
            余额快照调度
          </CardTitle>
          <CardDescription>环境变量 BALANCE_SNAPSHOT_*，修改后需重启服务</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">启用状态</p>
            <p className="font-medium">{config?.enabled ? '已启用' : '未启用'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">小时 Cron</p>
            <p className="font-medium font-mono">{config?.hourlyCron ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">日末 Cron</p>
            <p className="font-medium font-mono">{config?.dailyCron ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">时区</p>
            <p className="font-medium">{config?.timezone ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">采集历史</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : !runsData?.runs.length ? (
            <p className="p-6 text-sm text-muted-foreground">暂无采集记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>开始时间</TableHead>
                  <TableHead>触发方式</TableHead>
                  <TableHead>粒度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>成功/租户数</TableHead>
                  <TableHead>结束时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsData.runs.map((run) => (
                  <BalanceSnapshotRunRow key={run.id} run={run} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
