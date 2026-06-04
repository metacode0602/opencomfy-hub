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
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type {
  BillingTenantDetail,
  BillingTenantInternalSettingInput,
  BillingTenantListItem,
} from "@/lib/types/billing-tenant"

export type TenantInternalSettingTarget = Pick<
  BillingTenantListItem,
  "id" | "name" | "platformTenantId" | "type" | "internalEffectiveFrom" | "internalEffectiveTo"
>

type FormState = {
  tenantType: "internal" | "external"
  internalEffectiveFrom: string
  internalEffectiveTo: string
}

function formFromTarget(t: TenantInternalSettingTarget): FormState {
  return {
    tenantType: t.type,
    internalEffectiveFrom: t.internalEffectiveFrom ?? "",
    internalEffectiveTo: t.internalEffectiveTo ?? "",
  }
}

function buildPayload(form: FormState): BillingTenantInternalSettingInput {
  const internalFrom = form.internalEffectiveFrom.trim() || null
  const internalTo = form.internalEffectiveTo.trim() || null
  if (form.tenantType === "internal" && internalFrom && internalTo && internalFrom > internalTo) {
    throw new Error("收入排除开始日期不能晚于结束日期")
  }
  return {
    type: form.tenantType,
    internalEffectiveFrom: form.tenantType === "internal" ? internalFrom : null,
    internalEffectiveTo: form.tenantType === "internal" ? internalTo : null,
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

export type CrmTenantInternalSettingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: TenantInternalSettingTarget | null
  onUpdated?: (row: BillingTenantDetail) => void
}

export function CrmTenantInternalSettingDialog({
  open,
  onOpenChange,
  tenant,
  onUpdated,
}: CrmTenantInternalSettingDialogProps) {
  const [form, setForm] = React.useState<FormState | null>(null)

  React.useEffect(() => {
    if (open && tenant) {
      setForm(formFromTarget(tenant))
    } else if (!open) {
      setForm(null)
    }
  }, [open, tenant])

  const updateMutation = trpc.crm.tenants.updateInternalSetting.useMutation({
    onSuccess: (row) => {
      toast.success("收入排除设置已保存")
      onUpdated?.(row)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const patch = React.useCallback((partial: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev))
  }, [])

  const onSave = () => {
    if (!form || !tenant) return
    try {
      const data = buildPayload(form)
      updateMutation.mutate({ id: tenant.id, data })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "校验失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>收入排除设置</DialogTitle>
          <DialogDescription>
            {tenant ? (
              <>
                {tenant.name}
                {tenant.platformTenantId ? (
                  <span className="font-mono"> · {tenant.platformTenantId}</span>
                ) : null}
              </>
            ) : (
              "设置租户是否为内部租户，以及从月度收入、个人收入与提成基数中排除的有效期。"
            )}
          </DialogDescription>
        </DialogHeader>

        {form && tenant ? (
          <div className="space-y-4">
            <Field label="租户类型">
              <Select
                value={form.tenantType}
                onValueChange={(v) =>
                  patch({
                    tenantType: v as FormState["tenantType"],
                    ...(v === "external"
                      ? { internalEffectiveFrom: "", internalEffectiveTo: "" }
                      : {}),
                  })
                }
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

            {form.tenantType === "internal" && (
              <>
                <Field label="收入排除开始日">
                  <Input
                    type="date"
                    value={form.internalEffectiveFrom}
                    onChange={(e) => patch({ internalEffectiveFrom: e.target.value })}
                  />
                </Field>
                <Field label="收入排除结束日">
                  <Input
                    type="date"
                    value={form.internalEffectiveTo}
                    onChange={(e) => patch({ internalEffectiveTo: e.target.value })}
                  />
                </Field>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  起止日均留空表示全历史排除；填写后仅在与账期自然日有交集的月份排除。修改后需对相关账期撤回发布并重新计算收入。
                </p>
              </>
            )}

            {form.tenantType === "external" && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                外部租户计入月度收入、个人收入与提成基数，不应用收入排除规则。
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!form || !tenant || updateMutation.isPending}
            onClick={onSave}
          >
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
