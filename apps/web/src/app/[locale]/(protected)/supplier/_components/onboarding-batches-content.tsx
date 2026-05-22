'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Eye,
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
import type { OnboardingBatch, OnboardingParsedRow, SupplierActivity } from '@/lib/types/supplier-domain'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import {
  batchKindFromRoute,
  buildDevicesFromBatch,
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

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
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
  const ui = OPS_KIND_UI[routeKind]
  const batchKind = batchKindFromRoute(routeKind)
  const isOnlineTasks = routeKind === 'online-tasks'
  const isOrderAccess = routeKind === 'order-access'

  const onboardingBatches = useSupplierDomainMockStore((s) => s.onboardingBatches)
  const batches = useMemo(
    () => onboardingBatches.filter((b) => b.batch_kind === batchKind),
    [onboardingBatches, batchKind],
  )
  const upsertOnboardingBatch = useSupplierDomainMockStore((s) => s.upsertOnboardingBatch)
  const upsertDevice = useSupplierDomainMockStore((s) => s.upsertDevice)
  const upsertOnboardingTask = useSupplierDomainMockStore((s) => s.upsertOnboardingTask)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const upsertEntityStateTransitionLog = useSupplierDomainMockStore((s) => s.upsertEntityStateTransitionLog)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [importFilter, setImportFilter] = useState('all')
  const [wizardOpen, setWizardOpen] = useState(false)

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      const q = search.trim().toLowerCase()
      const matchQ =
        !q ||
        b.batch_code.toLowerCase().includes(q) ||
        b.supplier_name.toLowerCase().includes(q) ||
        b.idc_code.toLowerCase().includes(q) ||
        (b.order_no?.toLowerCase().includes(q) ?? false)
      const matchStatus = statusFilter === 'all' || b.batch_status === statusFilter
      const matchImport = importFilter === 'all' || b.import_status === importFilter
      return matchQ && matchStatus && matchImport
    })
  }, [batches, search, statusFilter, importFilter])

  const stats = useMemo(() => {
    return {
      total: batches.length,
      onboarding: batches.filter((b) => b.batch_status === '接入中').length,
      committed: batches.filter((b) => b.import_status === 'committed').length,
      pendingParse: batches.filter((b) => b.import_status === 'parsed').length,
    }
  }, [batches])

  const commitBatch = (batch: OnboardingBatch) => {
    if (batch.batch_kind !== 'online' && batch.batch_kind !== 'order_access') {
      toast.error('该批次类型请使用「运维导入」确认入库')
      return
    }
    if (!batch.parsed_rows_json?.length) {
      toast.error('无解析数据，无法入库')
      return
    }
    const rows = batch.parsed_rows_json as OnboardingParsedRow[]
    const newDevices = buildDevicesFromBatch({
      batchId: batch.id,
      supplierId: batch.supplier_id,
      contractId: batch.contract_id,
      dataCenterId: batch.data_center_id,
      idcCode: batch.idc_code,
      idcRegion: batch.idc_region,
      cardTypeDefault: 'A100-80G',
      rows,
      createId,
    })
    for (const d of newDevices) {
      upsertDevice(d)
      upsertEntityStateTransitionLog({
        id: createId('esl'),
        entity_type: 'device',
        entity_id: d.id,
        from_state: '待接入',
        to_state: '接入中',
        operator_id: 'staff-mock-01',
        reason_code: 'BATCH_COMMITTED',
        occurred_at: new Date().toISOString(),
      })
    }
    upsertOnboardingTask({
      id: createId('task'),
      onboarding_batch_id: batch.id,
      device_id: null,
      task_type: '批次联调',
      assignee_id: 'staff-mock-02',
      task_status: '待开始',
      started_at: null,
      finished_at: null,
    })
    const now = new Date().toISOString()
    upsertOnboardingBatch({
      ...batch,
      import_status: 'committed',
      batch_status: '接入中',
      committed_device_count: newDevices.length,
      committed_at: now,
      updated_at: now,
    })
    const activity: SupplierActivity = {
      id: createId('act'),
      supplier_id: batch.supplier_id,
      type: 'ops_import',
      title: `${ui.title}批次 ${batch.batch_code} 已入库`,
      description: `共入库 ${newDevices.length} 台物理机`,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'batch',
      ref_id: batch.id,
      occurred_at: now,
    }
    upsertSupplierActivity(activity)
    toast.success(`已入库 ${newDevices.length} 台设备`)
  }

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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOnlineTasks || isOrderAccess ? 8 : 7} className="text-center text-muted-foreground py-12">
                  暂无批次，点击右上角新建
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
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
                  <TableCell>
                    <Badge variant="outline" className={importStatusColor[b.import_status] ?? ''}>
                      {IMPORT_STATUS_LABELS[b.import_status] ?? b.import_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{b.batch_status}</TableCell>
                  <TableCell>
                    {b.committed_device_count}
                    {b.parsed_success_count > 0 ? ` / ${b.parsed_success_count}` : ''}
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
                          <DropdownMenuItem onClick={() => commitBatch(b)}>
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
