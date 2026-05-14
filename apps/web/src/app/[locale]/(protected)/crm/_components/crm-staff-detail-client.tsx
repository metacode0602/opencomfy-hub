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

export function CrmStaffDetailClient({ staffId }: { staffId: string }) {
  const router = useLocaleRouter()
  const user = useCrmMockStore((s) => s.userStaff.find((x) => x.id === staffId))
  const removeUserStaff = useCrmMockStore((s) => s.removeUserStaff)
  const [delOpen, setDelOpen] = React.useState(false)

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到员工。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/staff">返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <LocaleLink href="/crm/staff">返回</LocaleLink>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <LocaleLink href={`/crm/staff/${user.id}/edit`}>编辑</LocaleLink>
          </Button>
          <Button variant="destructive" size="sm" type="button" onClick={() => setDelOpen(true)}>
            删除
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{user.display_name}</CardTitle>
            <CardDescription>员工主键：{user.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="工号" value={user.employee_no ?? "—"} />
            <Row label="手机号" value={user.mobile} />
            <Row label="邮箱" value={user.email ?? "—"} />
            <Row label="状态" value={user.status} />
          </CardContent>
        </Card>
      </div>

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除员工？"
        description={`将删除「${user.display_name}」。`}
        onConfirm={() => {
          removeUserStaff(user.id)
          router.push("/crm/staff")
        }}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
