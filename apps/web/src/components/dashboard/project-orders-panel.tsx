'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Upload } from 'lucide-react'
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
import { StatusBadge } from '@/components/dashboard/status-badge'
import { ProjectOfflineBareMetalOrderImportDialog } from '@/components/dashboard/project-offline-bare-metal-order-import-dialog'
import { trpc } from '@/lib/trpc/client'
import type { Project } from '@/lib/data/types'
import { productLineNames } from '@/lib/data/types'
import {
  BARE_METAL_ORDER_MARK_LABELS,
  BARE_METAL_ORDER_SOURCE_LABELS,
  BARE_METAL_ORDER_STATUS_LABELS,
  bareMetalOrderDetailPath,
  formatBareMetalDateTime,
  formatBareMetalMoney,
} from '@/lib/supplier/bare-metal-order-utils'

interface ProjectOrdersPanelProps {
  project: Project
}

export function ProjectOrdersPanel({ project }: ProjectOrdersPanelProps) {
  const [importOpen, setImportOpen] = useState(false)
  const { data: orders = [] } = trpc.crm.projects.listOrders.useQuery({
    projectId: project.id,
  })
  const { data: bareMetalOrders = [], refetch: refetchBareMetal } =
    trpc.crm.projects.listBareMetalOrders.useQuery({
      projectId: project.id,
    })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Commerce 订单</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单编号</TableHead>
                <TableHead>产品线</TableHead>
                <TableHead>订单金额</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无 Commerce 订单
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {productLineNames[order.productLine] || order.productLine}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">¥{order.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">裸金属订单</CardTitle>
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 mr-1.5" />
            导入线下裸金属订单
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标记</TableHead>
                <TableHead>订单编号</TableHead>
                <TableHead>设备/卡数</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>下单时间</TableHead>
                <TableHead>来源</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bareMetalOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    暂无裸金属订单
                  </TableCell>
                </TableRow>
              ) : (
                bareMetalOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Badge variant={order.orderMark === 'offline' ? 'secondary' : 'default'}>
                        {BARE_METAL_ORDER_MARK_LABELS[order.orderMark] ?? order.orderMark}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{order.orderNo ?? '—'}</TableCell>
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
        </CardContent>
      </Card>

      <ProjectOfflineBareMetalOrderImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        project={project}
        onImported={() => void refetchBareMetal()}
      />
    </div>
  )
}
