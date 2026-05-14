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

export function CrmCalendarDetailClient({ recordId }: { recordId: string }) {
  const id = decodeURIComponent(recordId)
  const router = useLocaleRouter()
  const row = useCrmMockStore((s) => s.calendarWorkdays.find((x) => x.id === id))
  const removeCalendarWorkday = useCrmMockStore((s) => s.removeCalendarWorkday)
  const [delOpen, setDelOpen] = React.useState(false)

  if (!row) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到记录。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/calendar">返回</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <LocaleLink href="/crm/calendar">返回</LocaleLink>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <LocaleLink href={`/crm/calendar/${encodeURIComponent(row.id)}/edit`}>编辑</LocaleLink>
          </Button>
          <Button variant="destructive" size="sm" type="button" onClick={() => setDelOpen(true)}>
            删除
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>工作日历</CardTitle>
            <CardDescription>记录 id：{row.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">地区编码</span>
              <span className="font-medium">{row.region_code}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">日历日期</span>
              <span className="font-medium">{row.calendar_date}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">是否工作日</span>
              <span className="font-medium">{row.is_workday ? "是" : "否"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除？"
        description={`${row.region_code} ${row.calendar_date}`}
        onConfirm={() => {
          removeCalendarWorkday(row.id)
          router.push("/crm/calendar")
        }}
      />
    </div>
  )
}
