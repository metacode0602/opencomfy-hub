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
import type { CalendarWorkday } from "@/lib/types/crm"
import { calendarWorkdayRecordId } from "@/lib/types/crm"

export function CrmCalendarFormClient({ recordId }: { recordId?: string }) {
  const router = useLocaleRouter()
  const rows = useCrmMockStore((s) => s.calendarWorkdays)
  const upsertCalendarWorkday = useCrmMockStore((s) => s.upsertCalendarWorkday)

  const idDecoded = recordId ? decodeURIComponent(recordId) : undefined
  const existing = idDecoded ? rows.find((x) => x.id === idDecoded) : undefined
  const isEdit = Boolean(recordId && existing)

  const [region_code, setRc] = React.useState(existing?.region_code ?? "CN")
  const [calendar_date, setCd] = React.useState(existing?.calendar_date ?? "2026-05-13")
  const [is_workday, setWd] = React.useState(existing?.is_workday ?? true)
  const [oldId, setOldId] = React.useState(existing?.id ?? "")

  React.useEffect(() => {
    if (existing) {
      setRc(existing.region_code)
      setCd(existing.calendar_date)
      setWd(existing.is_workday)
      setOldId(existing.id)
    }
  }, [existing])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const nextId = calendarWorkdayRecordId({ region_code, calendar_date })
    const row: CalendarWorkday = {
      id: isEdit ? oldId : nextId,
      region_code,
      calendar_date,
      is_workday,
    }
    upsertCalendarWorkday(row)
    router.push(`/crm/calendar/${encodeURIComponent(nextId)}`)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{isEdit ? "编辑工作日历" : "新建工作日历"}</CardTitle>
          <CardDescription>保存后合成 id：地区__日期</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="region_code">地区编码</Label>
              <Input id="region_code" value={region_code} onChange={(e) => setRc(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar_date">日历日期</Label>
              <Input id="calendar_date" type="date" value={calendar_date} onChange={(e) => setCd(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_workday"
                type="checkbox"
                checked={is_workday}
                onChange={(e) => setWd(e.target.checked)}
              />
              <Label htmlFor="is_workday">是否工作日</Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <LocaleLink href="/crm/calendar">取消</LocaleLink>
            </Button>
            <Button type="submit">保存</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
