"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { LocaleLink } from "@/lib/i18n/navigation"
import {
  useActivityTypeName,
  useStaffName,
  useTenantName,
} from "@/lib/crm/crm-lookups"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"

export function CrmTimelineDetailClient({ activityId }: { activityId: string }) {
  const id = decodeURIComponent(activityId)
  const row = useCrmMockStore((s) => s.accountActivities.find((x) => x.id === id))
  const tenantName = useTenantName(row?.tenant_id)
  const typeName = useActivityTypeName(row?.activity_type_id)
  const actor = useStaffName(row?.actor_user_id)

  if (!row) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到动态。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/timeline">返回</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href="/crm/timeline">返回时间线</LocaleLink>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{row.title_snapshot ?? "客户动态"}</CardTitle>
            <CardDescription>
              租户：{tenantName} · 只读投影
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row l="动态类型" v={typeName} />
            <Row l="业务发生时间" v={row.occurred_at} />
            <Row l="关联业务域" v={row.ref_domain ?? "—"} />
            <Row l="关联记录 ID" v={row.ref_id ?? "—"} />
            <Row l="内部操作者" v={actor} />
            <Row l="可见性" v={row.visibility ?? "—"} />
            <div>
              <div className="text-muted-foreground mb-1">摘要快照</div>
              <p className="text-sm">{row.summary_snapshot ?? "—"}</p>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">扩展数据</div>
              <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
                {row.payload ? JSON.stringify(row.payload, null, 2) : "—"}
              </pre>
            </div>
            <Button variant="link" className="h-auto px-0" asChild>
              <LocaleLink href={`/crm/tenants/${row.tenant_id}`}>进入租户详情</LocaleLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <span className="text-muted-foreground">{l}</span>
      <span className="max-w-[65%] text-right font-medium break-all">{v}</span>
    </div>
  )
}
