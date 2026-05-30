'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Loader2,
  Plus,
  StopCircle,
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
import {
  INTERNAL_TEST_HOLD_DEPARTMENT_LABELS,
  INTERNAL_TEST_HOLD_SETTLEMENT_LABELS,
} from '@/lib/types/supplier-domain'
import type { InternalTestHoldDetailDevice } from '@/lib/types/internal-test-hold-api'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'
import { downloadTestHoldDevicesExcel } from '@/lib/supplier/test-hold-device-export'
import { TestHoldDeviceEntryDialog } from './test-hold-device-entry-dialog'

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

function isActive(holdFrom: Date, holdUntil: Date | null) {
  const now = Date.now()
  const from = new Date(holdFrom).getTime()
  const until = holdUntil ? new Date(holdUntil).getTime() : null
  if (now < from) return false
  if (until != null && now > until) return false
  return true
}

type ConfirmAction =
  | { type: 'end_device'; device: InternalTestHoldDetailDevice }
  | { type: 'end_all' }
  | null

export function TestHoldDetailContent({ holdId }: { holdId: string }) {
  const utils = trpc.useUtils()
  const { data: hold, isLoading, isError } = trpc.supplier.internalTestHold.getById.useQuery({
    holdId,
  })

  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  const endMutation = trpc.supplier.internalTestHold.end.useMutation({
    onSuccess: () => {
      toast.success('已结束全部占用')
      void utils.supplier.internalTestHold.getById.invalidate({ holdId })
      void utils.supplier.internalTestHold.list.invalidate()
      invalidateGlobalDashboard(utils)
      setConfirmAction(null)
    },
    onError: (error) => toast.error(error.message),
  })

  const unlinkMutation = trpc.supplier.internalTestHold.unlinkDevice.useMutation({
    onSuccess: () => {
      toast.success('已移除设备占用')
      void utils.supplier.internalTestHold.getById.invalidate({ holdId })
      void utils.supplier.internalTestHold.list.invalidate()
      invalidateGlobalDashboard(utils)
      setConfirmAction(null)
    },
    onError: (error) => toast.error(error.message),
  })

  const devices = hold?.devices ?? []
  const active = hold ? isActive(hold.holdFrom, hold.holdUntil) : false

  const exportExcel = () => {
    if (!hold) return
    if (devices.length === 0) {
      toast.error('暂无已录入设备，无法导出')
      return
    }
    const ok = downloadTestHoldDevicesExcel({
      holdId: hold.id,
      userName: hold.userName,
      devices,
    })
    if (ok) toast.success('设备上架 Excel 已下载')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        加载占用详情...
      </div>
    )
  }

  if (isError || !hold) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/test-holds">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回内部占用
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            未找到该内部占用记录，可能 ID 无效或已被删除
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/supplier/test-holds">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">内部占用详情</h1>
              <Badge
                variant="outline"
                className={active ? 'border-purple-500/30 bg-purple-500/20 text-purple-400' : ''}
              >
                {active ? '进行中' : '已结束'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {hold.userName} · {INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[hold.department]} ·{' '}
              <span className="font-mono">{hold.cardTypeName}</span> × {hold.unitCount} 台
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportExcel}
            disabled={devices.length === 0}
          >
            <Download className="h-4 w-4" />
            导出上架 Excel
          </Button>
          {active && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setDeviceDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                录入设备
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => setConfirmAction({ type: 'end_all' })}
              >
                <StopCircle className="h-4 w-4" />
                全部结束占用
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex gap-3 p-4">
            <FlaskConical className="h-8 w-8 shrink-0 text-purple-500" />
            <div>
              <p className="text-2xl font-semibold">{hold.unitCount}</p>
              <p className="text-xs text-muted-foreground">申请台数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{devices.length}</p>
            <p className="text-xs text-muted-foreground">已录入设备</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">{formatDt(hold.holdFrom)}</p>
            <p className="mt-1 text-xs text-muted-foreground">开始时间</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">{formatDt(hold.holdUntil)}</p>
            <p className="mt-1 text-xs text-muted-foreground">结束时间</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">申请信息</CardTitle>
          <CardDescription>内部测试 GPU 占用登记</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">供应商</dt>
              <dd className="mt-1">
                <Link
                  href={`/supplier/suppliers/${hold.supplierId}`}
                  className="text-primary hover:underline"
                >
                  {hold.supplierShortName ?? hold.supplierName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">机房</dt>
              <dd className="mt-1">{hold.dataCenterName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">飞书工单</dt>
              <dd className="mt-1">
                <code className="rounded bg-muted px-2 py-0.5 text-xs">{hold.workOrderNo}</code>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">使用者</dt>
              <dd className="mt-1">{hold.userName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">使用部门</dt>
              <dd className="mt-1">{INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[hold.department]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">卡型</dt>
              <dd className="mt-1 font-mono">{hold.cardTypeName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">结算方式</dt>
              <dd className="mt-1">{INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[hold.settlementMode]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">占用时段</dt>
              <dd className="mt-1">
                {formatDt(hold.holdFrom)} — {formatDt(hold.holdUntil)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">记录 ID</dt>
              <dd className="mt-1 font-mono text-xs">{hold.id}</dd>
            </div>
            {hold.remark && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-muted-foreground">备注</dt>
                <dd className="mt-1">{hold.remark}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4" />
                设备列表
              </CardTitle>
              <CardDescription>
                已录入 {devices.length} 台
                {hold.unitCount > devices.length
                  ? `，尚有 ${hold.unitCount - devices.length} 台待录入`
                  : ''}
              </CardDescription>
            </div>
            {devices.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={exportExcel}>
                <Download className="h-4 w-4" />
                导出 Excel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {devices.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无设备，请点击「录入设备」添加
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SN</TableHead>
                    <TableHead>内网 IP</TableHead>
                    <TableHead>外网 IP</TableHead>
                    <TableHead>端口</TableHead>
                    <TableHead>root 账号</TableHead>
                    <TableHead>密码</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.sn ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.internalIp ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.externalIp ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.port}</TableCell>
                      <TableCell>{d.rootAccount}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {d.rootPasswordMasked}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/supplier/devices/${d.deviceId}`}>详情</Link>
                          </Button>
                          {active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setConfirmAction({ type: 'end_device', device: d })}
                            >
                              结束占用
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TestHoldDeviceEntryDialog
        holdId={hold.id}
        open={deviceDialogOpen}
        onOpenChange={setDeviceDialogOpen}
      />

      <AlertDialog
        open={confirmAction?.type === 'end_device'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认结束单台设备占用？</AlertDialogTitle>
            <AlertDialogDescription>
              将从本内部占用中移除设备{' '}
              <span className="font-mono">
                {confirmAction?.type === 'end_device'
                  ? confirmAction.device.sn ?? confirmAction.device.internalIp
                  : ''}
              </span>
              ，该设备将不再计入本次内部占用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={unlinkMutation.isPending}
              onClick={() => {
                if (confirmAction?.type !== 'end_device') return
                unlinkMutation.mutate({ holdId: hold.id, linkId: confirmAction.device.id })
              }}
            >
              确认结束
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction?.type === 'end_all'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认结束全部占用？</AlertDialogTitle>
            <AlertDialogDescription>
              将立即结束 {hold.userName} 的 {hold.cardTypeName} × {hold.unitCount} 台内部占用，
              结束时间为当前时刻。已录入的 {devices.length} 台设备记录仍保留供查阅。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={endMutation.isPending}
              onClick={() => endMutation.mutate({ holdId: hold.id })}
            >
              确认全部结束
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
