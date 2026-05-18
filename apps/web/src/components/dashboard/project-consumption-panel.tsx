'use client'

import { useState } from 'react'
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
import { mockConsumptions } from '@/lib/data/mock-data'
import type { Consumption, Project } from '@/lib/data/types'
import { productLineNames } from '@/lib/data/types'

interface ProjectConsumptionPanelProps {
  project: Project
}

export function ProjectConsumptionPanel({ project }: ProjectConsumptionPanelProps) {
  const [consumptions] = useState<Consumption[]>(() =>
    mockConsumptions.filter((c) => c.projectId === project.id),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">消费明细</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>产品线</TableHead>
              <TableHead>资源名称</TableHead>
              <TableHead>消费金额</TableHead>
              <TableHead>使用量</TableHead>
              <TableHead>时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consumptions.map((consumption) => (
              <TableRow key={consumption.id}>
                <TableCell>
                  <Badge variant="outline">{productLineNames[consumption.productLine]}</Badge>
                </TableCell>
                <TableCell className="font-medium">{consumption.resourceName}</TableCell>
                <TableCell>¥{consumption.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {consumption.duration} {consumption.unit === 'hour' && '小时'}
                  {consumption.unit === 'day' && '天'}
                  {consumption.unit === 'month' && '月'}
                  {consumption.unit === 'count' && '次'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(consumption.createdAt).toLocaleString('zh-CN')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
