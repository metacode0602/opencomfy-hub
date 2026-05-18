'use client'

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
import { trpc } from '@/lib/trpc/client'
import type { Project } from '@/lib/data/types'
import { productLineNames } from '@/lib/data/types'

interface ProjectOrdersPanelProps {
  project: Project
}

export function ProjectOrdersPanel({ project }: ProjectOrdersPanelProps) {
  const { data: orders = [] } = trpc.crm.projects.listOrders.useQuery({
    projectId: project.id,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">订单列表</CardTitle>
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
            {orders.map((order) => (
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
