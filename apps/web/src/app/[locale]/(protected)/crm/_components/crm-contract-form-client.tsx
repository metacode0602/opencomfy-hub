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
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import type { ContractSnapshot } from "@/lib/types/crm"

export function CrmContractFormClient({ contractId }: { contractId?: string }) {
  const router = useLocaleRouter()
  const tenants = useCrmMockStore((s) => s.tenants)
  const rows = useCrmMockStore((s) => s.contractSnapshots)
  const upsertContract = useCrmMockStore((s) => s.upsertContract)
  const createGenericId = useCrmMockStore((s) => s.createGenericId)

  const existing = contractId ? rows.find((x) => x.id === decodeURIComponent(contractId)) : undefined
  const isEdit = Boolean(contractId && existing)

  const [form, setForm] = React.useState<ContractSnapshot>(() =>
    existing ?? {
      id: createGenericId("cs"),
      tenant_id: tenants[0]?.id ?? "",
      contract_no: "",
      contract_url: "",
      signed_on: null,
      amount_summary: null,
      external_crm_id: null,
    },
  )

  React.useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tenant_id) return
    upsertContract({
      ...form,
      contract_no: form.contract_no || null,
      contract_url: form.contract_url || null,
      signed_on: form.signed_on || null,
      amount_summary: form.amount_summary || null,
      external_crm_id: form.external_crm_id || null,
    })
    router.push(`/crm/contracts/${encodeURIComponent(form.id)}`)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{isEdit ? "编辑合同摘要" : "新建合同摘要"}</CardTitle>
          <CardDescription>关联租户必选</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>租户</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={form.tenant_id}
                onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
                required
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract_no">合同编号</Label>
              <Input
                id="contract_no"
                value={form.contract_no ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contract_no: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract_url">合同链接</Label>
              <Input
                id="contract_url"
                value={form.contract_url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contract_url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signed_on">签约生效日</Label>
              <Input
                id="signed_on"
                type="date"
                value={form.signed_on ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, signed_on: e.target.value || null }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount_summary">金额摘要</Label>
              <Input
                id="amount_summary"
                value={form.amount_summary ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, amount_summary: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external_crm_id">外部 CRM 合同 ID</Label>
              <Input
                id="external_crm_id"
                value={form.external_crm_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, external_crm_id: e.target.value }))}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <LocaleLink href={isEdit ? `/crm/contracts/${encodeURIComponent(form.id)}` : "/crm/contracts"}>
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
