'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, ShoppingCart } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
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
import { CopyToClipboard } from '@/components/shared/copy-to-clipboard'
import { trpc } from '@/lib/trpc/client'
import {
  BARE_METAL_ORDER_MARK_LABELS,
  BARE_METAL_ORDER_SOURCE_LABELS,
  BARE_METAL_ORDER_STATUS_LABELS,
  bareMetalOrderDetailPath,
  formatBareMetalDateTime,
  formatBareMetalMoney,
} from '@/lib/supplier/bare-metal-order-utils'

export function BareMetalOrdersContent() {
  const [search, setSearch] = useState('')
  const [orderMark, setOrderMark] = useState<'all' | 'online' | 'offline'>('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const queryInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      orderMark,
      status: status === 'all' ? undefined : status,
      page,
      pageSize,
    }),
    [search, orderMark, status, page],
  )

  const { data, isLoading, isFetching } = trpc.supplier.bareMetalOrder.list.useQuery(queryInput)
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="size-6" />
            裸金属订单
          </h1>
          <p className="text-muted-foreground text-sm mt-1">平台同步与线下 Excel 导入的裸金属订单</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索订单号、平台 ID、租户、项目…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={orderMark}
            onValueChange={(v) => {
              setOrderMark(v as typeof orderMark)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="订单标记" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部标记</SelectItem>
              <SelectItem value="online">线上</SelectItem>
              <SelectItem value="offline">线下</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(BARE_METAL_ORDER_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              加载中…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标记</TableHead>
                  <TableHead>订单编号</TableHead>
                  <TableHead>租户</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>机房</TableHead>
                  <TableHead>设备/卡数</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>下单时间</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                      暂无订单
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Badge variant={order.orderMark === 'offline' ? 'secondary' : 'default'}>
                          {BARE_METAL_ORDER_MARK_LABELS[order.orderMark] ?? order.orderMark}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm">{order.orderNo ?? '—'}</span>
                          {order.orderNo ? (
                            <CopyToClipboard text={order.orderNo} tooltip="复制订单编号" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/crm/tenants/${order.tenantId}`}
                          className="text-primary hover:underline"
                        >
                          {order.tenantName ?? order.platformTenantId}
                        </Link>
                      </TableCell>
                      <TableCell>{order.projectName ?? '—'}</TableCell>
                      <TableCell>
                        {order.dataCenterId ? (
                          <Link
                            href={`/supplier/datacenters/${order.dataCenterId}`}
                            className="text-primary hover:underline"
                          >
                            {order.dataCenterName ?? order.idcName ?? '—'}
                          </Link>
                        ) : (
                          (order.dataCenterName ?? order.idcName ?? '—')
                        )}
                      </TableCell>
                      <TableCell>
                        {order.deviceCount} 台 / {order.gpuCount} 卡
                      </TableCell>
                      <TableCell>{formatBareMetalMoney(order.finalAmount)}</TableCell>
                      <TableCell>
                        {BARE_METAL_ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatBareMetalDateTime(order.orderedAt)}
                      </TableCell>
                      <TableCell>
                        {BARE_METAL_ORDER_SOURCE_LABELS[order.source] ?? order.source}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={bareMetalOrderDetailPath(order.id)}>详情</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 {total} 条{isFetching && !isLoading ? '（刷新中…）' : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
