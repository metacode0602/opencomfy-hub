"use client"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { LocaleLink } from "@/lib/i18n/navigation"
import type { TenantRelationKey } from "@/lib/types/crm"

const hubItems: {
  relation: TenantRelationKey
  title: string
  description: string
}[] = [
  {
    relation: "assignments",
    title: "客户经理分配",
    description: "生效区间与角色类型",
  },
  {
    relation: "vouchers",
    title: "测试券发放",
    description: "发放记录与券实例",
  },
  {
    relation: "milestones",
    title: "生命周期里程碑",
    description: "测试完成、规模达标等",
  },
  {
    relation: "evidences",
    title: "里程碑佐证",
    description: "附件与存储地址",
  },
  {
    relation: "contracts",
    title: "合同摘要（本租户）",
    description: "CRM 侧合同快照",
  },
  {
    relation: "recharges",
    title: "充值订单",
    description: "到账流水",
  },
  {
    relation: "usage-daily",
    title: "用量日汇总",
    description: "卡时与金额（可选缓存）",
  },
  {
    relation: "conversion",
    title: "转正记录",
    description: "触发原因与候选日",
  },
  {
    relation: "activities",
    title: "客户动态",
    description: "只读时间线投影",
  },
  {
    relation: "documents",
    title: "过程文档",
    description: "版本与可见性",
  },
  {
    relation: "tasks",
    title: "跟进任务",
    description: "协作待办",
  },
  {
    relation: "comments",
    title: "客户动态评论",
    description: "挂载动态的楼中楼评论",
  },
]

export function TenantHubCards({ tenantId }: { tenantId: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hubItems.map((item) => (
        <LocaleLink
          key={item.relation}
          href={`/crm/tenants/${tenantId}/relations/${item.relation}`}
        >
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        </LocaleLink>
      ))}
    </div>
  )
}
