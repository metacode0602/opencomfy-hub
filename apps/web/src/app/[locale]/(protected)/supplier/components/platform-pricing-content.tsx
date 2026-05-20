'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DollarSign, Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PlatformPriceDialog } from '@/components/dashboard/platform-price-dialog'
import { mockGPUCardTypes } from '@/lib/data/mock-data'
import { mockPlatformCardPriceRecords } from '@/lib/data/platform-pricing-mock'
import type { PlatformCardPriceRecord } from '@/lib/types/platform-pricing'
import type { PlatformPricingListPageData } from '@/lib/types/platform-pricing-views'
import { CardTypeListView } from './platform-pricing/card-type-list-view'

type PlatformPricingContentProps = {
  initialData: PlatformPricingListPageData
}

export function PlatformPricingContent({ initialData }: PlatformPricingContentProps) {
  const [search, setSearch] = useState('')
  const [platformRecords, setPlatformRecords] = useState<PlatformCardPriceRecord[]>(
    () => mockPlatformCardPriceRecords.map((r) => ({ ...r })),
  )
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<PlatformCardPriceRecord | null>(null)

  const { stats, rows } = initialData

  const handlePlatformSaved = (record: PlatformCardPriceRecord, isNew: boolean) => {
    if (isNew) {
      setPlatformRecords((list) => [...list, record])
    } else {
      setPlatformRecords((list) => list.map((r) => (r.id === record.id ? record : r)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">平台定价体系</h1>
          <p className="text-sm text-muted-foreground">
            按卡型浏览平台标准价 · 点击详情管理产品线价格与机房销售价
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/supplier/unit-costs">
              <DollarSign className="size-4" />
              机房成本定价
            </Link>
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingPlatform(null)
              setPlatformDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            平台标准价
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{stats.cardTypeCount}</p>
            <p className="text-xs text-muted-foreground">启用卡型</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{stats.activePlatformPriceCount}</p>
            <p className="text-xs text-muted-foreground">生效平台价条目</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{stats.datacenterCardPairCount}</p>
            <p className="text-xs text-muted-foreground">机房×卡型组合</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{stats.sellPriceEntryCount}</p>
            <p className="text-xs text-muted-foreground">机房销售价条目</p>
          </CardContent>
        </Card>
      </div>

      <CardTypeListView rows={rows} search={search} onSearchChange={setSearch} />

      <PlatformPriceDialog
        open={platformDialogOpen}
        onOpenChange={setPlatformDialogOpen}
        existingRecords={platformRecords}
        cardTypes={mockGPUCardTypes}
        editing={editingPlatform}
        onSaved={handlePlatformSaved}
      />
    </div>
  )
}
