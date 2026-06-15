'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Server,
  Shield,
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
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
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
import { DEVICE_COOPERATION_TYPE_LABELS } from '@/lib/data/types'
import type { PhysicalDeviceFlowRecord, PhysicalDeviceFlowRecordKind } from '@/lib/data/types'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'
import { trpc } from '@/lib/trpc/client'

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

const reasonLabels: Record<string, string> = {
  BATCH_COMMITTED: '批次入库',
  ONBOARDING_DONE: '接入完成',
  SUBSTAGE_RACKING: '子阶段推进',
  OPS_STATUS_CHANGE: '运营变更',
}

const flowKindLabels: Record<PhysicalDeviceFlowRecordKind, string> = {
  state_transition: '状态流转',
  changelog_import: '变更导入',
  activity: '运营事件',
}

const flowKindColors: Record<PhysicalDeviceFlowRecordKind, string> = {
  state_transition: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  changelog_import: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  activity: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

function onboardingBatchHref(batchKind: string | null, batchId: string | null): string | null {
  if (!batchKind || !batchId) return null
  switch (batchKind) {
    case 'online':
      return `/supplier/online-tasks/${batchId}`
    case 'order_access':
      return `/supplier/order-access/${batchId}`
    case 'device_retire':
      return `/supplier/offline-tasks/${batchId}`
    default:
      return null
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '加载失败，请稍后重试'
}

function FlowRecordsTable({
  records,
  deviceFallback,
}: {
  records: PhysicalDeviceFlowRecord[]
  deviceFallback: { externalDeviceId?: string | null; internalIp?: string | null }
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">设备ID</TableHead>
            <TableHead className="whitespace-nowrap">内网IP</TableHead>
            <TableHead className="whitespace-nowrap">操作时间</TableHead>
            <TableHead className="whitespace-nowrap">变更动作</TableHead>
            <TableHead className="min-w-[140px]">变更内容</TableHead>
            <TableHead className="min-w-[140px]">详细说明</TableHead>
            <TableHead className="whitespace-nowrap">工单</TableHead>
            <TableHead className="whitespace-nowrap">附件</TableHead>
            <TableHead className="whitespace-nowrap">来源</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const reasonLabel = record.reasonCode
              ? (reasonLabels[record.reasonCode] ?? record.reasonCode)
              : null
            const externalDeviceId =
              record.externalDeviceId ?? deviceFallback.externalDeviceId ?? '—'
            const internalIp = record.internalIp ?? deviceFallback.internalIp ?? '—'
            const changeContent =
              record.kind === 'changelog_import'
                ? (record.changeContent ?? '—')
                : '—'
            const detailText =
              record.kind === 'changelog_import'
                ? (record.detailDescription ?? record.description ?? '—')
                : (record.detailDescription ?? record.description ?? '—')
            const attachments =
              record.attachmentNames && record.attachmentNames.length > 0
                ? record.attachmentNames.join(', ')
                : '—'

            return (
              <TableRow key={`${record.kind}-${record.id}`}>
                <TableCell className="font-mono text-xs">{externalDeviceId}</TableCell>
                <TableCell className="font-mono text-xs">{internalIp}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDt(record.occurredAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{record.title}</span>
                    {reasonLabel && (
                      <Badge variant="outline" className="text-xs">
                        {reasonLabel}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs whitespace-pre-wrap align-top max-w-[220px]">
                  {changeContent}
                </TableCell>
                <TableCell className="text-xs whitespace-pre-wrap align-top max-w-[220px]">
                  {detailText}
                </TableCell>
                <TableCell className="text-xs">{record.ticketNo ?? '—'}</TableCell>
                <TableCell className="text-xs">{attachments}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${flowKindColors[record.kind]}`}>
                    {flowKindLabels[record.kind]}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function PhysicalDeviceDetailContent({ deviceId }: { deviceId: string }) {
  const [onlineConfirmOpen, setOnlineConfirmOpen] = useState(false)
  const utils = trpc.useUtils()

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.getPhysicalDeviceDetail.useQuery({ deviceId }, { retry: 1 })

  const markOnlineMutation = trpc.supplier.markPhysicalDeviceOnline.useMutation({
    onSuccess: (device) => {
      toast.success(`设备 ${device.sn} 已标记上线`)
      void utils.supplier.getPhysicalDeviceDetail.invalidate({ deviceId })
      void utils.supplier.listPhysicalDevices.invalidate()
      void utils.supplier.getPhysicalDeviceStats.invalidate()
      void utils.supplier.listGpuInventory.invalidate()
    },
    onError: (err) => {
      const message = getErrorMessage(err)
      if (message.includes('已在线')) {
        toast.info(message)
      } else {
        toast.error(message)
      }
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载设备详情...
      </div>
    )
  }

  if (isError || !detail) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/devices">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回设备管理
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{isError ? getErrorMessage(error) : '未找到该物理机'}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { device, computeNodes, flowRecords } = detail
  const batchHref = onboardingBatchHref(device.onboardingBatchKind, device.onboardingBatchId)

  const confirmMarkOnline = () => {
    if (device.lifecycleStatus === '在线') {
      toast.info('设备已在线')
      setOnlineConfirmOpen(false)
      return
    }
    markOnlineMutation.mutate(
      { deviceId: device.id },
      { onSettled: () => setOnlineConfirmOpen(false) },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/supplier/devices">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold font-mono">{device.sn}</h1>
              <Badge
                variant="outline"
                className={LIFECYCLE_STATUS_COLORS[device.lifecycleStatus] ?? ''}
              >
                {device.lifecycleStatus}
              </Badge>
              {device.inMaintenance && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                  维护中
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {device.assetNo} · {device.idcCode} · {device.cardTypeName}
            </p>
          </div>
        </div>
        {device.lifecycleStatus !== '在线' && (
          <Button
            className="gap-2"
            onClick={() => setOnlineConfirmOpen(true)}
            disabled={markOnlineMutation.isPending}
          >
            {markOnlineMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            确认上线
          </Button>
        )}
      </div>

      <AlertDialog open={onlineConfirmOpen} onOpenChange={setOnlineConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认将设备标记为上线？</AlertDialogTitle>
            <AlertDialogDescription>
              将把设备 <span className="font-mono">{device.sn}</span>（{device.assetNo} ·{' '}
              {device.idcCode}）标记为在线状态，此操作将更新设备生命周期并计入 GPU 库存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={markOnlineMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={markOnlineMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                confirmMarkOnline()
              }}
            >
              {markOnlineMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  处理中...
                </>
              ) : (
                '确认上线'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">GPU</p>
            <p className="text-xl font-semibold mt-1">
              {device.gpuCount} × {device.cardTypeName}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">接入子阶段</p>
            <p className="text-xl font-semibold mt-1">{device.onboardingSubstage ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">计算节点</p>
            <p className="text-xl font-semibold mt-1">{computeNodes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">流转记录</p>
            <p className="text-xl font-semibold mt-1">{flowRecords.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="flow">
        <TabsList>
          <TabsTrigger value="flow">流转记录 ({flowRecords.length})</TabsTrigger>
          <TabsTrigger value="overview">基本信息</TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                设备流转记录
              </CardTitle>
              <CardDescription>
                汇总状态变更审计、变更表导入与运营事件，按时间倒序展示
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flowRecords.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground text-sm">
                  暂无流转记录，设备入库或状态变更后将在此展示
                </p>
              ) : (
                <FlowRecordsTable
                  records={flowRecords}
                  deviceFallback={{
                    externalDeviceId: device.externalDeviceId,
                    internalIp: device.internalIp,
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">设备标识</CardTitle>
                <CardDescription>SN 级物理机台账字段</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="设备 ID" value={<code>{device.id}</code>} />
                <InfoRow label="资产号" value={device.assetNo} />
                <InfoRow label="序列号 SN" value={<span className="font-mono">{device.sn}</span>} />
                <InfoRow
                  label="供应商"
                  value={
                    <Link
                      href={`/supplier/suppliers/${device.supplierId}`}
                      className="text-primary hover:underline"
                    >
                      {device.supplierName}
                    </Link>
                  }
                />
                <InfoRow label="商务合同" value={device.contractNo ?? '—'} />
                <InfoRow
                  label="接入批次"
                  value={
                    device.onboardingBatchCode ? (
                      batchHref ? (
                        <Link
                          href={batchHref}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {device.onboardingBatchCode}
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        device.onboardingBatchCode
                      )
                    ) : (
                      '—'
                    )
                  }
                />
                <InfoRow
                  label="合作类型"
                  value={DEVICE_COOPERATION_TYPE_LABELS[device.cooperationType]}
                />
                <InfoRow label="设备用途" value={device.devicePurpose ?? '—'} />
                <InfoRow label="运营状态" value={device.opsStatus ?? '—'} />
                <InfoRow label="最近更新" value={formatDt(device.updatedAt)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">网络与部署</CardTitle>
                <CardDescription>机房、IP 与平台资源映射</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="机房编码" value={device.idcCode} />
                <InfoRow label="区域" value={device.idcRegion ?? '—'} />
                <InfoRow
                  label="公网 IP"
                  value={
                    device.externalIp ? (
                      <span className="font-mono">{device.externalIp}</span>
                    ) : (
                      '—'
                    )
                  }
                />
                <InfoRow
                  label="内网 IP"
                  value={
                    device.internalIp ? (
                      <span className="font-mono">{device.internalIp}</span>
                    ) : (
                      '—'
                    )
                  }
                />
                <InfoRow
                  label="平台资源 ID"
                  value={
                    device.platformResourceId ? <code>{device.platformResourceId}</code> : '—'
                  }
                />
                <InfoRow label="外部设备 ID" value={device.externalDeviceId ?? '—'} />
                <InfoRow label="入库时间" value={formatDt(device.createdAt)} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                计算节点 ({computeNodes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {computeNodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无节点</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>角色</TableHead>
                      <TableHead>管理 IP</TableHead>
                      <TableHead>集群</TableHead>
                      <TableHead>节点名</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computeNodes.map((node) => (
                      <TableRow key={node.id}>
                        <TableCell>{node.nodeRole}</TableCell>
                        <TableCell className="font-mono text-xs">{node.mgmtIp ?? '—'}</TableCell>
                        <TableCell>{node.clusterName ?? node.clusterId ?? '—'}</TableCell>
                        <TableCell>{node.nodeName ?? '—'}</TableCell>
                        <TableCell>{node.lifecycleStatus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  )
}
