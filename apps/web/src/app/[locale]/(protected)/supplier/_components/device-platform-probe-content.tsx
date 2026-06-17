'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Eye,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import { ListPagination } from '@/components/shared/list-pagination'
import {
  CONSISTENCY_FLAG_LABELS,
  CONSISTENCY_FLAG_VARIANT,
  PROBE_STATUS_LABELS,
  PRESENCE_LABELS,
  RECORD_KIND_LABELS,
  devicePlatformProbeDetailPath,
  formatChannelHits,
  formatProxyRentDisplay,
  formatSnapshotHourLabel,
  type ConsistencyFlag,
  type DevicePlatformProbeRow,
  type ProbeStatus,
} from '@/lib/supplier/device-platform-probe-utils'
import { trpc } from '@/lib/trpc/client'

function ConsistencyBadge({ flag }: { flag: ConsistencyFlag }) {
  return (
    <Badge variant={CONSISTENCY_FLAG_VARIANT[flag]}>{CONSISTENCY_FLAG_LABELS[flag]}</Badge>
  )
}

function SuggestedActionCell({ row }: { row: DevicePlatformProbeRow }) {
  const [open, setOpen] = useState(false)
  const action = row.suggestedAction

  if (!action || action === '—') {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  const isNoAction = action === '无需处理'
  const isPending = action === '待评估'
  const Icon = isNoAction ? CheckCircle2 : Lightbulb

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={
          isNoAction
            ? 'h-7 gap-1 border-green-500/30 bg-green-500/5 text-green-700 hover:bg-green-500/10 dark:text-green-400'
            : isPending
              ? 'h-7 gap-1 text-muted-foreground'
              : 'h-7 gap-1 border-amber-500/40 bg-amber-500/5 text-amber-800 hover:bg-amber-500/10 dark:text-amber-300'
        }
        onClick={() => setOpen(true)}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="text-xs">查看建议</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>建议处理</DialogTitle>
            <DialogDescription className="font-mono text-xs">{row.sn}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ConsistencyBadge flag={row.consistencyFlag} />
              <Badge variant="outline" className="font-normal">
                {PROBE_STATUS_LABELS[row.probeStatus]}
              </Badge>
            </div>
            <p className="leading-relaxed text-foreground">{action}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PresenceBadges({ row }: { row: DevicePlatformProbeRow }) {
  const items = [
    { key: 'crm', hit: row.presence.crm, label: PRESENCE_LABELS.crm },
    { key: 'proxy', hit: row.presence.proxy, label: PRESENCE_LABELS.proxy },
    { key: 'k8s', hit: row.presence.k8s, label: PRESENCE_LABELS.k8s },
    { key: 'bareMetal', hit: row.presence.bareMetal, label: PRESENCE_LABELS.bareMetal },
  ] as const

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge
          key={item.key}
          variant={item.hit ? 'secondary' : 'outline'}
          className={
            item.hit ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'text-muted-foreground'
          }
        >
          {item.label}
          {item.hit ? ' ✓' : ''}
        </Badge>
      ))}
    </div>
  )
}

export function DevicePlatformProbeContent() {
  const [search, setSearch] = useState('')
  const [consistencyFilter, setConsistencyFilter] = useState<'all' | ConsistencyFlag>('all')
  const [probeStatusFilter, setProbeStatusFilter] = useState<'all' | ProbeStatus>('all')
  const [needsActionOnly, setNeedsActionOnly] = useState(false)
  const [orphansOnly, setOrphansOnly] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const queryInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      consistencyFlag: consistencyFilter === 'all' ? undefined : consistencyFilter,
      probeStatus: probeStatusFilter === 'all' ? undefined : probeStatusFilter,
      needsActionOnly: needsActionOnly || undefined,
      orphansOnly: orphansOnly || undefined,
      page,
      pageSize,
    }),
    [search, consistencyFilter, probeStatusFilter, needsActionOnly, orphansOnly, page, pageSize],
  )

  const { data: state } = trpc.supplier.devicePlatformProbe.getState.useQuery()
  const { data, isLoading, isFetching, error, refetch } =
    trpc.supplier.devicePlatformProbe.list.useQuery(queryInput, {
      retry: 1,
    })

  const runNowMutation = trpc.supplier.devicePlatformProbe.runNow.useMutation({
    onSuccess: (result) => {
      if (result.status === 'skipped') {
        toast.message('探测任务跳过（已有实例在运行）')
      } else if (result.status === 'failed') {
        toast.error('探测任务失败，请查看 job 日志')
      } else {
        toast.success(`探测完成（${result.status}）`)
      }
      void refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const stats = data?.stats ?? {
    total: 0,
    consistent: 0,
    needsAction: 0,
    notEvaluated: 0,
    cpuCount: 0,
    orphanCount: 0,
    missingCrmCount: 0,
  }
  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const snapshotHour = data?.snapshotHour

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="size-6" />
              设备平台存在状态
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              对比 CRM 主数据与接入端 / K8s / 裸金属订单，定位需处理的设备
            </p>
            {snapshotHour && (
              <p className="text-xs text-muted-foreground mt-1">
                当前快照：{formatSnapshotHourLabel(snapshotHour)}
                {state?.lastSuccessAt
                  ? ` · 上次成功探测 ${formatSnapshotHourLabel(state.lastSuccessAt)}`
                  : ''}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending || isFetching}
          >
            {runNowMutation.isPending || isFetching ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="size-4 mr-2" />
            )}
            立即探测
          </Button>
        </div>

        {!state?.enabled && (
          <Alert>
            <CircleHelp className="size-4" />
            <AlertTitle>定时探测未启用</AlertTitle>
            <AlertDescription>
              设置环境变量 <code className="text-xs">DEVICE_PLATFORM_PROBE_ENABLED=true</code>{' '}
              并配置 OpenAPI 凭证后，可通过「立即探测」或 Cron（默认每小时 :20）写入 snapshot。
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {!snapshotHour && !isLoading && (
          <Alert>
            <CircleHelp className="size-4" />
            <AlertTitle>暂无探测快照</AlertTitle>
            <AlertDescription>
              尚未执行过平台探测任务。点击「立即探测」生成首份 snapshot（需数据库迁移与 OpenAPI 配置）。
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">算力设备（本快照）</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-muted-foreground">{stats.cpuCount}</p>
              <p className="text-xs text-muted-foreground">CPU 设备（不参与比对）</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-violet-600 dark:text-violet-400">
                {stats.orphanCount}
              </p>
              <p className="text-xs text-muted-foreground">平台孤儿记录</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {stats.missingCrmCount}
              </p>
              <p className="text-xs text-muted-foreground">缺 CRM 主数据</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {stats.consistent}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                主数据与平台一致
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {stats.needsAction}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="size-3" />
                需处理
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-muted-foreground">{stats.notEvaluated}</p>
              <p className="text-xs text-muted-foreground">未评估（缺 IP / 机房 / 歧义）</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索 SN、内网 IP、机房、运维状态…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Select
              value={consistencyFilter}
              onValueChange={(v) => {
                setConsistencyFilter(v as typeof consistencyFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="对账结果" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部对账结果</SelectItem>
                {Object.entries(CONSISTENCY_FLAG_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={probeStatusFilter}
              onValueChange={(v) => {
                setProbeStatusFilter(v as typeof probeStatusFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="平台命中" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台命中</SelectItem>
                {Object.entries(PROBE_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={orphansOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setOrphansOnly((v) => !v)
                setPage(1)
              }}
            >
              仅看孤儿
            </Button>
            <Button
              variant={needsActionOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setNeedsActionOnly((v) => !v)
                setPage(1)
              }}
            >
              仅看需处理
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-scroll scrollbar-visible">
              <Table className="w-max min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px] max-w-[140px]">SN</TableHead>
                    <TableHead className="whitespace-nowrap">类型</TableHead>
                    <TableHead className="hidden md:table-cell whitespace-nowrap">内网 IP</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[80px] max-w-[120px]">机房</TableHead>
                    <TableHead className="hidden lg:table-cell whitespace-nowrap">CRM 运维态</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[140px]">所处位置</TableHead>
                    <TableHead className="hidden lg:table-cell whitespace-nowrap">接入端租赁态</TableHead>
                    <TableHead className="hidden md:table-cell whitespace-nowrap">平台命中</TableHead>
                    <TableHead className="whitespace-nowrap">对账</TableHead>
                    <TableHead className="whitespace-nowrap">建议处理</TableHead>
                    <TableHead className="hidden xl:table-cell whitespace-nowrap">快照时间</TableHead>
                    <TableHead className="w-[72px] whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                        <Loader2 className="size-5 animate-spin inline mr-2" />
                        加载中…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                        无匹配设备
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => <ProbeTableRow key={row.id} row={row} />)
                  )}
                </TableBody>
              </Table>
            </div>
            {total > 0 && (
              <div className="border-t p-4">
                <ListPagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">图例</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>平台命中</strong>：汇总接入端（device_info）、K8s（node_device）、裸金属订单三路命中情况
              </li>
              <li>
                <strong>接入端租赁态</strong>：由 <code>rent_status</code> +{' '}
                <code>is_container_instance</code> 推导（Idle→空闲；ElasticRenting+true→弹性服务；+false→裸金属）
              </li>
              <li>
                <strong>所处位置</strong>：CRM / 接入端 / K8s / 裸金属 四方存在矩阵；<strong>平台孤儿</strong>{' '}
                表示平台或订单有记录但 CRM 无对应库存设备
              </li>
              <li>
                <strong>对账</strong>：库存设备比较 CRM <code>ops_status</code> 与平台信号（CM-1）；孤儿记录标记为{' '}
                <strong>缺 CRM 主数据</strong>
              </li>
              <li>
                点击 <strong>详情</strong> 进入独立页面，横向比对 CRM 与三路 API 抓取数据，并查看设备变更记录
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

function ProbeTableRow({ row }: { row: DevicePlatformProbeRow }) {
  const rentLabel = formatProxyRentDisplay(
    row.proxyMatched,
    row.proxyRentStatus,
    row.proxyIsContainerInstance,
  )

  return (
    <TableRow
      className={
        ['missing_platform', 'unexpected_platform', 'multi_channel_conflict'].includes(
          row.consistencyFlag,
        )
          ? 'bg-amber-500/5'
          : undefined
      }
    >
      <TableCell className="font-mono text-xs max-w-[140px] truncate" title={row.sn}>
        {row.sn}
      </TableCell>
      <TableCell>
        <Badge variant={row.recordKind === 'platform_orphan' ? 'outline' : 'secondary'} className="font-normal">
          {RECORD_KIND_LABELS[row.recordKind]}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell font-mono text-xs whitespace-nowrap">
        {row.internalIp ?? '—'}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm max-w-[120px] truncate" title={row.dataCenterName ?? undefined}>
        {row.dataCenterName ?? '—'}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {row.opsStatus ? (
          <Badge variant="outline" className="font-normal">
            {row.opsStatus}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <PresenceBadges row={row} />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm cursor-default">{rentLabel}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {row.proxyMatched ? (
              <>
                rent_status={row.proxyRentStatus ?? '—'}
                <br />
                is_container_instance=
                {row.proxyIsContainerInstance === null
                  ? '—'
                  : String(row.proxyIsContainerInstance)}
              </>
            ) : (
              '未命中接入端'
            )}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="outline" className="font-normal">
          {PROBE_STATUS_LABELS[row.probeStatus]}
        </Badge>
        <p className="text-[11px] text-muted-foreground mt-0.5">{formatChannelHits(row)}</p>
      </TableCell>
      <TableCell>
        <ConsistencyBadge flag={row.consistencyFlag} />
      </TableCell>
      <TableCell>
        <SuggestedActionCell row={row} />
      </TableCell>
      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
        {formatSnapshotHourLabel(row.snapshotHour)}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
          <Link href={devicePlatformProbeDetailPath(row.id)}>
            <Eye className="size-4 mr-1" />
            详情
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}
