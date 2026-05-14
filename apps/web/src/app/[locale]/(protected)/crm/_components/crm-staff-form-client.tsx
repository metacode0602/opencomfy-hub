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
import type { UserStaff } from "@/lib/types/crm"

export function CrmStaffFormClient({ staffId }: { staffId?: string }) {
  const router = useLocaleRouter()
  const rows = useCrmMockStore((s) => s.userStaff)
  const upsertUserStaff = useCrmMockStore((s) => s.upsertUserStaff)
  const createStaffId = useCrmMockStore((s) => s.createStaffId)

  const existing = staffId ? rows.find((x) => x.id === staffId) : undefined
  const isEdit = Boolean(staffId && existing)

  const [form, setForm] = React.useState<UserStaff>(() =>
    existing ?? {
      id: createStaffId(),
      employee_no: "",
      display_name: "",
      mobile: "",
      email: "",
      status: "active",
    },
  )

  React.useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.display_name.trim() || !form.mobile.trim()) return
    upsertUserStaff({
      ...form,
      employee_no: form.employee_no || null,
      email: form.email || null,
    })
    router.push(`/crm/staff/${form.id}`)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{isEdit ? "编辑员工" : "新建员工"}</CardTitle>
          <CardDescription>字段与 `user_staff` 对齐（mock）</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee_no">工号</Label>
              <Input
                id="employee_no"
                value={form.employee_no ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, employee_no: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">显示姓名</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">手机号</Label>
              <Input
                id="mobile"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <Input
                id="status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <LocaleLink href={isEdit ? `/crm/staff/${form.id}` : "/crm/staff"}>取消</LocaleLink>
            </Button>
            <Button type="submit">保存</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
