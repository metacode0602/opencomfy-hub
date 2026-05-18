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
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { CrmDeleteDialog } from "./crm-delete-dialog"
import { CrmStaffFormDialog } from "./crm-staff-form-dialog"
import { CrmStaffStatusBadge } from "./crm-staff-status-badge"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground mb-0.5 text-xs">{label}</div>
      <div className="text-sm break-all">{value}</div>
    </div>
  )
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

export function CrmStaffDetailClient({ staffId }: { staffId: string }) {
  const router = useLocaleRouter()
  const utils = trpc.useUtils()
  const { data: staff, isLoading } = trpc.crm.staff.getById.useQuery({ id: staffId })
  const { data: assignments = [] } = trpc.crm.staff.listAssignments.useQuery({ staffId })
  const deleteMutation = trpc.crm.staff.delete.useMutation({
    onSuccess: () => {
      toast.success("员工已删除")
      void utils.crm.staff.list.invalidate()
      router.push("/crm/staff")
    },
    onError: (e) => toast.error(e.message),
  })

  const [editOpen, setEditOpen] = React.useState(false)
  const [delOpen, setDelOpen] = React.useState(false)

  if (isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">加载中…</p>
  }

  if (!staff) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到员工。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/staff">返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  const label = staff.employee_no
    ? `${staff.display_name}（${staff.employee_no}）`
    : staff.display_name

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{staff.display_name}</h1>
            <p className="text-muted-foreground text-sm">
              {staff.employee_no ? `工号 ${staff.employee_no} · ` : ""}
              {staff.mobile}
              {staff.email ? ` · ${staff.email}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <LocaleLink href="/crm/staff">返回员工列表</LocaleLink>
            </Button>
            <Button variant="outline" type="button" onClick={() => setEditOpen(true)}>
              编辑
            </Button>
            <Button variant="destructive" type="button" onClick={() => setDelOpen(true)}>
              删除
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>内部员工主数据</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="主键" value={staff.id} />
            <Row label="工号" value={staff.employee_no ?? "—"} />
            <Row label="姓名" value={staff.display_name} />
            <Row label="手机" value={staff.mobile} />
            <Row label="邮箱" value={staff.email ?? "—"} />
            <div>
              <div className="text-muted-foreground mb-0.5 text-xs">状态</div>
              <CrmStaffStatusBadge status={staff.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>客户经理分配</CardTitle>
            <CardDescription>
              该员工在客户组合上的 AM 记录；可在客户详情中维护分配。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无分配记录。</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户组合</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>生效开始</TableHead>
                      <TableHead>生效结束</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Button variant="link" className="h-auto p-0 font-normal" asChild>
                            <LocaleLink href={`/crm/customers/${a.customer_id}`}>
                              {a.customer_name || a.customer_id}
                            </LocaleLink>
                          </Button>
                        </TableCell>
                        <TableCell>{a.role_type}</TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDateTime(a.effective_from)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {a.effective_to ? formatDateTime(a.effective_to) : "当前有效"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CrmStaffFormDialog open={editOpen} onOpenChange={setEditOpen} staffId={staffId} />

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除员工"
        description={`确定删除「${label}」吗？将同时结束其客户经理分配记录。`}
        onConfirm={() => deleteMutation.mutate({ id: staff.id })}
      />
    </div>
  )
}
