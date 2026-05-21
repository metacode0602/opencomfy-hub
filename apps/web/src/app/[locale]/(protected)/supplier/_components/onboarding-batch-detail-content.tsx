'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
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
import { ACCESS_METHOD_OPTIONS, OPS_KIND_UI } from '@/lib/supplier-ops/ui-meta'
import type { SupplierOpsBatchKind } from '@/lib/types/supplier-ops-batch'
import type {
  OnboardingParsedRow,
  OnboardingTask,
  SupplierActivity,
} from '@/lib/types/supplier-domain'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import {
  batchKindFromRoute,
  buildDevicesFromBatch,
  IMPORT_STATUS_LABELS,
  LIFECYCLE_STATUS_COLORS,
  onboardingBatchDetailPath,
} from '@/lib/supplier/onboarding-batch-utils'
import { useAssigneeLabel, useDeviceLabel } from '@/lib/supplier/supplier-domain-lookups'

type RouteKind = Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>

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

const parseStatusColor: Record<string, string> = {
  ok: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const parseStatusLabel: Record<string, string> = {
  ok: '通过',
  warning: '警告',
  error: '失败',
}

export function OnboardingBatchDetailContent({
  batchId,
  routeKind,
}: {
  batchId: string
  routeKind: RouteKind
}) {
  const ui = OPS_KIND_UI[routeKind]
  const expectedKind = batchKindFromRoute(routeKind)

  const batch = useSupplierDomainMockStore((s) =>
    s.onboardingBatches.find((b) => b.id === batchId),
  )
  const devices = useSupplierDomainMockStore((s) => s.devices)
  const tasks = useSupplierDomainMockStore((s) => s.onboardingTasks)
  const upsertOnboardingBatch = useSupplierDomainMockStore((s) => s.upsertOnboardingBatch)
  const upsertDevice = useSupplierDomainMockStore((s) => s.upsertDevice)
  const upsertOnboardingTask = useSupplierDomainMockStore((s) => s.upsertOnboardingTask)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const upsertEntityStateTransitionLog = useSupplierDomainMockStore((s) => s.upsertEntityStateTransitionLog)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [committing, setCommitting] = useState(false)

  const detailDevices = useMemo(
    () => (batch ? devices.filter((d) => d.onboarding_batch_id === batch.id) : []),
    [batch, devices],
  )
  const detailTasks = useMemo(
    () => (batch ? tasks.filter((t) => t.onboarding_batch_id === batch.id) : []),
    [batch, tasks],
  )

  const parsedRows = useMemo(() => {
    if (!batch?.parsed_rows_json?.length) return []
    return batch.parsed_rows_json as OnboardingParsedRow[]
  }, [batch])

  const parseStats = useMemo(() => {
    const ok = parsedRows.filter((r) => r.parse_status === 'ok').length
    const warn = parsedRows.filter((r) => r.parse_status === 'warning').length
    const err = parsedRows.filter((r) => r.parse_status === 'error').length
    return { ok, warn, err }
  }, [parsedRows])

  const commitBatch = () => {
    if (!batch) return
    if (batch.batch_kind !== 'online' && batch.batch_kind !== 'order_access') {
      toast.error('该批次类型请使用「运维导入」确认入库')
      return
    }
    if (!batch.parsed_rows_json?.length) {
      toast.error('无解析数据，无法入库')
      return
    }
    setCommitting(true)
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
    setCommitting(false)
    toast.success(`已入库 ${newDevices.length} 台设备`)
  }

  if (!batch) {
    return (
      <div className="space-y-4">
        <Link href={ui.basePath}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回{ui.title}
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            未找到该批次，可能尚未创建或 ID 无效
          </CardContent>
        </Card>
      </div>
    )
  }

  if (batch.batch_kind !== expectedKind) {
    const correctPath = onboardingBatchDetailPath(batch)
    return (
      <div className="space-y-4">
        <Link href={ui.basePath}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回{ui.title}
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-4">
            <p>该批次不属于当前模块，请从对应入口查看。</p>
            <Button variant="outline" asChild>
              <Link href={correctPath}>前往正确详情页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href={ui.basePath}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">{batch.batch_code}</h1>
              <Badge variant="outline" className={importStatusColor[batch.import_status] ?? ''}>
                {IMPORT_STATUS_LABELS[batch.import_status] ?? batch.import_status}
              </Badge>
              <Badge variant="secondary">{batch.batch_status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {batch.supplier_short_name} · {batch.idc_code} · {batch.data_center_name}
            </p>
          </div>
        </div>
        {batch.import_status === 'parsed' && (
          <Button className="gap-2" disabled={committing} onClick={commitBatch}>
            {committing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            确认入库
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">解析行数</p>
            <p className="text-2xl font-semibold mt-1">{batch.parsed_row_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">校验通过</p>
            <p className="text-2xl font-semibold mt-1">{parseStats.ok}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已入库设备</p>
            <p className="text-2xl font-semibold mt-1">
              {batch.committed_device_count}
              {batch.parsed_success_count > 0 ? ` / ${batch.parsed_success_count}` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">计划就绪</p>
            <p className="text-sm font-medium mt-2">{formatDt(batch.planned_ready_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">导入明细</TabsTrigger>
          <TabsTrigger value="overview">批次概览</TabsTrigger>
          <TabsTrigger value="devices">已入库设备 ({detailDevices.length})</TabsTrigger>
          <TabsTrigger value="tasks">关联任务 ({detailTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                清单文件
              </CardTitle>
              <CardDescription>
                {batch.import_file_name} · 解析于 {formatDt(batch.parsed_at)}
                {batch.committed_at ? ` · 入库于 ${formatDt(batch.committed_at)}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">通过 </span>
                <span className="font-medium text-green-500">{parseStats.ok}</span>
              </div>
              {parseStats.warn > 0 && (
                <div>
                  <span className="text-muted-foreground">警告 </span>
                  <span className="font-medium text-yellow-500">{parseStats.warn}</span>
                </div>
              )}
              {parseStats.err > 0 && (
                <div>
                  <span className="text-muted-foreground">失败 </span>
                  <span className="font-medium text-destructive">{parseStats.err}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {parsedRows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无解析数据，请先在列表页完成 CSV 上传与解析
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">行</TableHead>
                        <TableHead>公网 IP</TableHead>
                        <TableHead>内网 IP</TableHead>
                        <TableHead>账号</TableHead>
                        <TableHead>密码</TableHead>
                        <TableHead>SN</TableHead>
                        <TableHead>资产号</TableHead>
                        <TableHead>GPU</TableHead>
                        <TableHead>卡型</TableHead>
                        <TableHead>校验</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((r) => (
                        <TableRow key={r.row_no}>
                          <TableCell>{r.row_no}</TableCell>
                          <TableCell className="font-mono text-xs">{r.public_ip}</TableCell>
                          <TableCell className="font-mono text-xs">{r.private_ip}</TableCell>
                          <TableCell>{r.root_account}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.root_password}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.sn ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.asset_no ?? '—'}</TableCell>
                          <TableCell>{r.gpu_count ?? '—'}</TableCell>
                          <TableCell>{r.card_type_code ?? '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={parseStatusColor[r.parse_status] ?? ''}
                            >
                              {parseStatusLabel[r.parse_status] ?? r.parse_status}
                            </Badge>
                            {r.parse_message && (
                              <p className="text-xs text-muted-foreground mt-1 max-w-[140px]">
                                {r.parse_message}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">供应商</p>
                  <p className="font-medium mt-1">{batch.supplier_name}</p>
                  <p className="text-xs text-muted-foreground">{batch.supplier_code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">机房</p>
                  <p className="font-medium mt-1">{batch.data_center_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {batch.idc_code} · {batch.idc_region}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">接入方式</p>
                  <p className="font-medium mt-1">
                    {ACCESS_METHOD_OPTIONS.find((o) => o.value === batch.access_method)?.label ??
                      batch.access_method}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">合同 / 接入条件</p>
                  <p className="font-medium mt-1 font-mono text-xs">{batch.contract_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p className="font-medium mt-1">{formatDt(batch.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">最近更新</p>
                  <p className="font-medium mt-1">{formatDt(batch.updated_at)}</p>
                </div>
              </div>
              {batch.parse_error && (
                <p className="text-sm text-destructive">解析错误：{batch.parse_error}</p>
              )}
              <Link
                href={`/supplier/suppliers/${batch.supplier_id}`}
                className="text-primary text-sm inline-flex items-center gap-1"
              >
                供应商详情
                <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          {detailDevices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {batch.import_status === 'committed'
                  ? '暂无关联设备记录'
                  : '确认入库后将在此展示物理机列表'}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SN</TableHead>
                    <TableHead>资产号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>子阶段</TableHead>
                    <TableHead>公网 IP</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailDevices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.sn}</TableCell>
                      <TableCell className="font-mono text-xs">{d.asset_no}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={LIFECYCLE_STATUS_COLORS[d.lifecycle_status] ?? ''}
                        >
                          {d.lifecycle_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.onboarding_substage}</TableCell>
                      <TableCell className="font-mono text-xs">{d.external_ip}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/supplier/devices/machines/${d.id}`}>详情</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-3">
          {detailTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                入库后将自动创建批次联调任务
              </CardContent>
            </Card>
          ) : (
            detailTasks.map((t) => <OnboardingTaskCard key={t.id} task={t} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OnboardingTaskCard({ task }: { task: OnboardingTask }) {
  const assignee = useAssigneeLabel(task.assignee_id)
  const deviceLabel = useDeviceLabel(task.device_id ?? '')
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{task.task_type}</CardTitle>
        <CardDescription>
          {assignee} · {task.task_status}
          {task.device_id ? ` · ${deviceLabel}` : ' · 批次级'}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
