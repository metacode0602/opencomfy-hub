"use client"

import * as React from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { IconCloudDownload, IconLoader2 } from "@tabler/icons-react"
import type { BillingTenantDetail, BillingTenantUpdateInput } from "@/lib/types/billing-tenant"
import { CrmTenantBillingImportDialog } from "./crm-tenant-billing-import-dialog"
import { CrmTenantRechargesList } from "./crm-tenant-recharges-list"
import { CrmTenantMonthlyBillsList } from "./crm-tenant-monthly-bills-list"
import { CrmTenantMetalOrdersList } from "./crm-tenant-metal-orders-list"
import { CrmTenantReservedPackOrdersList } from "./crm-tenant-reserved-pack-orders-list"

type FormState = {
  tenantName: string
  phone: string
  tenantStatus: "active" | "inactive" | "suspended"
  balance: string
  overdueAt: string
  creditLimit: string
  isDefault: boolean
  contactPerson: string
  contactPhone: string
  contactEmail: string
  customerStatus: "active" | "inactive" | "suspended"
}

function toLocalInput(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function formFromDetail(d: BillingTenantDetail): FormState {
  return {
    tenantName: d.name,
    phone: d.phone ?? "",
    tenantStatus: d.status as FormState["tenantStatus"],
    balance: String(d.balance),
    overdueAt: toLocalInput(d.overdueAt),
    creditLimit: d.creditLimit != null ? String(d.creditLimit) : "",
    isDefault: d.isDefault,
    contactPerson: d.contactPerson ?? "",
    contactPhone: d.contactPhone ?? "",
    contactEmail: d.contactEmail ?? "",
    customerStatus: d.customerStatus as FormState["customerStatus"],
  }
}

function buildUpdatePayload(form: FormState): BillingTenantUpdateInput {
  const balance = Number(form.balance)
  if (Number.isNaN(balance)) throw new Error("余额格式无效")
  let creditLimit: number | null = null
  if (form.creditLimit.trim()) {
    creditLimit = Number(form.creditLimit)
    if (Number.isNaN(creditLimit)) throw new Error("授信额度格式无效")
  }
  return {
    tenant: {
      name: form.tenantName.trim(),
      phone: form.phone.trim() || undefined,
      status: form.tenantStatus,
      balance,
      overdueAt: fromLocalInput(form.overdueAt),
      creditLimit,
      isDefault: form.isDefault,
    },
    customer: {
      contactPerson: form.contactPerson,
      contactPhone: form.contactPhone,
      contactEmail: form.contactEmail,
      status: form.customerStatus,
    },
  }
}

export function CrmTenantDetailClient({ tenantId }: { tenantId: string }) {
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.crm.tenants.getById.useQuery({ id: tenantId })

  const [form, setForm] = React.useState<FormState | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [billingImportOpen, setBillingImportOpen] = React.useState(false)

  React.useEffect(() => {
    if (data) {
      setForm(formFromDetail(data))
      setDirty(false)
    }
  }, [data])

  const updateMutation = trpc.crm.tenants.update.useMutation({
    onSuccess: (row) => {
      toast.success("已保存")
      setForm(formFromDetail(row))
      setDirty(false)
      void utils.crm.tenants.getById.setData({ id: tenantId }, row)
      void utils.crm.tenants.list.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const patch = React.useCallback((partial: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev))
    setDirty(true)
  }, [])

  if (isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">加载中…</p>
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到计费租户。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/tenants">返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  if (!form) {
    return <p className="text-muted-foreground p-6 text-sm">加载中…</p>
  }

  const onSave = () => {
    try {
      const payload = buildUpdatePayload(form)
      updateMutation.mutate({ id: tenantId, data: payload })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "校验失败")
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href="/crm/tenants">← 返回列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/crm/customers/${data.customerId}`}>查看客户</LocaleLink>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setBillingImportOpen(true)}
        >
          <IconCloudDownload className="mr-1.5 size-4" />
          从平台同步账单
        </Button>
      </div>

      <CrmTenantBillingImportDialog
        open={billingImportOpen}
        onOpenChange={setBillingImportOpen}
        tenantId={tenantId}
        tenantName={data.name}
        platformTenantId={data.platformTenantId}
        onImported={() => {
          void utils.crm.tenants.getById.invalidate({ id: tenantId })
          void utils.crm.tenants.listRecharges.invalidate({ tenantId })
          void utils.crm.tenants.listMonthlyBills.invalidate({ tenantId })
          void utils.crm.tenants.listMetalOrders.invalidate({ tenantId })
          void utils.crm.tenants.listReservedPackOrders.invalidate({ tenantId })
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>计费租户</CardTitle>
            <CardDescription>
              平台租户 ID：{data.platformTenantId ?? "—"}
              {data.isDefault ? " · 默认账户" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="租户显示名">
              <Input value={form.tenantName} onChange={(e) => patch({ tenantName: e.target.value })} />
            </Field>
            <Field label="租户手机号">
              <Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </Field>
            <Field label="状态">
              <Select
                value={form.tenantStatus}
                onValueChange={(v) => patch({ tenantStatus: v as FormState["tenantStatus"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                  <SelectItem value="suspended">暂停</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="余额(元)">
              <Input
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => patch({ balance: e.target.value })}
              />
            </Field>
            <Field label="欠费时间">
              <Input
                type="datetime-local"
                value={form.overdueAt}
                onChange={(e) => patch({ overdueAt: e.target.value })}
              />
            </Field>
            <Field label="授信额度(元)">
              <Input
                type="number"
                step="0.01"
                placeholder="留空表示未设置"
                value={form.creditLimit}
                onChange={(e) => patch({ creditLimit: e.target.value })}
              />
            </Field>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="is-default">客户默认计费账户</Label>
              <Switch
                id="is-default"
                checked={form.isDefault}
                onCheckedChange={(checked) => patch({ isDefault: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>关联客户</CardTitle>
            <CardDescription>
              {data.customerName}（{data.customerType} 端）· 不修改客户名称
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadOnly label="客户名称" value={data.customerName} />
            <Field label="联系人">
              <Input
                value={form.contactPerson}
                onChange={(e) => patch({ contactPerson: e.target.value })}
              />
            </Field>
            <Field label="联系人手机">
              <Input
                value={form.contactPhone}
                onChange={(e) => patch({ contactPhone: e.target.value })}
              />
            </Field>
            <Field label="联系邮箱">
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => patch({ contactEmail: e.target.value })}
              />
            </Field>
            <Field label="客户状态">
              <Select
                value={form.customerStatus}
                onValueChange={(v) => patch({ customerStatus: v as FormState["customerStatus"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                  <SelectItem value="suspended">暂停</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <ReadOnly
              label="创建时间"
              value={new Date(data.createdAt).toLocaleString("zh-CN", { hour12: false })}
            />
          </CardContent>
          <CardFooter className="border-t">
            <Button
              type="button"
              disabled={!dirty || updateMutation.isPending}
              onClick={onSave}
            >
              {updateMutation.isPending ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  保存中…
                </>
              ) : (
                "保存修改"
              )}
            </Button>
            {dirty ? (
              <span className="text-muted-foreground ml-3 text-xs">有未保存的更改</span>
            ) : null}
          </CardFooter>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        <CrmTenantRechargesList tenantId={tenantId} />
        <CrmTenantMonthlyBillsList tenantId={tenantId} />
        <CrmTenantMetalOrdersList tenantId={tenantId} />
        <CrmTenantReservedPackOrdersList tenantId={tenantId} />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground mb-0.5 text-xs">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}
