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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { Input } from "@workspace/ui/components/input"

export function SupplierSuppliersListClient() {
  const suppliers = useSupplierDomainMockStore((s) => s.suppliers)
  const removeSupplier = useSupplierDomainMockStore((s) => s.removeSupplier)
  const resetToSeed = useSupplierDomainMockStore((s) => s.resetToSeed)
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>供应商</CardTitle>
            <CardDescription>以供应商为中心进入合同、条款、接入与设备（mock 数据）</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => resetToSeed()}>
              恢复示例数据
            </Button>
            <Button size="sm" className="gap-2" asChild>
              <LocaleLink href="/supplier/new">
                <IconPlus className="size-4" />
                新建供应商
              </LocaleLink>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
        <Input
            placeholder="筛选：供应商编码 / 法定名称 / 简称"
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供应商编码</TableHead>
                <TableHead>法定名称</TableHead>
                <TableHead>简称</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.short_name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <LocaleLink href={`/supplier/${s.id}`}>详情</LocaleLink>
                    </Button>
                    <span className="text-muted-foreground mx-2">|</span>
                    <Button variant="link" className="h-auto p-0" asChild>
                      <LocaleLink href={`/supplier/${s.id}/edit`}>编辑</LocaleLink>
                    </Button>
                    <span className="text-muted-foreground mx-2">|</span>
                    <Button
                      variant="link"
                      className="text-destructive h-auto p-0"
                      type="button"
                      onClick={() =>
                        setDel({ id: s.id, label: `${s.short_name}（${s.code}）` })
                      }
                    >
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
