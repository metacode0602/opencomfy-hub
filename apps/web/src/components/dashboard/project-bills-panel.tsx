'use client'

import { useState } from 'react'
import { Download, Receipt } from 'lucide-react'
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
import { getBillsByProjectId } from '@/lib/data/mock-data'
import type { Bill, Project } from '@/lib/data/types'

interface ProjectBillsPanelProps {
  project: Project
}

export function ProjectBillsPanel({ project }: ProjectBillsPanelProps) {
  const [bills] = useState<Bill[]>(() => getBillsByProjectId(project.id))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">月度账单</CardTitle>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          导出账单
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {bills.map((bill) => (
            <div key={bill.id} className="border rounded-lg">
              <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{bill.month} 月度账单</p>
                    <p className="text-sm text-muted-foreground">到期日: {bill.dueDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold">¥{bill.totalAmount.toLocaleString()}</p>
                  </div>
                  <StatusBadge status={bill.status} />
                </div>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品线</TableHead>
                      <TableHead>资源名称</TableHead>
                      <TableHead>使用量</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bill.details.map((detail, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline">{detail.productLine}</Badge>
                        </TableCell>
                        <TableCell>{detail.resourceName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {detail.usage} {detail.unit}
                        </TableCell>
                        <TableCell className="text-muted-foreground">¥{detail.unitPrice}</TableCell>
                        <TableCell className="text-right font-medium">
                          ¥{detail.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
