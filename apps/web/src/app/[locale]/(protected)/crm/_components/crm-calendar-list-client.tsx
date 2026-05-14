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
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "./crm-delete-dialog"

export function CrmCalendarListClient() {
  const rows = useCrmMockStore((s) => s.calendarWorkdays)
  const removeCalendarWorkday = useCrmMockStore((s) => s.removeCalendarWorkday)
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>工作日历</CardTitle>
            <CardDescription>地区编码 + 日历日期 复合主键（mock）</CardDescription>
          </div>
          <Button asChild className="gap-2">
            <LocaleLink href="/crm/calendar/new">
              <IconPlus className="size-4" />
              新建
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>地区编码</TableHead>
                <TableHead>日历日期</TableHead>
                <TableHead>是否工作日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.region_code}</TableCell>
                  <TableCell className="tabular-nums">{r.calendar_date}</TableCell>
                  <TableCell>{r.is_workday ? "是" : "否"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <LocaleLink href={`/crm/calendar/${encodeURIComponent(r.id)}`}>
                          详情
                        </LocaleLink>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <LocaleLink href={`/crm/calendar/${encodeURIComponent(r.id)}/edit`}>
                          编辑
                        </LocaleLink>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        type="button"
                        onClick={() =>
                          setDel({ id: r.id, label: `${r.region_code} ${r.calendar_date}` })
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
        </CardContent>
      </Card>

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => {
          if (!o) setDel(null)
        }}
        title="确认删除工作日历行？"
        description={del ? del.label : ""}
        onConfirm={() => {
          if (del) removeCalendarWorkday(del.id)
        }}
      />
    </div>
  )
}
