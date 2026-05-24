'use client'

import { History, Pencil, Plus } from 'lucide-react'
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
import type {
  PlatformCardPricePeriodRow,
  PlatformProductLinePriceRow,
} from '@/lib/types/platform-pricing-views'
import type { PlatformCardPriceRecord } from '@/lib/types/platform-pricing'

export type CardTypeDetailPlatformPricesProps = {
  selectedPeriod: PlatformCardPricePeriodRow | null
  rows: PlatformProductLinePriceRow[]
  platformHistoryCount: number
  onOpenHistory: () => void
  onAddPrice: () => void
  onEditPrice: (record: PlatformCardPriceRecord) => void
  resolveRecord: (
    row: PlatformProductLinePriceRow,
  ) => PlatformCardPriceRecord | undefined
}

export function CardTypeDetailPlatformPrices({
  selectedPeriod,
  rows,
  platformHistoryCount,
  onOpenHistory,
  onAddPrice,
  onEditPrice,
  resolveRecord,
}: CardTypeDetailPlatformPricesProps) {
  const configured = rows.filter((r) => r.recordId != null)
  const readOnly =
    selectedPeriod != null &&
    configured.length > 0 &&
    (selectedPeriod.phase === 'expired' || selectedPeriod.phase === 'scheduled')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">平台标准价</h2>
          {selectedPeriod ? (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <span>时间段：{selectedPeriod.rangeLabel}</span>
              <Badge variant="outline" className="text-xs">
                {selectedPeriod.phaseLabel}
              </Badge>
              <span>· 已配置 {configured.length} 条</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">请先选择或新增有效时间段</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="gap-2" onClick={onOpenHistory}>
            <History className="size-4" />
            调价历史
            {platformHistoryCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {platformHistoryCount}
              </Badge>
            )}
          </Button>
          <Button
            className="gap-2"
            onClick={onAddPrice}
            disabled={!selectedPeriod || readOnly}
          >
            <Plus className="size-4" />
            新增产品线价
          </Button>
        </div>
      </div>

      {!selectedPeriod ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          在上方选择有效时间段后，可配置该段内的产品线 × 租期价格
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>产品线</TableHead>
                <TableHead>租期单位</TableHead>
                <TableHead>销售单价</TableHead>
                <TableHead>条目状态</TableHead>
                {!readOnly && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const record = resolveRecord(row)
                return (
                  <TableRow key={`${row.productLine}:${row.billingUnit}`}>
                    <TableCell className="text-sm font-medium">
                      {row.productLineLabel}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.billingUnitLabel}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.sellPrice != null ? (
                        <span className="font-semibold">¥{row.sellPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === 'active' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            record ? onEditPrice(record) : onAddPrice()
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
