"use client"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { LocaleLink } from "@/lib/i18n/navigation"
import type { SupplierRelationKey } from "@/lib/types/supplier-domain"
import { SUPPLIER_RELATION_TITLES } from "@/lib/types/supplier-domain"

const hubItems: { relation: SupplierRelationKey; description: string }[] = [
  { relation: "contracts", description: "接入/商务合同与生效区间" },
  { relation: "terms-versions", description: "卡时计价、分成等条款版本" },
  { relation: "unit-costs", description: "机房 × 卡型单价或分成档" },
  { relation: "access-sheets", description: "GPU/网络/CPU 等条件版本" },
  { relation: "onboarding-batches", description: "接入批次与计划就绪" },
  { relation: "devices", description: "物理设备与生命周期" },
  { relation: "compute-nodes", description: "调度最小单位节点" },
  { relation: "onboarding-tasks", description: "施工与联调任务" },
  { relation: "fault-incidents", description: "故障闭环与严重级别" },
  { relation: "test-holds", description: "内部测试占用窗口" },
  { relation: "pool-bindings", description: "资源池与工作负载形态" },
  { relation: "state-definitions", description: "设备/节点状态字典（全局）" },
  { relation: "transition-logs", description: "状态迁移审计（本供应商资产）" },
]

export function SupplierHubCards({ supplierId }: { supplierId: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hubItems.map((item) => (
        <LocaleLink key={item.relation} href={`/supplier/${supplierId}/relations/${item.relation}`}>
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="text-base">{SUPPLIER_RELATION_TITLES[item.relation]}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        </LocaleLink>
      ))}
    </div>
  )
}
