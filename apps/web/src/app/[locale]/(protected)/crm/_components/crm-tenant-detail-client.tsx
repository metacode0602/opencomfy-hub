"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import { TenantHubCards } from "./tenant-hub-cards"
import { CrmDeleteDialog } from "./crm-delete-dialog"

export function CrmTenantDetailClient({ tenantId }: { tenantId: string }) {
  const router = useLocaleRouter()
  const tenant = useCrmMockStore((s) => s.tenants.find((t) => t.id === tenantId))
  const removeTenant = useCrmMockStore((s) => s.removeTenant)
  const [delOpen, setDelOpen] = React.useState(false)

  if (!tenant) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到租户。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/tenants">返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {tenant.account_name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {tenant.tenant_code} · {tenant.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <LocaleLink href="/crm/tenants">返回租户列表</LocaleLink>
            </Button>
            <Button variant="outline" asChild>
              <LocaleLink href={`/crm/tenants/${tenant.id}/edit`}>编辑</LocaleLink>
            </Button>
            <Button variant="destructive" type="button" onClick={() => setDelOpen(true)}>
              删除
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
            <CardDescription>只读展示（mock）</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="租户主键" value={tenant.id} />
            <Row label="租户编码" value={tenant.tenant_code} />
            <Row label="租户状态" value={tenant.status} />
            <Row label="租户类型" value={tenant.type} />
            <Row label="生命周期阶段" value={tenant.lifecycle_phase} />
            <Row label="测试开始日" value={tenant.test_started_on ?? "—"} />
            <Row label="测试完成日" value={tenant.test_completed_on ?? "—"} />
            <Row label="转正日" value={tenant.conversion_date ?? "—"} />
            <Row label="转正触发摘要" value={tenant.conversion_trigger || "—"} />
            <Row label="创建时间" value={tenant.created_at} />
            <Row label="更新时间" value={tenant.updated_at} />
            <div className="sm:col-span-2">
              <div className="text-muted-foreground mb-1">预期规模</div>
              <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">
                {tenant.expected_scale
                  ? JSON.stringify(tenant.expected_scale, null, 2)
                  : "—"}
              </pre>
            </div>
            <div className="sm:col-span-2">
              <div className="text-muted-foreground mb-1">观测规模摘要</div>
              <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">
                {tenant.observed_scale_summary
                  ? JSON.stringify(tenant.observed_scale_summary, null, 2)
                  : "—"}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-medium">租户关联（辐射导航）</h2>
          <TenantHubCards tenantId={tenant.id} />
        </div>
      </div>

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除租户？"
        description={`将删除「${tenant.account_name}」及级联 mock 子数据。`}
        onConfirm={() => {
          removeTenant(tenant.id)
          router.push("/crm/tenants")
        }}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
