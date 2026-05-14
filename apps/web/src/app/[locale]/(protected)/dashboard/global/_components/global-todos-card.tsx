"use client"

import { ListTodo } from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

const TODOS = [
  {
    title: "待上架工单复核",
    priority: "P1",
    assignee: "陈某",
    due: "超期 2h 15m",
    overdue: true,
  },
  {
    title: "异常机柜现场勘查",
    priority: "P2",
    assignee: "李某",
    due: "剩余 4h",
    overdue: false,
  },
  {
    title: "资源差异周报",
    priority: "P3",
    assignee: "王某",
    due: "明日 10:00",
    overdue: false,
  },
]

export function GlobalTodosCard() {
  return (
    <Card className="border-border/80 lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-base">待办任务区</CardTitle>
        <CardDescription>优先级与处理入口</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {TODOS.map((t) => (
          <div
            key={t.title}
            className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <ListTodo className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t.title}</span>
                  <Badge variant="outline">{t.priority}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[9px]">{t.assignee.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span>{t.assignee}</span>
                  <span className={cn(t.overdue && "font-medium text-destructive")}>{t.due}</span>
                </div>
              </div>
            </div>
            <Button size="sm" className="shrink-0">
              去处理
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
