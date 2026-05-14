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
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import { SupplierHubCards } from "./supplier-hub-cards"
import { CrmDeleteDialog } from "../../crm/_components/crm-delete-dialog"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground mb-0.5 text-xs">{label}</div>
      <div className="text-sm break-all">{value}</div>
    </div>
  )
}

export function SupplierDetailClient({ supplierId }: { supplierId: string }) {
  const router = useLocaleRouter()
  const supplier = useSupplierDomainMockStore((s) => s.suppliers.find((x) => x.id === supplierId))
  const removeSupplier = useSupplierDomainMockStore((s) => s.removeSupplier)
  const [delOpen, setDelOpen] = React.useState(false)

  if (!supplier) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到供应商。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/supplier">返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{supplier.short_name}</h1>
            <p className="text-muted-foreground text-sm">
              {supplier.code} · {supplier.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <LocaleLink href="/supplier">返回供应商列表</LocaleLink>
            </Button>
            <Button variant="outline" asChild>
              <LocaleLink href={`/supplier/${supplier.id}/edit`}>编辑</LocaleLink>
            </Button>
            <Button variant="destructive" type="button" onClick={() => setDelOpen(true)}>
              删除
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>只读展示（mock）</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="主键" value={supplier.id} />
            <Row label="供应商编码" value={supplier.code} />
            <Row label="法定名称" value={supplier.name} />
            <Row label="简称" value={supplier.short_name} />
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-medium">辐射导航</h2>
          <SupplierHubCards supplierId={supplier.id} />
        </div>
      </div>

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除供应商"
        description={`确定删除「${supplier.short_name}（${supplier.code}）」吗？将级联删除关联 mock 数据。`}
        onConfirm={() => {
          removeSupplier(supplier.id)
          router.push("/supplier")
        }}
      />
    </div>
  )
}
