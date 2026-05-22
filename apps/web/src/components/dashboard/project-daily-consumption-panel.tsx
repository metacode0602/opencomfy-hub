'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
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
import { trpc } from '@/lib/trpc/client'
import type { Project } from '@/lib/data/types'
import { productLineNames } from '@/lib/data/types'

interface ProjectDailyConsumptionPanelProps {
  project: Project
}

const ALL_PRODUCT_LINES = 'all'

export function ProjectDailyConsumptionPanel({ project }: ProjectDailyConsumptionPanelProps) {
  const [productLine, setProductLine] = useState(ALL_PRODUCT_LINES)

  const { data: dailyRows = [], isLoading } = trpc.crm.projects.listDailyConsumptions.useQuery({
    projectId: project.id,
    productLine: productLine === ALL_PRODUCT_LINES ? undefined : productLine,
  })

  const totalAmount = useMemo(
    () => dailyRows.reduce((sum, row) => sum + row.amount, 0),
    [dailyRows],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">每日消费</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            共 {dailyRows.length} 条记录，合计 ¥{totalAmount.toLocaleString()}
          </p>
        </div>
        <Select value={productLine} onValueChange={setProductLine}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="产品线" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PRODUCT_LINES}>全部产品线</SelectItem>
            {Object.entries(productLineNames).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead>
              <TableHead>产品线</TableHead>
              <TableHead>消费金额</TableHead>
              <TableHead>消费笔数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  加载中…
                </TableCell>
              </TableRow>
            ) : dailyRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  暂无消费数据
                </TableCell>
              </TableRow>
            ) : (
              dailyRows.map((row) => (
                <TableRow key={`${row.usageDate}-${row.productLine}`}>
                  <TableCell className="font-medium">
                    {new Date(`${row.usageDate}T00:00:00`).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {productLineNames[row.productLine] ?? row.productLine}
                    </Badge>
                  </TableCell>
                  <TableCell>¥{row.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{row.recordCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
