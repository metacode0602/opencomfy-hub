'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
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
import { Progress } from '@workspace/ui/components/progress'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { ACCESS_METHOD_OPTIONS, OPS_KIND_UI, onlineReasonLabel } from '@/lib/supplier-ops/ui-meta'
import type { SupplierOpsBatchKind } from '@/lib/types/supplier-ops-batch'
import type { OnboardingParsedRow } from '@/lib/types/supplier-domain'
import { DEVICE_COOPERATION_TYPE_LABELS } from '@/lib/types/supplier-domain'
import { trpc } from '@/lib/trpc/client'
import {
  batchKindFromRoute,
  IMPORT_STATUS_LABELS,
  LIFECYCLE_STATUS_COLORS,
  onboardingBatchDetailPath,
} from '@/lib/supplier/onboarding-batch-utils'
import type { OnboardingBatchDetailTask } from '@/lib/types/onboarding-batch-api'

type RouteKind = Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '加载失败，请稍后重试'
}

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  none: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
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
  const utils = trpc.useUtils()
  const ui = OPS_KIND_UI[routeKind]
  const expectedKind = batchKindFromRoute(routeKind)

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.onboardingBatch.getDetailPage.useQuery(
    { batchId },
    { retry: 1 },
  )

  const commitListMutation = trpc.supplier.onboardingBatch.commitList.useMutation({
    onSuccess: (result) => {
      toast.success(`已入库 ${result.committedCount} 台设备`)
      void utils.supplier.onboardingBatch.getDetailPage.invalidate({ batchId })
      void utils.supplier.onboardingBatch.list.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const [activeTab, setActiveTab] = useState<string | null>(null)

  const batch = detail?.batch
  const progress = detail?.progress
  const devices = detail?.devices ?? []
  const tasks = detail?.tasks ?? []

  const parsedRows = useMemo(() => {
    const rows = batch?.parsedRowsJson
    if (!Array.isArray(rows) || rows.length === 0) return []
    return rows as OnboardingParsedRow[]
  }, [batch])

  const parseStats = useMemo(() => {
    const ok = parsedRows.filter((r) => r.parse_status === 'ok').length
    const warn = parsedRows.filter((r) => r.parse_status === 'warning').length
    const err = parsedRows.filter((r) => r.parse_status === 'error').length
    return { ok, warn, err }
  }, [parsedRows])

  const defaultTab = useMemo(() => {
    if (!batch) return 'progress'
    if (batch.importStatus !== 'none' && parsedRows.length > 0) return 'import'
    return 'progress'
  }, [batch, parsedRows.length])

  const currentTab = activeTab ?? defaultTab

  const onlineRate = useMemo(() => {
    if (!progress?.planned) return 0
    return Math.min(100, (progress.online / progress.planned) * 100)
  }, [progress])

  const handleCommit = () => {
    if (!batch) return
    commitListMutation.mutate({ batchId: batch.id })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载批次详情...
      </div>
    )
  }

  if (isError) {
    const isNotFound = error?.data?.code === 'NOT_FOUND'
    return (
      <div className="space-y-4">
        <Link href={ui.basePath}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回{ui.title}
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{isNotFound ? '未找到该批次，可能尚未创建或 ID 无效' : getErrorMessage(error)}</span>
            {!isNotFound && (
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                重试
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!batch || !progress) {
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

  if (batch.batchKind !== expectedKind) {
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

  const hasImport = batch.importStatus !== 'none'

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
              <h1 className="text-2xl font-semibold">{batch.batchCode}</h1>
              <Badge variant="outline" className={importStatusColor[batch.importStatus] ?? ''}>
                {IMPORT_STATUS_LABELS[batch.importStatus] ?? batch.importStatus}
              </Badge>
              <Badge variant="secondary">{batch.batchStatus}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {batch.supplierShortName} · {batch.idcCode} · {batch.dataCenterName}
              {batch.workOrderNo ? ` · 工单 ${batch.workOrderNo}` : ''}
            </p>
          </div>
        </div>
        {batch.importStatus === 'parsed' && (
          <Button
            className="gap-2"
            disabled={commitListMutation.isPending}
            onClick={handleCommit}
          >
            {commitListMutation.isPending ? (
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
            <p className="text-sm text-muted-foreground">计划上架</p>
            <p className="text-2xl font-semibold mt-1">{progress.planned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已关联</p>
            <p className="text-2xl font-semibold mt-1">{progress.linked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已上线</p>
            <p className="text-2xl font-semibold mt-1">{progress.online}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">计划完成</p>
            <p className="text-sm font-medium mt-2">{formatDt(batch.plannedReadyAt)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">上线进度</span>
            <span className="font-medium">
              {progress.online} / {progress.planned} 台（{onlineRate.toFixed(0)}%）
            </span>
          </div>
          <Progress value={onlineRate} className="h-2" />
        </CardContent>
      </Card>

      <Tabs value={currentTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="progress">上架进度</TabsTrigger>
          {hasImport && <TabsTrigger value="import">导入明细</TabsTrigger>}
          <TabsTrigger value="overview">批次概览</TabsTrigger>
          <TabsTrigger value="devices">已入库设备 ({devices.length})</TabsTrigger>
          <TabsTrigger value="tasks">关联任务 ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4 mt-4">
          {progress.planLines.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无上架计划明细
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>卡型</TableHead>
                      <TableHead>合作类型</TableHead>
                      <TableHead className="text-right">计划</TableHead>
                      <TableHead className="text-right">已关联</TableHead>
                      <TableHead className="text-right">已上线</TableHead>
                      <TableHead>进度</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {progress.planLines.map((line) => {
                      const lineRate =
                        line.plannedQuantity > 0
                          ? Math.min(100, (line.online / line.plannedQuantity) * 100)
                          : 0
                      const lineKey = `${line.gpuCardTypeId}-${line.cooperationType}`
                      return (
                        <TableRow key={lineKey}>
                          <TableCell className="font-medium">{line.gpuCardTypeCode}</TableCell>
                          <TableCell>
                            {DEVICE_COOPERATION_TYPE_LABELS[line.cooperationType]}
                          </TableCell>
                          <TableCell className="text-right">{line.plannedQuantity}</TableCell>
                          <TableCell className="text-right">{line.linked}</TableCell>
                          <TableCell className="text-right">{line.online}</TableCell>
                          <TableCell className="min-w-[120px]">
                            <Progress value={lineRate} className="h-1.5" />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {hasImport && (
          <TabsContent value="import" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  清单文件
                </CardTitle>
                <CardDescription>
                  {batch.importFileName ?? '未上传'}
                  {batch.parsedAt ? ` · 解析于 ${formatDt(batch.parsedAt)}` : ''}
                  {batch.committedAt ? ` · 入库于 ${formatDt(batch.committedAt)}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">解析行数 </span>
                  <span className="font-medium">{batch.parsedRowCount}</span>
                </div>
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
                <div>
                  <span className="text-muted-foreground">已入库 </span>
                  <span className="font-medium">{batch.committedDeviceCount}</span>
                </div>
              </CardContent>
            </Card>

            {parsedRows.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {batch.importStatus === 'draft'
                    ? '清单尚未上传，请在创建流程中上传 CSV'
                    : '暂无解析数据'}
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
        )}

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">供应商</p>
                  <p className="font-medium mt-1">{batch.supplierName}</p>
                  <p className="text-xs text-muted-foreground">{batch.supplierCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">机房</p>
                  <p className="font-medium mt-1">{batch.dataCenterName}</p>
                  <p className="text-xs text-muted-foreground">
                    {batch.idcCode} · {batch.idcRegion}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">接入方式</p>
                  <p className="font-medium mt-1">
                    {ACCESS_METHOD_OPTIONS.find((o) => o.value === batch.accessMethod)?.label ??
                      batch.accessMethod}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">商务合同</p>
                  <p className="font-medium mt-1">
                    {detail.contractNo ?? (batch.contractId ? batch.contractId : '未关联')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">工单号</p>
                  <p className="font-medium mt-1 font-mono text-xs">
                    {batch.workOrderNo ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">计划完成时间</p>
                  <p className="font-medium mt-1">{formatDt(batch.plannedReadyAt)}</p>
                </div>
                {batch.batchKind === 'online' && (
                  <>
                    <div>
                      <p className="text-muted-foreground">上架原因</p>
                      <p className="font-medium mt-1">{onlineReasonLabel(batch.onlineReason)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">备注</p>
                      <p className="font-medium mt-1 whitespace-pre-wrap">
                        {batch.remark?.trim() || '—'}
                      </p>
                    </div>
                  </>
                )}
                {batch.batchKind === 'order_access' && (
                  <>
                    <div>
                      <p className="text-muted-foreground">订单编号</p>
                      <p className="font-medium mt-1 font-mono">{batch.orderNo ?? '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">备注</p>
                      <p className="font-medium mt-1 whitespace-pre-wrap">
                        {batch.remark?.trim() || '—'}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p className="font-medium mt-1">{formatDt(batch.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">最近更新</p>
                  <p className="font-medium mt-1">{formatDt(batch.updatedAt)}</p>
                </div>
              </div>
              {batch.parseError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>解析错误：{batch.parseError}</AlertDescription>
                </Alert>
              )}
              <Link
                href={`/supplier/suppliers/${batch.supplierId}`}
                className="text-primary text-sm inline-flex items-center gap-1"
              >
                供应商详情
                <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          {devices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {batch.importStatus === 'committed'
                  ? '暂无关联设备记录'
                  : batch.importStatus === 'none'
                    ? '本批次未上传清单，设备将在后续接入流程中关联'
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
                    <TableHead>卡型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>子阶段</TableHead>
                    <TableHead>内网 IP</TableHead>
                    <TableHead>公网 IP</TableHead>
                    <TableHead>合作类型</TableHead>
                    <TableHead>设备用途</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.sn}</TableCell>
                      <TableCell className="font-mono text-xs">{d.assetNo ?? '—'}</TableCell>
                      <TableCell>{d.cardTypeCode ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={LIFECYCLE_STATUS_COLORS[d.lifecycleStatus] ?? ''}
                        >
                          {d.lifecycleStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.onboardingSubstage ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.internalIp ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.externalIp ?? '—'}</TableCell>
                      <TableCell>{d.cooperationType ?? '—'}</TableCell>
                      <TableCell>{d.devicePurpose ?? '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/supplier/devices/${d.id}`}>详情</Link>
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
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无关联任务；入库后将自动创建批次联调任务
              </CardContent>
            </Card>
          ) : (
            tasks.map((t) => <OnboardingTaskCard key={t.id} task={t} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OnboardingTaskCard({ task }: { task: OnboardingBatchDetailTask }) {
  const deviceLabel = task.deviceSn ?? (task.supplierDeviceId ? task.supplierDeviceId : '批次级')
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{task.taskType}</CardTitle>
        <CardDescription>
          {task.assigneeName ?? task.assigneeStaffId} · {task.taskStatus} · {deviceLabel}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
