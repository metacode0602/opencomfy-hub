'use client'

import { Ticket } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
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

interface ProjectCouponsPanelProps {
  project: Project
}

export function ProjectCouponsPanel({ project }: ProjectCouponsPanelProps) {
  const { data: coupons = [] } = trpc.crm.projects.listCoupons.useQuery({
    projectId: project.id,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">算力券</CardTitle>
        <Button size="sm">
          <Ticket className="w-4 h-4 mr-2" />
          发放算力券
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>券码</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>面值/折扣</TableHead>
              <TableHead>最低消费</TableHead>
              <TableHead>发放时间</TableHead>
              <TableHead>过期时间</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length > 0 ? (
              coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono text-sm">{coupon.code}</TableCell>
                  <TableCell className="font-medium">{coupon.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {coupon.type === 'cash' ? '现金券' : '折扣券'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {coupon.type === 'cash'
                      ? `¥${coupon.value.toLocaleString()}`
                      : `${coupon.value}% OFF`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    ¥{coupon.minAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(coupon.issuedAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(coupon.expiredAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={coupon.status} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  暂无算力券
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
