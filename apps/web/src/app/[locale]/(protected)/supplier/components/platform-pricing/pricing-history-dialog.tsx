'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Input } from '@workspace/ui/components/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type {
  PlatformCardPriceHistory,
  SupplierDatacenterSellPriceHistory,
} from '@/lib/types/platform-pricing'
import {
  platformBillingUnitNames,
  platformProductLineNames,
} from '@/lib/types/platform-pricing'
import { formatDateTime } from './platform-pricing-utils'

type PricingHistoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'platform' | 'datacenter'
  title: string
  description?: string
  platformHistory?: PlatformCardPriceHistory[]
  datacenterHistory?: SupplierDatacenterSellPriceHistory[]
}

export function PricingHistoryDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  platformHistory = [],
  datacenterHistory = [],
}: PricingHistoryDialogProps) {
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    if (mode === 'platform') {
      return platformHistory.filter(
        (row) =>
          !q ||
          row.cardTypeName.toLowerCase().includes(q) ||
          platformProductLineNames[row.productLine].includes(q) ||
          (row.reason?.toLowerCase().includes(q) ?? false),
      )
    }
    return datacenterHistory.filter(
      (row) =>
        !q ||
        row.dataCenterName.toLowerCase().includes(q) ||
        platformProductLineNames[row.productLine].includes(q) ||
        (row.reason?.toLowerCase().includes(q) ?? false),
    )
  }, [mode, platformHistory, datacenterHistory, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant={mode === 'platform' ? 'default' : 'secondary'}>
              {mode === 'platform' ? '平台' : '机房'}
            </Badge>
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索产品线、原因..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-auto flex-1 -mx-1 px-1">
          <Table>
            <TableHeader>
              <TableRow>
                {mode === 'datacenter' && <TableHead>机房</TableHead>}
                <TableHead>产品线</TableHead>
                <TableHead>租期</TableHead>
                <TableHead>变更</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>原因</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={mode === 'datacenter' ? 7 : 6}
                    className="text-center text-muted-foreground py-8"
                  >
                    暂无调价记录
                  </TableCell>
                </TableRow>
              ) : mode === 'platform' ? (
                (rows as PlatformCardPriceHistory[]).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">
                      {platformProductLineNames[row.productLine]}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.productLine === 'bare_metal'
                        ? platformBillingUnitNames[row.billingUnit]
                        : '小时'}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">
                        {row.previousSellPrice != null
                          ? `¥${row.previousSellPrice.toFixed(2)}`
                          : '—'}
                      </span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">¥{row.newSellPrice.toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(row.changedAt)}
                    </TableCell>
                    <TableCell className="text-sm">{row.changedBy}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                      {row.reason ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                (rows as SupplierDatacenterSellPriceHistory[]).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{row.dataCenterName}</TableCell>
                    <TableCell className="text-sm">
                      {platformProductLineNames[row.productLine]}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.productLine === 'bare_metal'
                        ? platformBillingUnitNames[row.billingUnit]
                        : '小时'}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">
                        {row.previousSellPrice != null
                          ? `¥${row.previousSellPrice.toFixed(2)}`
                          : '—'}
                      </span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">¥{row.newSellPrice.toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(row.changedAt)}
                    </TableCell>
                    <TableCell className="text-sm">{row.changedBy}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                      {row.reason ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
