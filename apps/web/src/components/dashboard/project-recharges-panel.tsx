'use client'

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
import type { Project, Recharge } from '@/lib/data/types'

interface ProjectRechargesPanelProps {
  project: Project
}

function paymentMethodLabel(method: Recharge['paymentMethod']) {
  switch (method) {
    case 'bank_transfer':
      return '银行转账'
    case 'alipay':
      return '支付宝'
    case 'wechat':
      return '微信支付'
    case 'invoice':
      return '发票对公'
    default:
      return method
  }
}

export function ProjectRechargesPanel({ project }: ProjectRechargesPanelProps) {
  const { data: recharges = [] } = trpc.crm.projects.listRecharges.useQuery({
    projectId: project.id,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">充值记录</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>充值编号</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>支付方式</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>完成时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recharges.map((recharge) => (
              <TableRow key={recharge.id}>
                <TableCell className="font-mono text-sm">{recharge.transactionId}</TableCell>
                <TableCell className="font-medium">¥{recharge.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {paymentMethodLabel(recharge.paymentMethod)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={recharge.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(recharge.createdAt).toLocaleString('zh-CN')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {recharge.completedAt
                    ? new Date(recharge.completedAt).toLocaleString('zh-CN')
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
