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
import { Input } from "@workspace/ui/components/input"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "./crm-delete-dialog"

export function CrmTenantsListClient() {
  const tenants = useCrmMockStore((s) => s.tenants)
  const removeTenant = useCrmMockStore((s) => s.removeTenant)
  const [kw, setKw] = React.useState("")
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const rows = React.useMemo(() => {
    const q = kw.trim().toLowerCase()
    if (!q) return tenants
    return tenants.filter(
      (t) =>
        t.tenant_code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.account_name.toLowerCase().includes(q),
    )
  }, [tenants, kw])

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>租户</CardTitle>
            <CardDescription>
              客户经营主数据；子表从租户详情辐射进入（mock 数据 + 本地持久化）
            </CardDescription>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <LocaleLink href="/crm/tenants/new">
              <IconPlus className="size-4" />
              新建租户
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="筛选：租户编码 / 法定名称 / 经营展示名"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>租户编码</TableHead>
                  <TableHead>企业法定名称</TableHead>
                  <TableHead>经营展示名</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>生命周期阶段</TableHead>
                  <TableHead>转正日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.tenant_code}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.account_name}</TableCell>
                    <TableCell>{t.status}</TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell>{t.lifecycle_phase}</TableCell>
                    <TableCell className="tabular-nums">{t.conversion_date ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/crm/tenants/${t.id}`}>详情</LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/crm/tenants/${t.id}/edit`}>编辑</LocaleLink>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          type="button"
                          onClick={() =>
                            setDel({ id: t.id, label: t.account_name })
                          }
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => {
          if (!o) setDel(null)
        }}
        title="确认删除租户？"
        description={
          del
            ? `将删除「${del.label}」及其在本 mock 中的级联子数据（分配、券、里程碑等）。`
            : ""
        }
        onConfirm={() => {
          if (del) removeTenant(del.id)
        }}
      />
    </div>
  )
}
