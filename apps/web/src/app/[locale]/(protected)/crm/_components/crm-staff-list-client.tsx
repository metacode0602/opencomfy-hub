"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"
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
import { STAFF_DEPARTMENTS, STAFF_POSITIONS, staffAppRoleLabel } from "@/lib/crm/staff-constants"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "./crm-delete-dialog"
import { CrmStaffFormDialog } from "./crm-staff-form-dialog"
import { CrmStaffStatusBadge } from "./crm-staff-status-badge"
import { toast } from "sonner"
import { useListPagination } from "@/hooks/use-list-pagination"
import { ListPagination } from "@/components/shared/list-pagination"

function defaultManagerLabels(staff: {
  is_default_pre_sales: boolean
  is_default_account_manager: boolean
  is_default_delivery_manager: boolean
  is_default_project_manager: boolean
}) {
  const labels: string[] = []
  if (staff.is_default_pre_sales) labels.push("售前")
  if (staff.is_default_account_manager) labels.push("客户经理")
  if (staff.is_default_delivery_manager) labels.push("交付")
  if (staff.is_default_project_manager) labels.push("项目经理")
  return labels
}

export function CrmStaffListClient() {
  const { data: userStaff = [], refetch } = trpc.crm.staff.list.useQuery({})
  const deleteMutation = trpc.crm.staff.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除员工")
      void refetch()
    },
    onError: (e) => toast.error(e.message),
  })

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all")
  const [positionFilter, setPositionFilter] = React.useState<string>("all")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return userStaff.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false
      if (departmentFilter !== "all" && s.department !== departmentFilter) return false
      if (positionFilter !== "all" && s.position !== positionFilter) return false
      if (!q) return true
      return (
        s.display_name.toLowerCase().includes(q) ||
        s.mobile.includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false) ||
        (s.employee_no?.toLowerCase().includes(q) ?? false) ||
        (s.department?.toLowerCase().includes(q) ?? false) ||
        (s.position?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [userStaff, search, statusFilter, departmentFilter, positionFilter])

  const pagination = useListPagination(filtered, {
    resetDeps: [search, statusFilter, departmentFilter, positionFilter],
  })

  const activeCount = userStaff.filter((s) => s.status === "active").length

  return (
    <div className="bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>员工管理</CardTitle>
            <CardDescription>
              内部员工主数据，用于客户经理分配与业务操作人（在职 {activeCount} 人）
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" type="button" onClick={() => setCreateOpen(true)}>
              <IconPlus className="size-4" />
              新建员工
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <Input
              placeholder="筛选：姓名 / 工号 / 手机 / 邮箱 / 部门 / 职位"
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
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="部门" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部部门</SelectItem>
                {STAFF_DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="职位" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部职位</SelectItem>
                {STAFF_POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>职位</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>手机</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">当前负责客户</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.totalItems === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground text-center">
                      暂无匹配员工
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.items.map((s) => {
                    const defaults = defaultManagerLabels(s)
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">
                          {s.employee_no ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">{s.display_name}</TableCell>
                        <TableCell>{s.department ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.position ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s.roles.length === 0 ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              s.roles.map((role) => (
                                <Badge key={role} variant="secondary" className="text-xs">
                                  {staffAppRoleLabel(role)}
                                </Badge>
                              ))
                            )}
                            {defaults.map((label) => (
                              <Badge key={label} variant="outline" className="text-xs">
                                默认{label}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{s.mobile}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <CrmStaffStatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.assignmentCount}
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
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            className="border-t-0 px-0"
          />
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
            ? `确定删除「${del.label}」吗？将同时结束其客户经理分配记录。`
            : ""
        }
        onConfirm={() => {
          if (del) deleteMutation.mutate({ id: del.id })
          setDel(null)
        }}
      />
    </div>
  )
}
