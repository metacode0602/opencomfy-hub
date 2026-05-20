'use client'

import { CalendarRange, Pencil, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { cn } from '@workspace/ui/lib/utils'
import type { PlatformCardPricePeriodRow } from '@/lib/types/platform-pricing-views'

const phaseVariant: Record<
  PlatformCardPricePeriodRow['phase'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  current: 'default',
  scheduled: 'secondary',
  expired: 'outline',
  draft: 'outline',
}

export type CardTypeDetailPeriodsProps = {
  periods: PlatformCardPricePeriodRow[]
  selectedPeriodId: string | null
  onSelectPeriod: (periodId: string) => void
  onAddPeriod: () => void
  onEditPeriod: (period: PlatformCardPricePeriodRow) => void
}

export function CardTypeDetailPeriods({
  periods,
  selectedPeriodId,
  onSelectPeriod,
  onAddPeriod,
  onEditPeriod,
}: CardTypeDetailPeriodsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarRange className="size-5 text-muted-foreground" />
            有效时间段
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            同一卡型可配置多段有效期，区间不可重叠；仅一段为「当前有效」
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={onAddPeriod}>
          <Plus className="size-4" />
          新增时间段
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>有效期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-center">定价条目</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  暂无时间段，请先新增
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period) => {
                const selected = period.periodId === selectedPeriodId
                return (
                  <TableRow
                    key={period.periodId}
                    className={cn(
                      'cursor-pointer',
                      selected && 'bg-muted/60',
                    )}
                    onClick={() => onSelectPeriod(period.periodId)}
                  >
                    <TableCell className="text-sm font-medium">
                      {period.rangeLabel}
                      {period.isCurrent && (
                        <Badge variant="default" className="ml-2 text-[10px]">
                          当前
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={phaseVariant[period.phase]}
                        className="text-xs"
                      >
                        {period.phaseLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {period.priceEntryCount}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEditPeriod(period)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
