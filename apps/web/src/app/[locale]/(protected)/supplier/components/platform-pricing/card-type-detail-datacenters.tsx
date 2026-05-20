'use client'

import { ChevronDown, ChevronRight, History, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type { PlatformDatacenterPriceGroupRow } from '@/lib/types/platform-pricing-views'
import type { SupplierDatacenterSellPrice } from '@/lib/types/platform-pricing'

const dcStatusVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  online: 'default',
  offline: 'secondary',
  maintenance: 'outline',
}

export type CardTypeDetailDatacentersProps = {
  datacenters: PlatformDatacenterPriceGroupRow[]
  onOpenDatacenterHistory: (dataCenterId: string, dataCenterName: string) => void
  onEditSellPrice: (record: SupplierDatacenterSellPrice) => void
  onAddSellPrice: (dataCenterId: string) => void
  resolveSellRecord: (
    dataCenterId: string,
    productLine: PlatformDatacenterPriceGroupRow['productLinePrices'][0]['productLine'],
    billingUnit: PlatformDatacenterPriceGroupRow['productLinePrices'][0]['billingUnit'],
  ) => SupplierDatacenterSellPrice | undefined
}

export function CardTypeDetailDatacenters({
  datacenters,
  onOpenDatacenterHistory,
  onEditSellPrice,
  onAddSellPrice,
  resolveSellRecord,
}: CardTypeDetailDatacentersProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(datacenters.length > 0 ? [datacenters[0]!.dataCenterId] : []),
  )

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">机房销售价</h2>
        <p className="text-sm text-muted-foreground">
          已接入 {datacenters.length} 个机房 · 展开查看产品线价格（按行）
        </p>
      </div>

      {datacenters.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          该卡型暂无接入机房
        </Card>
      ) : (
        <div className="space-y-2">
          {datacenters.map((dc) => {
            const isOpen = expanded.has(dc.dataCenterId)
            return (
              <Collapsible
                key={dc.dataCenterId}
                open={isOpen}
                onOpenChange={() => toggle(dc.dataCenterId)}
              >
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left hover:bg-muted/50 transition-colors rounded-md -m-1 p-1"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
                          <div>
                            <p className="font-medium text-sm">{dc.dataCenterName}</p>
                            <p className="text-xs text-muted-foreground">{dc.supplierName}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{dc.location}</p>
                          <Badge
                            variant={dcStatusVariant[dc.status] ?? 'outline'}
                            className="w-fit text-xs"
                          >
                            {dc.statusLabel}
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {dc.priceEntryCount} 条定价
                          </p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() =>
                          onOpenDatacenterHistory(dc.dataCenterId, dc.dataCenterName)
                        }
                      >
                        <History className="size-3.5" />
                        调价历史
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => onAddSellPrice(dc.dataCenterId)}
                      >
                        <Plus className="size-3.5" />
                        新增
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>产品线</TableHead>
                            <TableHead>租期</TableHead>
                            <TableHead>机房销售价</TableHead>
                            <TableHead>平台标准价</TableHead>
                            <TableHead>差价</TableHead>
                            <TableHead>来源</TableHead>
                            <TableHead className="w-[60px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dc.productLinePrices.map((row) => {
                            const record = resolveSellRecord(
                              dc.dataCenterId,
                              row.productLine,
                              row.billingUnit,
                            )
                            return (
                              <TableRow
                                key={`${dc.dataCenterId}:${row.productLine}:${row.billingUnit}`}
                              >
                                <TableCell className="text-sm">
                                  {row.productLineLabel}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {row.billingUnitLabel}
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                  {row.sellPrice != null ? (
                                    `¥${row.sellPrice.toFixed(2)}`
                                  ) : (
                                    <span className="text-muted-foreground font-normal">
                                      未配置
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {row.platformSellPrice != null
                                    ? `¥${row.platformSellPrice.toFixed(2)}`
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {row.deltaPercent != null ? (
                                    <span
                                      className={
                                        row.deltaPercent < 0
                                          ? 'text-green-600'
                                          : row.deltaPercent > 0
                                            ? 'text-orange-600'
                                            : 'text-muted-foreground'
                                      }
                                    >
                                      {row.deltaPercent > 0 ? '+' : ''}
                                      {row.deltaPercent.toFixed(1)}%
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {row.inheritPlatformPrice && (
                                    <Badge variant="outline" className="text-[10px] mr-1">
                                      继承
                                    </Badge>
                                  )}
                                  {row.sourceLabel}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={() =>
                                      record
                                        ? onEditSellPrice(record)
                                        : onAddSellPrice(dc.dataCenterId)
                                    }
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )
          })}
        </div>
      )}
    </div>
  )
}
