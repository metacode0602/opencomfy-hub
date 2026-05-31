"use client"

import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { DashboardCardLoading } from "../_lib/dashboard-card-states"
import { useGlobalDashboard } from "../_lib/global-dashboard-context"

const STATUS_LABEL: Record<string, string> = {
  ok: "正常",
  pending: "待核对",
  abnormal: "异常",
}

export function DiscrepancyTableCard() {
  const { data, isLoading } = useGlobalDashboard()
  const rows = data?.discrepancies ?? []

  return (
    <Card className="border-border/80 lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-base">批次进度校验</CardTitle>
        <CardDescription>
          进行中计划批次：计划 / 中间进度 / 完成进度（按类型列含义不同）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <DashboardCardLoading />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无活跃批次</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>对象</TableHead>
                <TableHead className="text-right">计划</TableHead>
                <TableHead className="text-right">接收/挂接</TableHead>
                <TableHead className="text-right">完成</TableHead>
                <TableHead>差异</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-[72px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.batchId}>
                  <TableCell className="max-w-[140px]">
                    <div className="truncate font-medium">{r.supplierName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.dataCenterName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.plannedDeviceCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.batchKind === "internal_occupancy" ? "—" : r.touchedDeviceCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span title={r.progressDoneLabel}>{r.onlineDeviceCount}</span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-[120px] truncate text-xs",
                      r.status !== "ok" && "text-destructive"
                    )}
                  >
                    {r.gapLabel}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "ok"
                          ? "secondary"
                          : r.status === "abnormal"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <Link href={r.detailHref || `/supplier/online-tasks/${r.batchId}`}>处理</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Link href="/supplier/online-tasks" className="text-xs text-primary hover:underline">
          查看全部计划批次
        </Link>
      </CardContent>
    </Card>
  )
}
