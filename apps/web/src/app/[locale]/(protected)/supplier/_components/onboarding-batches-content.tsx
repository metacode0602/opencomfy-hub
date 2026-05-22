'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Eye,
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
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { OPS_KIND_UI, onlineReasonLabel } from '@/lib/supplier-ops/ui-meta'
import type { SupplierOpsBatchKind } from '@/lib/types/supplier-ops-batch'
import { trpc } from '@/lib/trpc/client'
import {
  batchKindFromRoute,
  IMPORT_STATUS_LABELS,
  onboardingBatchDetailPath,
} from '@/lib/supplier/onboarding-batch-utils'
import { OnboardingBatchWizardDialog } from './onboarding-batch-wizard-dialog'

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

function formatPlanSummary(
  lines: Array<{ gpu_card_type_code: string; planned_quantity: number }> | null | undefined,
) {
  if (!lines?.length) return '—'
  return lines.map((l) => `${l.gpu_card_type_code}×${l.planned_quantity}`).join('、')
}

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  none: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  parsed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  committed: 'bg-green-500/20 text-green-400 border-green-500/30',
  parse_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export function OnboardingBatchesContent({
  routeKind,
}: {
  routeKind: Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>
}) {
  const utils = trpc.useUtils()
  const ui = OPS_KIND_UI[routeKind]
  const batchKind = batchKindFromRoute(routeKind) as 'online' | 'order_access'
  const isOnlineTasks = routeKind === 'online-tasks'
  const isOrderAccess = routeKind === 'order-access'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [importFilter, setImportFilter] = useState('all')
  const [wizardOpen, setWizardOpen] = useState(false)

  const { data, isLoading, isError } = trpc.supplier.onboardingBatch.list.useQuery({
    batchKind,
    search: search.trim() || undefined,
    batchStatus: statusFilter,
    importStatus: importFilter,
  })

  const commitListMutation = trpc.supplier.onboardingBatch.commitList.useMutation({
    onSuccess: (result) => {
      toast.success(`已入库 ${result.committedCount} 台设备`)
      void utils.supplier.onboardingBatch.list.invalidate({ batchKind })
    },
    onError: (e) => toast.error(e.message),
  })

  const batches = data?.items ?? []

  const stats = useMemo(() => {
    return {
      total: batches.length,
      onboarding: batches.filter((b) => b.batch_status === '接入中').length,
      committed: batches.filter((b) => b.import_status === 'committed').length,
      pendingParse: batches.filter((b) => b.import_status === 'parsed').length,
    }
  }, [batches])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{ui.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ui.description}</p>
        </div>
        <Button className="gap-2" onClick={() => setWizardOpen(true)}>
          <Plus className="w-4 h-4" />
          {ui.dialogTitle}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
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

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索批次号、供应商、机房..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="批次状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="待开始">待开始</SelectItem>
              <SelectItem value="接入中">接入中</SelectItem>
              <SelectItem value="已完成">已完成</SelectItem>
            </SelectContent>
          </Select>
          <Select value={importFilter} onValueChange={setImportFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="导入状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部导入</SelectItem>
              <SelectItem value="none">未上传清单</SelectItem>
              <SelectItem value="parsed">待确认入库</SelectItem>
              <SelectItem value="committed">已入库</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>批次号</TableHead>
              <TableHead>供应商 / 机房</TableHead>
              <TableHead>上架计划</TableHead>
              <TableHead>导入状态</TableHead>
              <TableHead>批次状态</TableHead>
              <TableHead>已入库</TableHead>
              {isOnlineTasks && <TableHead>上架原因</TableHead>}
              {isOrderAccess && <TableHead>订单编号</TableHead>}
              <TableHead>计划就绪</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isOnlineTasks || isOrderAccess ? 9 : 8} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={isOnlineTasks || isOrderAccess ? 9 : 8} className="text-center text-destructive py-12">
                  加载失败，请稍后重试
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOnlineTasks || isOrderAccess ? 9 : 8} className="text-center text-muted-foreground py-12">
                  暂无批次，点击右上角新建
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={onboardingBatchDetailPath(b)}
                      className="text-primary hover:underline"
                    >
                      {b.batch_code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{b.supplier_short_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.idc_code} · {b.data_center_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={formatPlanSummary(b.planned_lines)}>
                    {b.planned_device_count ?? 0} 台 · {formatPlanSummary(b.planned_lines)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={importStatusColor[b.import_status] ?? ''}>
                      {IMPORT_STATUS_LABELS[b.import_status] ?? b.import_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{b.batch_status}</TableCell>
                  <TableCell>
                    {b.committed_device_count}
                    {(b.planned_device_count ?? 0) > 0 ? ` / ${b.planned_device_count}` : ''}
                  </TableCell>
                  {isOnlineTasks && (
                    <TableCell className="text-sm">
                      {onlineReasonLabel(b.online_reason)}
                    </TableCell>
                  )}
                  {isOrderAccess && (
                    <TableCell className="text-sm font-mono">
                      {b.order_no ?? '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDt(b.planned_ready_at)}
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
                        {b.import_status === 'parsed' && (
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <OnboardingBatchWizardDialog
        routeKind={routeKind}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
    </div>
  )
}
