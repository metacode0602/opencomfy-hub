'use client'

import { ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type { PlatformCardTypeListRow } from '@/lib/types/platform-pricing-views'

export type CardTypeListViewProps = {
  rows: PlatformCardTypeListRow[]
  search: string
  onSearchChange: (v: string) => void
}

export function CardTypeListView({ rows, search, onSearchChange }: CardTypeListViewProps) {
  const q = search.toLowerCase()
  const filtered = rows.filter(
    (row) =>
      !q ||
      row.cardTypeName.toLowerCase().includes(q) ||
      row.manufacturer.toLowerCase().includes(q) ||
      row.productLinesLabel.includes(q),
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索卡型、厂商、产品线..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>卡型</TableHead>
              <TableHead>厂商</TableHead>
              <TableHead>显存</TableHead>
              <TableHead>价格摘要</TableHead>
              <TableHead>已配置产品线</TableHead>
              <TableHead className="text-center">平台价条目</TableHead>
              <TableHead className="text-center">机房</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  暂无匹配的卡型
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.cardTypeId}>
                  <TableCell className="font-medium text-sm">{row.cardTypeName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.manufacturer}
                  </TableCell>
                  <TableCell className="text-sm">{row.memoryGB} GB</TableCell>
                  <TableCell className="text-sm font-medium">{row.priceSummary}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {row.productLinesLabel}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {row.activePlatformPriceCount}/{row.platformPriceCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{row.datacenterCount}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="gap-1" asChild>
                      <Link href={`/supplier/platform-pricing/${row.cardTypeId}`}>
                        详情
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
