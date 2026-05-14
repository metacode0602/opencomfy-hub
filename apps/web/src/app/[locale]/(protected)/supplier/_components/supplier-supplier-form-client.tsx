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
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import type { Supplier } from "@/lib/types/supplier-domain"

export function SupplierSupplierFormClient({
  supplierId,
  mode,
}: {
  supplierId?: string
  mode: "create" | "edit"
}) {
  const router = useLocaleRouter()
  const existing = useSupplierDomainMockStore((s) =>
    supplierId ? s.suppliers.find((x) => x.id === supplierId) : undefined,
  )
  const upsert = useSupplierDomainMockStore((s) => s.upsertSupplier)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [code, setCode] = React.useState("")
  const [name, setName] = React.useState("")
  const [shortName, setShortName] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setCode(existing.code)
      setName(existing.name)
      setShortName(existing.short_name)
    }
  }, [mode, existing])

  if (mode === "edit" && supplierId && !existing) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到供应商。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/supplier">返回</LocaleLink>
        </Button>
      </div>
    )
  }

  const onSave = () => {
    const id = mode === "edit" && supplierId ? supplierId : createId("sup")
    const row: Supplier = { id, code, name, short_name: shortName }
    upsert(row)
    router.push(`/supplier/${id}`)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建供应商" : "编辑供应商"}</CardTitle>
          <CardDescription>基本信息（mock）</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="code">供应商编码</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">法定名称</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="short">简称</Label>
            <Input id="short" value={shortName} onChange={(e) => setShortName(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave}>
            保存
          </Button>
          <Button variant="outline" type="button" asChild>
            <LocaleLink href={mode === "edit" && supplierId ? `/supplier/${supplierId}` : "/supplier"}>
              取消
            </LocaleLink>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
