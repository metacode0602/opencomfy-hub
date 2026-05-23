'use client'

import Link from 'next/link'
import { ArrowLeft, FileSpreadsheet, Loader2 } from 'lucide-react'
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
import { trpc } from '@/lib/trpc/client'
import { DEVICE_RETIRE_IMPORT_STATUS_LABELS } from '@/lib/types/device-retire'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  parsed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  committed: 'bg-green-500/20 text-green-400 border-green-500/30',
  parse_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  committing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const parseStatusColor: Record<string, string> = {
  ok: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const parseStatusLabel: Record<string, string> = {
  ok: '通过',
  warning: '告警',
  error: '错误',
}

const lifecycleColors: Record<string, string> = {
  ...LIFECYCLE_STATUS_COLORS,
  已下线: 'bg-red-500/20 text-red-400 border-red-500/30',
  退订: 'bg-red-500/20 text-red-400 border-red-500/30',
}

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

export function DeviceRetireBatchDetailContent({ batchId }: { batchId: string }) {
  const { data: batch, isLoading, isError } = trpc.supplier.deviceRetire.getBatchById.useQuery({
    id: batchId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载批次详情...
      </div>
    )
  }

  if (isError || !batch) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/offline-tasks">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回设备下架
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            未找到该下架批次
          </CardContent>
        </Card>
      </div>
    )
  }

  const parseStats = {
    ok: batch.parsedRows.filter((r) => r.parse_status === 'ok').length,
    warn: batch.parsedRows.filter((r) => r.parse_status === 'warning').length,
    err: batch.parsedRows.filter((r) => r.parse_status === 'error').length,
  }

  const progressPercent =
    batch.plannedDeviceCount > 0
      ? Math.min(100, Math.round((batch.touchedDeviceCount / batch.plannedDeviceCount) * 100))
      : 0
  const flags = batch.progressFlags

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/supplier/offline-tasks">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{batch.batchCode}</h1>
            {batch.scenarioLabel && (
              <Badge variant="outline">{batch.scenarioLabel}</Badge>
            )}
            <Badge variant="outline" className={importStatusColor[batch.importStatus] ?? ''}>
              {DEVICE_RETIRE_IMPORT_STATUS_LABELS[batch.importStatus] ?? batch.importStatus}
            </Badge>
            <Badge variant="secondary">{batch.batchStatus}</Badge>
            {flags?.needs_review && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                待复核
              </Badge>
            )}
            {flags?.has_action_mismatch && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                动作不一致
              </Badge>
            )}
            {flags?.completion_mode === 'auto' && batch.batchStatus === '已完成' && (
              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                自动完成
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {batch.supplierShortName ?? batch.supplierName} · {batch.idcCode} ·{' '}
            {batch.dataCenterName}
            {batch.workOrderNo ? ` · 工单 ${batch.workOrderNo}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">计划数量</p>
            <p className="text-2xl font-semibold mt-1">{batch.plannedDeviceCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已挂接</p>
            <p className="text-2xl font-semibold mt-1">
              {batch.touchedDeviceCount}
              {batch.plannedDeviceCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({progressPercent}%)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已退订/下线中</p>
            <p className="text-2xl font-semibold mt-1">{batch.retiredDeviceCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">建议清单行</p>
            <p className="text-2xl font-semibold mt-1">{batch.parsedRowCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">已执行设备 ({batch.devices.length})</TabsTrigger>
          <TabsTrigger value="import">建议清单 ({batch.parsedRows.length})</TabsTrigger>
          <TabsTrigger value="overview">批次概览</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-4">
          {batch.devices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无已通过变更表挂接的设备；请运维导入变更表后刷新本页
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>行号</TableHead>
                    <TableHead>SN</TableHead>
                    <TableHead>设备ID</TableHead>
                    <TableHead>外网IP</TableHead>
                    <TableHead>内网IP</TableHead>
                    <TableHead>卡型</TableHead>
                    <TableHead>原状态</TableHead>
                    <TableHead>当前状态</TableHead>
                    <TableHead>运维状态</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.devices.map((d) => (
                    <TableRow key={`${d.deviceId}-${d.rowNo ?? 0}`}>
                      <TableCell className="text-muted-foreground">{d.rowNo ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.sn}</TableCell>
                      <TableCell className="font-mono text-xs">{d.externalDeviceId ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.externalIp ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.internalIp ?? '—'}</TableCell>
                      <TableCell className="text-sm">{d.cardTypeName}</TableCell>
                      <TableCell>
                        {d.previousLifecycleStatus ? (
                          <Badge variant="outline" className="text-xs">
                            {d.previousLifecycleStatus}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={lifecycleColors[d.lifecycleStatus] ?? ''}
                        >
                          {d.lifecycleStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{d.opsStatus}</TableCell>
                      <TableCell>
                        {d.deviceId !== '—' && !d.deviceId.startsWith('—') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/supplier/devices/${d.deviceId}`}>详情</Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                清单文件
              </CardTitle>
              <CardDescription>
                {batch.importFileName ?? '—'} · 解析于 {formatDt(batch.parsedAt)} · 提交于{' '}
                {formatDt(batch.committedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <div>
                通过 <span className="font-medium text-green-500">{parseStats.ok}</span>
              </div>
              {parseStats.warn > 0 && (
                <div>
                  告警 <span className="font-medium text-yellow-500">{parseStats.warn}</span>
                </div>
              )}
              {parseStats.err > 0 && (
                <div>
                  错误 <span className="font-medium text-destructive">{parseStats.err}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">行</TableHead>
                    <TableHead>设备ID</TableHead>
                    <TableHead>设备标识</TableHead>
                    <TableHead>外网IP</TableHead>
                    <TableHead>内网IP</TableHead>
                    <TableHead>校验</TableHead>
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.parsedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        无解析数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    batch.parsedRows.map((r) => (
                      <TableRow key={r.row_no}>
                        <TableCell>{r.row_no}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.external_device_id ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.asset_no ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.external_ip ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.internal_ip ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={parseStatusColor[r.parse_status] ?? ''}>
                            {parseStatusLabel[r.parse_status] ?? r.parse_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          {r.errors.length > 0 && (
                            <span className="text-red-400">{r.errors.join('；')}</span>
                          )}
                          {r.errors.length === 0 && r.warnings.length > 0 && (
                            <span className="text-yellow-400">{r.warnings.join('；')}</span>
                          )}
                          {r.errors.length === 0 && r.warnings.length === 0 && (
                            <span className="text-muted-foreground">可下架</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">供应商</p>
                  <p className="font-medium mt-1">{batch.supplierName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">机房</p>
                  <p className="font-medium mt-1">{batch.dataCenterName}</p>
                  <p className="text-xs text-muted-foreground">
                    {batch.idcCode} · {batch.idcRegion ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">下架原因</p>
                  <p className="font-medium mt-1">{batch.retireReasonLabel ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">场景</p>
                  <p className="font-medium mt-1">{batch.scenarioLabel ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">飞书工单</p>
                  <p className="font-medium mt-1">{batch.workOrderNo ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">期望完成日期</p>
                  <p className="font-medium mt-1">{batch.expectedCompletionDate ?? '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">备注</p>
                  <p className="font-medium mt-1">{batch.retireRemark || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p className="font-medium mt-1">{formatDt(batch.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">提交时间</p>
                  <p className="font-medium mt-1">{formatDt(batch.committedAt)}</p>
                </div>
              </div>
              <Link
                href={`/supplier/suppliers/${batch.supplierId}`}
                className="text-primary text-sm inline-flex items-center gap-1"
              >
                查看供应商详情
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
