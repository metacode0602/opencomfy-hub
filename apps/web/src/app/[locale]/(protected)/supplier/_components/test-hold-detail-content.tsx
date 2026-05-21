'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FlaskConical,
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
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import {
  INTERNAL_TEST_HOLD_DEPARTMENT_LABELS,
  INTERNAL_TEST_HOLD_SETTLEMENT_LABELS,
  type InternalTestHold,
  type InternalTestHoldDevice,
} from '@/lib/types/supplier-domain'
import { useDataCenterLabel, useSupplierLabel } from '@/lib/supplier/supplier-domain-lookups'
import { downloadTestHoldDevicesExcel } from '@/lib/supplier/test-hold-device-export'
import { TestHoldDeviceEntryDialog } from './test-hold-device-entry-dialog'

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

function isActive(hold: InternalTestHold) {
  const now = Date.now()
  const from = new Date(hold.hold_from).getTime()
  const until = hold.hold_until ? new Date(hold.hold_until).getTime() : null
  if (now < from) return false
  if (until != null && now > until) return false
  return true
}

type ConfirmAction =
  | { type: 'end_device'; device: InternalTestHoldDevice }
  | { type: 'end_all' }
  | null

export function TestHoldDetailContent({ holdId }: { holdId: string }) {
  const hold = useSupplierDomainMockStore((s) =>
    s.internalTestHolds.find((h) => h.id === holdId),
  )
  const upsertInternalTestHold = useSupplierDomainMockStore((s) => s.upsertInternalTestHold)

  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  const supplierName = useSupplierLabel(hold?.supplier_id ?? '')
  const dataCenterLabel = useDataCenterLabel(hold?.data_center_id ?? '')

  const devices = useMemo(() => hold?.devices ?? [], [hold?.devices])
  const active = hold ? isActive(hold) : false

  const confirmEndDevice = () => {
    if (!hold || confirmAction?.type !== 'end_device') return
    const nextDevices = (hold.devices ?? []).filter((d) => d.id !== confirmAction.device.id)
    upsertInternalTestHold({ ...hold, devices: nextDevices })
    toast.success(`已结束设备 ${confirmAction.device.sn ?? confirmAction.device.internal_ip} 的占用`)
    setConfirmAction(null)
  }

  const confirmEndAll = () => {
    if (!hold || confirmAction?.type !== 'end_all') return
    upsertInternalTestHold({
      ...hold,
      hold_until: new Date().toISOString(),
    })
    toast.success('已结束全部占用')
    setConfirmAction(null)
  }

  const exportExcel = () => {
    if (!hold) return
    if (devices.length === 0) {
      toast.error('暂无已录入设备，无法导出')
      return
    }
    const ok = downloadTestHoldDevicesExcel({ hold, devices })
    if (ok) toast.success('设备上架 Excel 已下载')
  }

  if (!hold) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/test-holds">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回测试占用
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            未找到该测试占用记录，可能 ID 无效或已被删除
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Link href="/supplier/test-holds">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">测试占用详情</h1>
              <Badge
                variant="outline"
                className={active ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : ''}
              >
                {active ? '进行中' : '已结束'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {hold.user_name} · {INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[hold.department]} ·{' '}
              <span className="font-mono">{hold.card_type}</span> × {hold.unit_count} 台
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={exportExcel} disabled={devices.length === 0}>
            <Download className="w-4 h-4" />
            导出上架 Excel
          </Button>
          {active && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setDeviceDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                录入设备
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => setConfirmAction({ type: 'end_all' })}
              >
                <StopCircle className="w-4 h-4" />
                全部结束占用
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex gap-3">
            <FlaskConical className="w-8 h-8 text-purple-500 shrink-0" />
            <div>
              <p className="text-2xl font-semibold">{hold.unit_count}</p>
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
            <p className="text-sm font-medium">{formatDt(hold.hold_from)}</p>
            <p className="text-xs text-muted-foreground mt-1">开始时间</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">{formatDt(hold.hold_until)}</p>
            <p className="text-xs text-muted-foreground mt-1">结束时间</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">申请信息</CardTitle>
          <CardDescription>内部测试 GPU 占用登记（Mock）</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">供应商</dt>
              <dd className="mt-1">
                <Link
                  href={`/supplier/suppliers/${hold.supplier_id}`}
                  className="text-primary hover:underline"
                >
                  {supplierName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">机房</dt>
              <dd className="mt-1">{dataCenterLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">使用者</dt>
              <dd className="mt-1">{hold.user_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">使用部门</dt>
              <dd className="mt-1">{INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[hold.department]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">卡型</dt>
              <dd className="mt-1 font-mono">{hold.card_type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">结算方式</dt>
              <dd className="mt-1">{INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[hold.settlement_mode]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">占用时段</dt>
              <dd className="mt-1">
                {formatDt(hold.hold_from)} — {formatDt(hold.hold_until)}
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                设备列表
              </CardTitle>
              <CardDescription>
                已录入 {devices.length} 台
                {hold.unit_count > devices.length
                  ? `，尚有 ${hold.unit_count - devices.length} 台待录入`
                  : ''}
              </CardDescription>
            </div>
            {devices.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={exportExcel}>
                <Download className="w-4 h-4" />
                导出 Excel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {devices.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
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
                      <TableCell className="font-mono text-xs">{d.internal_ip}</TableCell>
                      <TableCell className="font-mono text-xs">{d.external_ip}</TableCell>
                      <TableCell className="font-mono text-xs">{d.port}</TableCell>
                      <TableCell>{d.root_account}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {d.root_password}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/supplier/devices/machines/${d.device_id}`}>详情</Link>
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
        hold={hold}
        open={deviceDialogOpen}
        onOpenChange={setDeviceDialogOpen}
      />

      <AlertDialog open={confirmAction?.type === 'end_device'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认结束单台设备占用？</AlertDialogTitle>
            <AlertDialogDescription>
              将从本测试占用中移除设备{' '}
              <span className="font-mono">
                {confirmAction?.type === 'end_device'
                  ? confirmAction.device.sn ?? confirmAction.device.internal_ip
                  : ''}
              </span>
              ，该设备将不再计入本次内部测试占用（Mock）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmEndDevice}
            >
              确认结束
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction?.type === 'end_all'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认结束全部占用？</AlertDialogTitle>
            <AlertDialogDescription>
              将立即结束 {hold.user_name} 的 {hold.card_type} × {hold.unit_count} 台测试占用，
              结束时间为当前时刻。已录入的 {devices.length} 台设备记录仍保留供查阅。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmEndAll}
            >
              确认全部结束
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
