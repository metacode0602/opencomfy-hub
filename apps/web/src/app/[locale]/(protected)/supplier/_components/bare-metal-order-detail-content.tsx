'use client'

import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { trpc } from '@/lib/trpc/client'
import {
  BARE_METAL_ORDER_MARK_LABELS,
  BARE_METAL_ORDER_SOURCE_LABELS,
  BARE_METAL_ORDER_STATUS_LABELS,
  formatBareMetalDateTime,
  formatBareMetalMoney,
} from '@/lib/supplier/bare-metal-order-utils'

export function BareMetalOrderDetailContent({ orderId }: { orderId: string }) {
  const { data: order, isLoading, error } = trpc.supplier.bareMetalOrder.getById.useQuery({ id: orderId })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        加载中…
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/bare-metal-orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            返回列表
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{error?.message ?? '订单不存在'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const matchWarnings = Object.entries(order.matchFlags ?? {}).filter(([, v]) => Boolean(v))

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/supplier/bare-metal-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{order.orderNo ?? order.id}</h1>
            <Badge variant={order.orderMark === 'offline' ? 'secondary' : 'default'}>
              {BARE_METAL_ORDER_MARK_LABELS[order.orderMark] ?? order.orderMark}
            </Badge>
            <Badge variant="outline">
              {BARE_METAL_ORDER_STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            <Badge variant="outline">
              {BARE_METAL_ORDER_SOURCE_LABELS[order.source] ?? order.source}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1 font-mono">
            平台 ID：{order.platformOrderId ?? '—'}
          </p>
        </div>
      </div>

      {matchWarnings.length > 0 && (
        <Alert>
          <AlertDescription>
            匹配警告：{matchWarnings.map(([k]) => k).join('、')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">订单信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">租户</p>
            <p className="font-medium">{order.tenantName ?? '—'}</p>
            <p className="text-xs text-muted-foreground font-mono">{order.platformTenantId}</p>
          </div>
          <div>
            <p className="text-muted-foreground">项目</p>
            <p className="font-medium">{order.projectName ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">机房</p>
            <p className="font-medium">{order.dataCenterName ?? order.idcName ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">客户</p>
            <p className="font-medium">{order.customerName ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">设备台数 / GPU 卡数</p>
            <p className="font-medium">
              {order.deviceCount} 台 / {order.gpuCount} 卡
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">租期摘要</p>
            <p className="font-medium">{order.purchaseQtyText ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">租用时段</p>
            <p className="font-medium">
              {formatBareMetalDateTime(order.rentStartsAt)} ~ {formatBareMetalDateTime(order.rentEndsAt)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">下单时间</p>
            <p className="font-medium">{formatBareMetalDateTime(order.orderedAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">订单金额</p>
            <p className="font-medium">{formatBareMetalMoney(order.orderAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">实付金额</p>
            <p className="font-medium text-lg">{formatBareMetalMoney(order.finalAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">支付状态</p>
            <p className="font-medium">{order.payStatus}</p>
          </div>
          <div>
            <p className="text-muted-foreground">计费单位</p>
            <p className="font-medium">{order.billingUnit}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">设备明细（{order.devices.length} 行）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>行号</TableHead>
                <TableHead>型号</TableHead>
                <TableHead>卡数</TableHead>
                <TableHead>租用时段</TableHead>
                <TableHead>时长(h)</TableHead>
                <TableHead>卡时单价</TableHead>
                <TableHead>行金额</TableHead>
                <TableHead>分配状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>{device.lineNo}</TableCell>
                  <TableCell>
                    {device.gpuCardTypeCode ?? device.deviceModelText ?? '—'}
                  </TableCell>
                  <TableCell>{device.gpuCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatBareMetalDateTime(device.rentStartsAt)} ~{' '}
                    {formatBareMetalDateTime(device.rentEndsAt)}
                  </TableCell>
                  <TableCell>{device.durationHours ?? '—'}</TableCell>
                  <TableCell>{formatBareMetalMoney(device.unitPricePerCardHour)}</TableCell>
                  <TableCell>{formatBareMetalMoney(device.lineAmount)}</TableCell>
                  <TableCell>{device.allocationStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
