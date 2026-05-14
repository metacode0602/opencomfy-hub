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

export function CrmStaffListClient() {
  const rows = useCrmMockStore((s) => s.userStaff)
  const removeUserStaff = useCrmMockStore((s) => s.removeUserStaff)
  const [kw, setKw] = React.useState("")
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const filtered = React.useMemo(() => {
    const q = kw.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        (u.employee_no?.toLowerCase().includes(q) ?? false) ||
        (u.email?.toLowerCase().includes(q) ?? false),
    )
  }, [rows, kw])

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>内部员工</CardTitle>
            <CardDescription>客户经理与操作者主数据（mock）</CardDescription>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <LocaleLink href="/crm/staff/new">
              <IconPlus className="size-4" />
              新建员工
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="筛选：姓名 / 工号 / 邮箱"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工号</TableHead>
                  <TableHead>显示姓名</TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.employee_no ?? "—"}</TableCell>
                    <TableCell className="font-medium">{u.display_name}</TableCell>
                    <TableCell className="tabular-nums">{u.mobile}</TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
                    <TableCell>{u.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/crm/staff/${u.id}`}>详情</LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/crm/staff/${u.id}/edit`}>编辑</LocaleLink>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          type="button"
                          onClick={() => setDel({ id: u.id, label: u.display_name })}
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
        title="确认删除员工？"
        description={del ? `将删除「${del.label}」；若仍被业务引用，仅作 mock 演示。` : ""}
        onConfirm={() => {
          if (del) removeUserStaff(del.id)
        }}
      />
    </div>
  )
}
