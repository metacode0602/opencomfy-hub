'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { trpc } from '@/lib/trpc/client'

export function WorkbenchPendingBillsCard() {
  const { data: pendingBills = [], isLoading } = trpc.crm.dashboard.pendingBills.useQuery({
    limit: 10,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">待处理账单</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[160px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (pendingBills.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">待处理账单</CardTitle>
          <Badge variant="destructive">{pendingBills.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>账单月份</TableHead>
              <TableHead>项目</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>到期日</TableHead>
              <TableHead>状态</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingBills.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell className="font-medium">{bill.month}</TableCell>
                <TableCell>{bill.projectName}</TableCell>
                <TableCell>¥{bill.totalAmount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">{bill.dueDate}</TableCell>
                <TableCell>
                  <StatusBadge status={bill.status} />
                </TableCell>
                <TableCell>
                  {bill.projectId ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/crm/projects/${bill.projectId}?tab=bills`}>查看详情</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>
                      查看详情
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
