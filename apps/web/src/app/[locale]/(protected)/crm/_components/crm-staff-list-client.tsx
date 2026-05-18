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
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "./crm-delete-dialog"
import { CrmStaffFormDialog } from "./crm-staff-form-dialog"
import { CrmStaffStatusBadge } from "./crm-staff-status-badge"

function countActiveAssignments(
  staffId: string,
  assignments: { user_staff_id: string; effective_to: string | null }[],
) {
  return assignments.filter(
    (a) => a.user_staff_id === staffId && a.effective_to == null,
  ).length
}

export function CrmStaffListClient() {
  const userStaff = useCrmMockStore((s) => s.userStaff)
  const assignments = useCrmMockStore((s) => s.accountManagerAssignments)
  const removeUserStaff = useCrmMockStore((s) => s.removeUserStaff)
  const resetToSeed = useCrmMockStore((s) => s.resetToSeed)

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return userStaff.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false
      if (!q) return true
      return (
        s.display_name.toLowerCase().includes(q) ||
        s.mobile.includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false) ||
        (s.employee_no?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [userStaff, search, statusFilter])

  const activeCount = userStaff.filter((s) => s.status === "active").length

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>员工管理</CardTitle>
            <CardDescription>
              内部员工主数据，用于客户经理分配与业务操作人（mock · 在职 {activeCount} 人）
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => resetToSeed()}>
              恢复示例数据
            </Button>
            <Button size="sm" className="gap-2" type="button" onClick={() => setCreateOpen(true)}>
              <IconPlus className="size-4" />
              新建员工
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="筛选：姓名 / 工号 / 手机 / 邮箱"
              className="max-w-md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">在职</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>手机</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">当前负责客户</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      暂无匹配员工
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">
                        {s.employee_no ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium">{s.display_name}</TableCell>
                      <TableCell>{s.mobile}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <CrmStaffStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {countActiveAssignments(s.id, assignments)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="link" className="h-auto p-0" asChild>
                          <LocaleLink href={`/crm/staff/${s.id}`}>详情</LocaleLink>
                        </Button>
                        <span className="text-muted-foreground mx-2">|</span>
                        <Button
                          variant="link"
                          className="h-auto p-0"
                          type="button"
                          onClick={() => setEditId(s.id)}
                        >
                          编辑
                        </Button>
                        <span className="text-muted-foreground mx-2">|</span>
                        <Button
                          variant="link"
                          className="text-destructive h-auto p-0"
                          type="button"
                          onClick={() =>
                            setDel({
                              id: s.id,
                              label: s.employee_no
                                ? `${s.display_name}（${s.employee_no}）`
                                : s.display_name,
                            })
                          }
                        >
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CrmStaffFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CrmStaffFormDialog
        open={editId != null}
        onOpenChange={(o) => !o && setEditId(null)}
        staffId={editId ?? undefined}
      />

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => !o && setDel(null)}
        title="确认删除员工"
        description={
          del
            ? `确定删除「${del.label}」吗？将同时移除其客户经理分配记录（mock）。`
            : ""
        }
        onConfirm={() => {
          if (del) removeUserStaff(del.id)
          setDel(null)
        }}
      />
    </div>
  )
}
