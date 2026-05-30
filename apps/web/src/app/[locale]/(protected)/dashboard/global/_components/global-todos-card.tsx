"use client"

import Link from "next/link"
import { ListTodo } from "lucide-react"

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

import { DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"

export function GlobalTodosCard() {
  const { data, isLoading } = useGlobalDashboard()
  const todos = data?.todos ?? []

  return (
    <Card className="border-border/80 lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-base">待办任务区</CardTitle>
        <CardDescription>接入缺口、故障处理、差异核对（自动生成）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <DashboardCardLoading />
        ) : todos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无待办</p>
        ) : (
          todos.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <ListTodo className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{t.title}</span>
                    <Badge variant="outline">{t.priority}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t.assignee && <span className="mr-2">{t.assignee}</span>}
                    <span className={cn(t.overdue && "font-medium text-destructive")}>{t.due}</span>
                  </div>
                </div>
              </div>
              <Button size="sm" className="shrink-0" asChild>
                <Link href={t.href}>去处理</Link>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
