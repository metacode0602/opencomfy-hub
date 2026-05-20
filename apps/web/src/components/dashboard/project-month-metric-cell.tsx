import { cn } from '@workspace/ui/lib/utils'

type ProjectMonthMetricCellProps = {
  lastMonth: number
  thisMonth: number
}

function formatAmount(value: number) {
  return `¥${value.toLocaleString()}`
}

export function ProjectMonthMetricCell({ lastMonth, thisMonth }: ProjectMonthMetricCellProps) {
  const thisMonthClass =
    thisMonth > lastMonth
      ? 'text-green-500'
      : thisMonth < lastMonth
        ? 'text-red-500'
        : 'text-muted-foreground'

  return (
    <div className="text-sm tabular-nums">
      <span className="text-muted-foreground">{formatAmount(lastMonth)}</span>
      <span className="text-muted-foreground mx-1">/</span>
      <span className={cn('font-medium', thisMonthClass)}>{formatAmount(thisMonth)}</span>
    </div>
  )
}
