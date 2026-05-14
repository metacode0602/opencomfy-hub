"use client"

import * as React from "react"
import { ArrowDown } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

const LIFECYCLE_STAGES = [
  { stage: "已交付", count: 412, stay: "2.1h", warn: false },
  { stage: "待验收", count: 86, stay: "8.6h", warn: false },
  { stage: "待部署", count: 54, stay: "5.2h", warn: false },
  { stage: "部署中", count: 33, stay: "1.4h", warn: false },
  { stage: "待上架", count: 19, stay: "12.4h", warn: true },
  { stage: "运营中", count: 3180, stay: "—", warn: false },
  { stage: "异常", count: 12, stay: "3.2h", warn: true },
  { stage: "待恢复", count: 7, stay: "6.0h", warn: false },
  { stage: "再纳管", count: 4, stay: "4.5h", warn: false },
]

export function LifecycleFlowCard() {
  return (
    <Card className="border-border/80 lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">资源生命周期流转</CardTitle>
        <CardDescription>阶段人数与平均停留</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {LIFECYCLE_STAGES.map((row, idx) => (
          <React.Fragment key={row.stage}>
            {idx > 0 && (
              <div className="flex justify-center py-0.5 text-muted-foreground">
                <ArrowDown className="size-3" />
              </div>
            )}
            <div
              className={cn(
                "flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2",
                row.warn && "border-destructive/40 bg-destructive/5"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    row.warn ? "bg-destructive" : "bg-chart-2"
                  )}
                />
                <span className="text-sm font-medium">{row.stage}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">
                  {row.count.toLocaleString()}
                </div>
                <div
                  className={cn(
                    "text-xs text-muted-foreground",
                    row.warn && row.stay !== "—" && "text-destructive"
                  )}
                >
                  平均停留 {row.stay}
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  )
}
