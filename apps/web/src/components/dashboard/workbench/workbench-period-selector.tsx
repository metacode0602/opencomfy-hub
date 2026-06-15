'use client'

import {
  consumptionTrendCompareLabel,
  formatWorkbenchPeriodLabel,
} from '@/lib/crm/workbench-date-range'
import { Input } from '@workspace/ui/components/input'
import { ToggleGroup, ToggleGroupItem } from '@workspace/ui/components/toggle-group'
import { useWorkbenchPeriod } from './workbench-period-context'

export function WorkbenchPeriodSelector() {
  const { preset, startDate, endDate, setPreset, setCustomRange } = useWorkbenchPeriod()

  const periodLabel = formatWorkbenchPeriodLabel(startDate, endDate)
  const compareHint =
    preset === 'custom' ? consumptionTrendCompareLabel('custom') : consumptionTrendCompareLabel(preset)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">统计区间</p>
          <p className="text-xs text-muted-foreground">
            {periodLabel} · 消费 KPI {compareHint}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={preset === 'custom' ? undefined : preset}
          onValueChange={(value) => {
            if (!value) return
            setPreset(value as 'today' | 'last7days' | 'thisMonth')
          }}
          className="flex flex-wrap justify-start rounded-md border border-border/80 bg-muted/30 p-0.5"
        >
          <ToggleGroupItem value="today" className="h-8 px-3 text-xs data-[state=on]:bg-background">
            今天
          </ToggleGroupItem>
          <ToggleGroupItem
            value="last7days"
            className="h-8 px-3 text-xs data-[state=on]:bg-background"
          >
            7天
          </ToggleGroupItem>
          <ToggleGroupItem
            value="thisMonth"
            className="h-8 px-3 text-xs data-[state=on]:bg-background"
          >
            本月
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">指定日期</span>
        <Input
          type="date"
          className="h-8 w-[150px] text-xs"
          value={startDate}
          max={endDate}
          onChange={(e) => setCustomRange(e.target.value, endDate)}
        />
        <span className="text-xs text-muted-foreground">~</span>
        <Input
          type="date"
          className="h-8 w-[150px] text-xs"
          value={endDate}
          min={startDate}
          onChange={(e) => setCustomRange(startDate, e.target.value)}
        />
        {preset === 'custom' ? (
          <span className="text-xs text-muted-foreground">已选自定义区间</span>
        ) : null}
      </div>
    </div>
  )
}
