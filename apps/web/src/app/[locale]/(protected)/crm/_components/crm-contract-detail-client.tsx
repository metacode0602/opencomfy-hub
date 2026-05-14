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
import { CrmDeleteDialog } from "./crm-delete-dialog"

export function CrmContractDetailClient({ contractId }: { contractId: string }) {
  const id = decodeURIComponent(contractId)
  const router = useLocaleRouter()
  const row = useCrmMockStore((s) => s.contractSnapshots.find((x) => x.id === id))
  const removeContract = useCrmMockStore((s) => s.removeContract)
  const tenant = useCrmMockStore((s) => s.tenants.find((t) => t.id === row?.tenant_id))
  const [delOpen, setDelOpen] = React.useState(false)

  if (!row) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到记录。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/contracts">返回</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <LocaleLink href="/crm/contracts">返回列表</LocaleLink>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <LocaleLink href={`/crm/contracts/${encodeURIComponent(row.id)}/edit`}>编辑</LocaleLink>
          </Button>
          <Button variant="destructive" size="sm" type="button" onClick={() => setDelOpen(true)}>
            删除
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>合同摘要</CardTitle>
            <CardDescription>
              租户：{tenant?.account_name ?? row.tenant_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row l="合同编号" v={row.contract_no ?? "—"} />
            <Row l="合同链接" v={row.contract_url ?? "—"} />
            <Row l="签约生效日" v={row.signed_on ?? "—"} />
            <Row l="金额摘要" v={row.amount_summary ?? "—"} />
            <Row l="外部 CRM ID" v={row.external_crm_id ?? "—"} />
            <Button variant="link" className="h-auto px-0" asChild>
              <LocaleLink href={`/crm/tenants/${row.tenant_id}`}>进入租户详情</LocaleLink>
            </Button>
          </CardContent>
        </Card>
      </div>

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除？"
        description={row.contract_no ?? row.id}
        onConfirm={() => {
          removeContract(row.id)
          router.push("/crm/contracts")
        }}
      />
    </div>
  )
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <span className="text-muted-foreground">{l}</span>
      <span className="max-w-[60%] text-right font-medium break-all">{v}</span>
    </div>
  )
}
