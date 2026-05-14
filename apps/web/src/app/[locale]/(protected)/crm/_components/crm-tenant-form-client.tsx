"use client"

import * as React from "react"
import { useLocaleRouter } from "@/lib/i18n/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import type { Tenant } from "@/lib/types/crm"

function nowIso() {
  return new Date().toISOString()
}

function emptyTenant(id: string): Tenant {
  return {
    id,
    tenant_code: "",
    name: "",
    account_name: "",
    status: "active",
    type: "B端",
    lifecycle_phase: "线索孵化",
    expected_scale: null,
    observed_scale_summary: null,
    test_started_on: null,
    test_completed_on: null,
    conversion_date: null,
    conversion_trigger: "",
    created_at: nowIso(),
    updated_at: nowIso(),
  }
}

export function CrmTenantFormClient({ tenantId }: { tenantId?: string }) {
  const router = useLocaleRouter()
  const tenants = useCrmMockStore((s) => s.tenants)
  const upsertTenant = useCrmMockStore((s) => s.upsertTenant)
  const createTenantId = useCrmMockStore((s) => s.createTenantId)

  const existing = tenantId ? tenants.find((t) => t.id === tenantId) : undefined
  const isEdit = Boolean(tenantId && existing)

  const [form, setForm] = React.useState<Tenant>(() =>
    existing ?? emptyTenant(createTenantId()),
  )

  React.useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  const set =
    (key: keyof Tenant) =>
    (v: string | null | Tenant["expected_scale"]) => {
      setForm((f) => ({ ...f, [key]: v, updated_at: nowIso() }))
    }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tenant_code.trim() || !form.account_name.trim()) {
      return
    }
    upsertTenant(form)
    router.push(`/crm/tenants/${form.id}`)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>{isEdit ? "编辑租户" : "新建租户"}</CardTitle>
          <CardDescription>字段标签与数据模型 §1.1 `tenant` 对齐（mock）</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tenant_code">租户编码</Label>
                <Input
                  id="tenant_code"
                  value={form.tenant_code}
                  onChange={(e) => set("tenant_code")(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">企业法定名称</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="account_name">经营展示名</Label>
                <Input
                  id="account_name"
                  value={form.account_name}
                  onChange={(e) => set("account_name")(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">租户状态</Label>
                <Input
                  id="status"
                  value={form.status}
                  onChange={(e) => set("status")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">租户类型</Label>
                <Input
                  id="type"
                  value={form.type}
                  onChange={(e) => set("type")(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lifecycle_phase">生命周期阶段</Label>
                <Input
                  id="lifecycle_phase"
                  value={form.lifecycle_phase}
                  onChange={(e) => set("lifecycle_phase")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test_started_on">测试开始日</Label>
                <Input
                  id="test_started_on"
                  type="date"
                  value={form.test_started_on ?? ""}
                  onChange={(e) =>
                    set("test_started_on")(e.target.value || null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test_completed_on">测试完成日</Label>
                <Input
                  id="test_completed_on"
                  type="date"
                  value={form.test_completed_on ?? ""}
                  onChange={(e) =>
                    set("test_completed_on")(e.target.value || null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversion_date">转正日</Label>
                <Input
                  id="conversion_date"
                  type="date"
                  value={form.conversion_date ?? ""}
                  onChange={(e) =>
                    set("conversion_date")(e.target.value || null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversion_trigger">转正触发类型摘要</Label>
                <Input
                  id="conversion_trigger"
                  value={form.conversion_trigger ?? ""}
                  onChange={(e) => set("conversion_trigger")(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="expected_scale">预期规模（JSON）</Label>
                <Textarea
                  id="expected_scale"
                  rows={3}
                  className="font-mono text-sm"
                  value={
                    form.expected_scale
                      ? JSON.stringify(form.expected_scale, null, 2)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    if (!raw) {
                      set("expected_scale")(null)
                      return
                    }
                    try {
                      set("expected_scale")(JSON.parse(raw) as Tenant["expected_scale"])
                    } catch {
                      /* 保持输入，提交时再校验也可 */
                    }
                  }}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="observed_scale_summary">观测规模摘要（JSON）</Label>
                <Textarea
                  id="observed_scale_summary"
                  rows={3}
                  className="font-mono text-sm"
                  value={
                    form.observed_scale_summary
                      ? JSON.stringify(form.observed_scale_summary, null, 2)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    if (!raw) {
                      set("observed_scale_summary")(null)
                      return
                    }
                    try {
                      set("observed_scale_summary")(
                        JSON.parse(raw) as Tenant["observed_scale_summary"],
                      )
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <LocaleLink href={isEdit ? `/crm/tenants/${form.id}` : "/crm/tenants"}>
                取消
              </LocaleLink>
            </Button>
            <Button type="submit">保存</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
