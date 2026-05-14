"use client"

import { Network } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { cn } from "@workspace/ui/lib/utils"

const CLUSTERS = [
  {
    name: "千岛湖 Zone 5",
    model: "A100 80GB",
    total: 320,
    online: 308,
    abnormal: 4,
    pending: 8,
    shelvingRate: 92,
    owner: "张伟",
    netOk: true,
  },
  {
    name: "乌兰察布 A 区",
    model: "H100 80GB",
    total: 280,
    online: 275,
    abnormal: 2,
    pending: 3,
    shelvingRate: 88,
    owner: "李娜",
    netOk: true,
  },
  {
    name: "中卫集群 2",
    model: "A100 40GB",
    total: 190,
    online: 182,
    abnormal: 5,
    pending: 3,
    shelvingRate: 79,
    owner: "王强",
    netOk: false,
  },
  {
    name: "张家口 Edge",
    model: "L40S",
    total: 120,
    online: 118,
    abnormal: 1,
    pending: 1,
    shelvingRate: 95,
    owner: "赵敏",
    netOk: true,
  },
]

export function ClusterStatusCard() {
  return (
    <Card className="border-border/80 lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">机房集群实时状态</CardTitle>
        <CardDescription>上架率与网络状态</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CLUSTERS.map((c) => (
          <div
            key={c.name}
            className="flex gap-3 rounded-lg border border-border/60 bg-muted/10 p-3"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold leading-tight">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.model}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarImage src="" alt="" />
                    <AvatarFallback className="text-[10px]">{c.owner.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{c.owner}</span>
                </div>
                <Network
                  className={cn(
                    "size-4 shrink-0",
                    c.netOk ? "text-emerald-500" : "text-destructive"
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>总台 {c.total}</span>
                <span>在线 {c.online}</span>
                <span className="text-destructive">异常 {c.abnormal}</span>
                <span className="text-chart-4">待上架 {c.pending}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>上架率</span>
                  <span>{c.shelvingRate}%</span>
                </div>
                <Progress value={c.shelvingRate} className="h-1.5" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
