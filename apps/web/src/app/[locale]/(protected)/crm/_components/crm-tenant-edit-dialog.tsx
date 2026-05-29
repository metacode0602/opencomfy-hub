"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type { BillingTenantDetail, BillingTenantUpdateInput } from "@/lib/types/billing-tenant"

type FormState = {
  tenantName: string
  phone: string
  tenantStatus: "active" | "inactive" | "suspended"
  tenantType: "internal" | "external"
  balance: string
  overdueAt: string
  creditLimit: string
  isDefault: boolean
  customerType: "B" | "C"
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
    tenantType: d.type,
    balance: String(d.balance),
    overdueAt: toLocalInput(d.overdueAt),
    creditLimit: d.creditLimit != null ? String(d.creditLimit) : "",
    isDefault: d.isDefault,
    customerType: d.customerType,
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
      type: form.tenantType,
      balance,
      overdueAt: fromLocalInput(form.overdueAt),
      creditLimit,
      isDefault: form.isDefault,
    },
    customer: {
      type: form.customerType,
      contactPerson: form.contactPerson,
      contactPhone: form.contactPhone,
      contactEmail: form.contactEmail,
      status: form.customerStatus,
    },
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}

export type CrmTenantEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  detail: BillingTenantDetail
  onUpdated: (row: BillingTenantDetail) => void
}

export function CrmTenantEditDialog({
  open,
  onOpenChange,
  tenantId,
  detail,
  onUpdated,
}: CrmTenantEditDialogProps) {
  const [form, setForm] = React.useState<FormState | null>(null)

  React.useEffect(() => {
    if (open) {
      setForm(formFromDetail(detail))
    } else {
      setForm(null)
    }
  }, [open, detail])

  const updateMutation = trpc.crm.tenants.update.useMutation({
    onSuccess: (row) => {
      toast.success("已保存")
      onUpdated(row)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const patch = React.useCallback((partial: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev))
  }, [])

  const onSave = () => {
    if (!form) return
    try {
      const payload = buildUpdatePayload(form)
      updateMutation.mutate({ id: tenantId, data: payload })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "校验失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑租户信息</DialogTitle>
          <DialogDescription>
            修改计费租户与关联客户信息。客户名称不可在此修改。
          </DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-medium">计费租户</p>
              <Field label="租户显示名">
                <Input
                  value={form.tenantName}
                  onChange={(e) => patch({ tenantName: e.target.value })}
                />
              </Field>
              <Field label="租户手机号">
                <Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </Field>
              <Field label="状态">
                <Select
                  value={form.tenantStatus}
                  onValueChange={(v) => patch({ tenantStatus: v as FormState["tenantStatus"] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">正常</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                    <SelectItem value="suspended">暂停</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="租户类型">
                <Select
                  value={form.tenantType}
                  onValueChange={(v) => patch({ tenantType: v as FormState["tenantType"] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">外部租户</SelectItem>
                    <SelectItem value="internal">内部租户</SelectItem>
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
                <Label htmlFor="tenant-edit-is-default">客户默认计费账户</Label>
                <Switch
                  id="tenant-edit-is-default"
                  checked={form.isDefault}
                  onCheckedChange={(checked) => patch({ isDefault: checked })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium">关联客户</p>
              <Field label="客户名称">
                <Input value={detail.customerName} disabled />
              </Field>
              <Field label="客户类型">
                <Select
                  value={form.customerType}
                  onValueChange={(v) => patch({ customerType: v as FormState["customerType"] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B">企业</SelectItem>
                    <SelectItem value="C">个人</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
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
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">正常</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                    <SelectItem value="suspended">暂停</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={!form || updateMutation.isPending} onClick={onSave}>
            {updateMutation.isPending ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                保存中…
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
