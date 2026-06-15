'use client'

import { useEffect, useMemo, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
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
import { ListPagination } from '@/components/shared/list-pagination'
import { formatCstDate, validateBillingDateRange } from '@/lib/crm/tenant-billing-import-utils'
import { trpc } from '@/lib/trpc/client'
import type { BalanceSnapshotJobRunDto } from '@/lib/types/balance-snapshot'
import type { BillingSyncJobRunDto } from '@/lib/types/billing-scheduled-sync'
import type { BareMetalOrderSyncJobRunDto } from '@/lib/types/bare-metal-order-sync-api'

const PREVIEW_RUN_LIMIT = 10
const ALL_RUNS_PAGE_SIZE = 20

type JobRunsDialogVariant = 'billing' | 'balanceSnapshot' | 'bareMetal'

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

function HistoryCardHeader({
  title,
  description,
  total,
  onViewAll,
}: {
  title: string
  description?: string
  total: number
  onViewAll: () => void
}) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
      <div className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      {total > PREVIEW_RUN_LIMIT ? (
        <Button variant="outline" size="sm" className="shrink-0" onClick={onViewAll}>
          查看全部
        </Button>
      ) : null}
    </CardHeader>
  )
}

function AllJobRunsDialog({
  open,
  onOpenChange,
  variant,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: JobRunsDialogVariant
}) {
  const [page, setPage] = useState(1)
  const offset = (page - 1) * ALL_RUNS_PAGE_SIZE

  useEffect(() => {
    if (open) setPage(1)
  }, [open])

  const billingQuery = trpc.crm.billingSync.listRuns.useQuery(
    { limit: ALL_RUNS_PAGE_SIZE, offset },
    { enabled: open && variant === 'billing' },
  )
  const balanceQuery = trpc.crm.balanceSnapshot.listRuns.useQuery(
    { limit: ALL_RUNS_PAGE_SIZE, offset },
    { enabled: open && variant === 'balanceSnapshot' },
  )
  const bareMetalQuery = trpc.crm.bareMetalOrderSync.listRuns.useQuery(
    { limit: ALL_RUNS_PAGE_SIZE, offset },
    { enabled: open && variant === 'bareMetal' },
  )

  const activeQuery =
    variant === 'billing'
      ? billingQuery
      : variant === 'balanceSnapshot'
        ? balanceQuery
        : bareMetalQuery

  const { data, isLoading } = activeQuery
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / ALL_RUNS_PAGE_SIZE))

  const titles: Record<JobRunsDialogVariant, string> = {
    billing: '账单同步历史',
    balanceSnapshot: '余额快照采集历史',
    bareMetal: '裸金属订单同步历史',
  }

  const descriptions: Record<JobRunsDialogVariant, string> = {
    billing: '全部同步任务记录，点击行展开租户级明细',
    balanceSnapshot: '全部采集任务记录',
    bareMetal: '全部同步任务记录，点击行展开新租户账单同步明细',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-6xl min-w-[40vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b px-6 py-4">
          <DialogTitle>{titles[variant]}</DialogTitle>
          <DialogDescription>{descriptions[variant]}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
          ) : !data?.runs.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">暂无记录</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                {variant === 'billing' ? (
                  <>
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
                      {(billingQuery.data?.runs ?? []).map((run) => (
                        <JobRunRow key={run.id} run={run} />
                      ))}
                    </TableBody>
                  </>
                ) : variant === 'balanceSnapshot' ? (
                  <>
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
                      {(balanceQuery.data?.runs ?? []).map((run) => (
                        <BalanceSnapshotRunRow key={run.id} run={run} />
                      ))}
                    </TableBody>
                  </>
                ) : (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead>开始时间</TableHead>
                        <TableHead>触发方式</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>全量条数</TableHead>
                        <TableHead>自动导入租户</TableHead>
                        <TableHead>账单同步租户</TableHead>
                        <TableHead>订单 upsert</TableHead>
                        <TableHead>结束时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(bareMetalQuery.data?.runs ?? []).map((run) => (
                        <BareMetalOrderSyncJobRunRow key={run.id} run={run} />
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
            </div>
          )}
        </div>

        {!isLoading && total > 0 ? (
          <div className="border-t px-6 py-3">
            <ListPagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={ALL_RUNS_PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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
  const { data: runsData, isLoading } = trpc.crm.billingSync.listRuns.useQuery({
    limit: PREVIEW_RUN_LIMIT,
  })
  const runNow = trpc.crm.billingSync.runNow.useMutation()
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [allRunsOpen, setAllRunsOpen] = useState(false)

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
        <HistoryCardHeader
          title="同步历史"
          description="点击行展开租户级明细"
          total={runsData?.total ?? 0}
          onViewAll={() => setAllRunsOpen(true)}
        />
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

      <AllJobRunsDialog open={allRunsOpen} onOpenChange={setAllRunsOpen} variant="billing" />

      <BalanceSnapshotSettingsSection />
      <BareMetalOrderSyncSettingsSection />
    </div>
  )
}

function BalanceSnapshotRunRow({ run }: { run: BalanceSnapshotJobRunDto }) {
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
  const { data: runsData, isLoading } = trpc.crm.balanceSnapshot.listRuns.useQuery({
    limit: PREVIEW_RUN_LIMIT,
  })
  const runNow = trpc.crm.balanceSnapshot.runNow.useMutation()
  const [allRunsOpen, setAllRunsOpen] = useState(false)

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
        <HistoryCardHeader
          title="采集历史"
          total={runsData?.total ?? 0}
          onViewAll={() => setAllRunsOpen(true)}
        />
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

      <AllJobRunsDialog
        open={allRunsOpen}
        onOpenChange={setAllRunsOpen}
        variant="balanceSnapshot"
      />
    </>
  )
}

const BARE_METAL_SYNC_PHASE_LABELS: Record<string, string> = {
  billing_sync: '账单同步',
  tenant_import: '租户导入',
  order_upsert: '订单写入',
}

function BareMetalOrderSyncJobRunDetail({ runId }: { runId: string }) {
  const { data, isLoading } = trpc.crm.bareMetalOrderSync.getRunById.useQuery({ id: runId })

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
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">本任务无租户级明细（可能无新租户账单同步）</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>平台租户 ID</TableHead>
              <TableHead>CRM 租户</TableHead>
              <TableHead>阶段</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>错误</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.platformTenantId}</TableCell>
                <TableCell>{item.tenantName ?? item.tenantId ?? '—'}</TableCell>
                <TableCell>{BARE_METAL_SYNC_PHASE_LABELS[item.phase] ?? item.phase}</TableCell>
                <TableCell>{statusBadge(item.status)}</TableCell>
                <TableCell className="text-xs max-w-xs text-destructive">
                  {item.errorMessage ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function BareMetalOrderSyncJobRunRow({ run }: { run: BareMetalOrderSyncJobRunDto }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setExpanded((v) => !v)}>
        <TableCell>{formatDt(run.startedAt)}</TableCell>
        <TableCell>{run.trigger === 'manual' ? '手动' : '定时'}</TableCell>
        <TableCell>{statusBadge(run.status)}</TableCell>
        <TableCell>{run.ordersFetchedCount}</TableCell>
        <TableCell>{run.tenantsAutoImportedCount}</TableCell>
        <TableCell>{run.billingSyncTenantCount}</TableCell>
        <TableCell>{run.orderUpsertedCount}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDt(run.finishedAt)}</TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={8} className="p-0">
            <BareMetalOrderSyncJobRunDetail runId={run.id} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function BareMetalOrderSyncSettingsSection() {
  const utils = trpc.useUtils()
  const { data: config } = trpc.crm.bareMetalOrderSync.getConfig.useQuery()
  const { data: runsData, isLoading } = trpc.crm.bareMetalOrderSync.listRuns.useQuery({
    limit: PREVIEW_RUN_LIMIT,
  })
  const runNow = trpc.crm.bareMetalOrderSync.runNow.useMutation()
  const [allRunsOpen, setAllRunsOpen] = useState(false)

  const handleRunNow = async () => {
    try {
      const result = await runNow.mutateAsync()
      if (!result.acquiredLock) {
        toast.warning(result.message ?? '已有同步任务正在运行')
        return
      }
      toast.success(`裸金属订单同步已完成（${result.status ?? 'unknown'}）`)
      void utils.crm.bareMetalOrderSync.listRuns.invalidate()
      void utils.crm.bareMetalOrderSync.getConfig.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '触发同步失败')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 pt-2 border-t">
        <div>
          <h2 className="font-semibold">裸金属订单同步</h2>
          <p className="text-sm text-muted-foreground mt-1">
            每小时全量拉取平台裸金属订单；未知租户自动建档并同步近 {config?.billingLookbackMonths ?? 6}{' '}
            个月账单
          </p>
        </div>
        <Button variant="secondary" onClick={() => void handleRunNow()} disabled={runNow.isPending}>
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
            裸金属订单调度
          </CardTitle>
          <CardDescription>
            环境变量 BARE_METAL_ORDER_SYNC_*；启用后未知租户将自动创建客户与计费租户（无人工确认）
          </CardDescription>
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
            <p className="text-muted-foreground">新租户账单回溯</p>
            <p className="font-medium">{config?.billingLookbackMonths ?? '—'} 个月</p>
          </div>
          <div>
            <p className="text-muted-foreground">自动建档</p>
            <p className="font-medium">
              {config?.autoImportTenantsEnabled ? '随同步启用' : '未启用'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">上次运行</p>
            <p className="font-medium">{formatDt(config?.lastRunAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">上次成功</p>
            <p className="font-medium">{formatDt(config?.lastSuccessAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <HistoryCardHeader
          title="同步历史"
          description="点击行展开新租户账单同步明细"
          total={runsData?.total ?? 0}
          onViewAll={() => setAllRunsOpen(true)}
        />
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
                  <TableHead>全量条数</TableHead>
                  <TableHead>自动导入租户</TableHead>
                  <TableHead>账单同步租户</TableHead>
                  <TableHead>订单 upsert</TableHead>
                  <TableHead>结束时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsData.runs.map((run) => (
                  <BareMetalOrderSyncJobRunRow key={run.id} run={run} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AllJobRunsDialog open={allRunsOpen} onOpenChange={setAllRunsOpen} variant="bareMetal" />
    </>
  )
}
