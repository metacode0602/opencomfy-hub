'use client'

import { MoreHorizontal, Pause, Play, Plus } from 'lucide-react'
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
import { productLineNames } from '@/lib/data/types'

interface ProjectTasksPanelProps {
  project: Project
}

export function ProjectTasksPanel({ project }: ProjectTasksPanelProps) {
  const { data: tasks = [] } = trpc.crm.projects.listTasks.useQuery({
    projectId: project.id,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <CardTitle className="text-base">任务列表</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>任务名称</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>资源类型</TableHead>
              <TableHead>GPU</TableHead>
              <TableHead>内存</TableHead>
              <TableHead>开始时间</TableHead>
              <TableHead>费用</TableHead>
              <TableHead>状态</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {task.description}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {productLineNames[task.resourceType] || task.resourceType}
                  </Badge>
                </TableCell>
                <TableCell>{task.gpuCount || '-'}</TableCell>
                <TableCell>{task.memoryGB ? `${task.memoryGB}GB` : '-'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(task.startTime).toLocaleString('zh-CN')}
                </TableCell>
                <TableCell>¥{task.cost.toLocaleString()}</TableCell>
                <TableCell>
                  <StatusBadge status={task.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {task.status === 'running' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pause className="w-4 h-4" />
                      </Button>
                    )}
                    {task.status === 'pending' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
