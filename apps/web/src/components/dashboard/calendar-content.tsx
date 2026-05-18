'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { cn } from '@workspace/ui/lib/utils'
import { LocaleLink } from '@/lib/i18n/navigation'
import {
  useActivityTypeName,
  useStaffName,
  useTenantName,
} from '@/lib/crm/crm-lookups'
import { useCrmMockStore } from '@/lib/stores/crm-mock-store'
import type { AccountActivity } from '@/lib/types/crm'

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function formatDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return { date, inMonth: date.getMonth() === month }
  })
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function ActivityDetailDialog({
  activity,
  open,
  onOpenChange,
}: {
  activity: AccountActivity | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tenantName = useTenantName(activity?.tenant_id)
  const typeName = useActivityTypeName(activity?.activity_type_id)
  const actor = useStaffName(activity?.actor_user_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {activity ? (
          <>
            <DialogHeader>
              <DialogTitle>{activity.title_snapshot ?? '客户动态'}</DialogTitle>
              <DialogDescription>
                {tenantName} · {typeName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <DetailRow label="业务发生时间" value={formatDateTime(activity.occurred_at)} />
              <DetailRow label="客户" value={tenantName} />
              <DetailRow label="动态类型" value={typeName} />
              <DetailRow label="关联业务域" value={activity.ref_domain ?? '—'} />
              <DetailRow label="关联记录 ID" value={activity.ref_id ?? '—'} />
              <DetailRow label="内部操作者" value={actor} />
              <DetailRow label="可见性" value={activity.visibility ?? '—'} />
              <div>
                <div className="text-muted-foreground mb-1">摘要快照</div>
                <p>{activity.summary_snapshot ?? '—'}</p>
              </div>
              {activity.payload && Object.keys(activity.payload).length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">扩展数据</div>
                  <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">
                    {JSON.stringify(activity.payload, null, 2)}
                  </pre>
                </div>
              )}
              <Button variant="link" className="h-auto px-0" asChild>
                <LocaleLink href={`/crm/tenants/${activity.tenant_id}`}>
                  进入客户详情
                </LocaleLink>
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="max-w-[65%] text-right font-medium break-all">{value}</span>
    </div>
  )
}

function DayActivityItem({
  activity,
  onSelect,
}: {
  activity: AccountActivity
  onSelect: (activity: AccountActivity) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(activity)}
      className="hover:bg-accent group flex w-full items-start gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors"
    >
      <span className="text-muted-foreground tabular-nums shrink-0">
        {formatTime(activity.occurred_at)}
      </span>
      <span className="truncate font-medium group-hover:text-primary">
        {activity.title_snapshot ?? '未命名动态'}
      </span>
    </button>
  )
}

export function CalendarContent() {
  const today = useMemo(() => new Date(), [])
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedActivity, setSelectedActivity] = useState<AccountActivity | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const activities = useCrmMockStore((s) => s.accountActivities)

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, AccountActivity[]>()
    for (const activity of activities) {
      const key = formatDateKey(new Date(activity.occurred_at))
      const list = map.get(key) ?? []
      list.push(activity)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    }
    return map
  }, [activities])

  const monthDays = useMemo(() => getMonthGrid(viewMonth), [viewMonth])
  const monthActivityCount = useMemo(() => {
    let count = 0
    for (const { date, inMonth } of monthDays) {
      if (!inMonth) continue
      count += activitiesByDay.get(formatDateKey(date))?.length ?? 0
    }
    return count
  }, [monthDays, activitiesByDay])

  const goPrevMonth = () => {
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  const goNextMonth = () => {
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const goToday = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const handleSelectActivity = (activity: AccountActivity) => {
    setSelectedActivity(activity)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">活动日历</h1>
          <p className="text-muted-foreground text-sm">
            按业务发生时间展示客户动态，点击条目查看详情
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrevMonth} aria-label="上个月">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[8rem] text-center text-sm font-semibold tabular-nums">
            {formatMonthTitle(viewMonth)}
          </span>
          <Button variant="outline" size="icon" onClick={goNextMonth} aria-label="下个月">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            今天
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{formatMonthTitle(viewMonth)}</CardTitle>
            <Badge variant="secondary">本月 {monthActivityCount} 条动态</Badge>
          </div>
          <CardDescription>周一至周日排列，灰色日期为相邻月份</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 border-b">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-muted-foreground border-r px-2 py-2 text-center text-xs font-medium last:border-r-0"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map(({ date, inMonth }) => {
              const key = formatDateKey(date)
              const dayActivities = activitiesByDay.get(key) ?? []
              const isToday = isSameDay(date, today)

              return (
                <div
                  key={key}
                  className={cn(
                    'border-r border-b min-h-[7.5rem] flex flex-col p-1.5 last:border-r-0',
                    !inMonth && 'bg-muted/30',
                    isToday && 'bg-primary/5',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums',
                        !inMonth && 'text-muted-foreground',
                        isToday && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {dayActivities.length > 0 && (
                      <span className="text-muted-foreground text-[10px] tabular-nums">
                        {dayActivities.length}
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                    {dayActivities.map((activity) => (
                      <DayActivityItem
                        key={activity.id}
                        activity={activity}
                        onSelect={handleSelectActivity}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <ActivityDetailDialog
        activity={selectedActivity}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}
