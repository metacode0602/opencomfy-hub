"use client"

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

const DISCREPANCY_ROWS = [
  {
    cluster: "千岛湖 Zone 5",
    delivered: 320,
    deployed: 318,
    shelved: 312,
    salable: 308,
    result: "上架与可售差 4",
    status: "待核对",
  },
  {
    cluster: "乌兰察布 A 区",
    delivered: 280,
    deployed: 280,
    shelved: 276,
    salable: 275,
    result: "一致",
    status: "正常",
  },
  {
    cluster: "中卫集群 2",
    delivered: 195,
    deployed: 190,
    shelved: 182,
    salable: 180,
    result: "部署缺口 5",
    status: "异常",
  },
]

export function DiscrepancyTableCard() {
  return (
    <Card className="border-border/80 lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-base">资源差异校验中心</CardTitle>
        <CardDescription>交付 / 部署 / 上架 / 可售一致性</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>集群</TableHead>
              <TableHead className="text-right">交付</TableHead>
              <TableHead className="text-right">部署</TableHead>
              <TableHead className="text-right">上架</TableHead>
              <TableHead className="text-right">可售</TableHead>
              <TableHead>差异</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-[72px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {DISCREPANCY_ROWS.map((r) => (
              <TableRow key={r.cluster}>
                <TableCell className="max-w-[120px] truncate font-medium">{r.cluster}</TableCell>
                <TableCell className="text-right tabular-nums">{r.delivered}</TableCell>
                <TableCell className="text-right tabular-nums">{r.deployed}</TableCell>
                <TableCell className="text-right tabular-nums">{r.shelved}</TableCell>
                <TableCell className="text-right tabular-nums">{r.salable}</TableCell>
                <TableCell
                  className={cn(
                    "max-w-[140px] truncate text-xs",
                    r.result !== "一致" && "text-destructive"
                  )}
                >
                  {r.result}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "正常" ? "secondary" : "destructive"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    处理
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="link" className="h-auto px-0 text-xs">
          查看全部差异
        </Button>
      </CardContent>
    </Card>
  )
}
