'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
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

export function WorkbenchRecentProjectsCard() {
  const { data: recentProjects = [], isLoading } = trpc.crm.dashboard.recentProjects.useQuery({
    limit: 5,
  })

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">最近项目</CardTitle>
        <Link href="/crm/projects">
          <Button variant="ghost" size="sm">
            查看全部
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : recentProjects.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">暂无项目</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead>客户经理</TableHead>
                <TableHead className="text-right">本月消费</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={`/crm/projects/${project.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{project.customerName}</span>
                      <Badge variant="outline" className="text-xs">
                        {project.customerType === 'B' ? '企业' : '个人'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.stage} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project.accountManager}</TableCell>
                  <TableCell className="text-right font-medium">
                    ¥{project.thisMonthConsumption.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
