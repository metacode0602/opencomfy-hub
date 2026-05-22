'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DollarSign, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PlatformPriceDialog } from '@/components/dashboard/platform-price-dialog'
import type { PlatformCardPriceRecord } from '@/lib/types/platform-pricing'
import { trpc } from '@/lib/trpc/client'
import { CardTypeListView } from './platform-pricing/card-type-list-view'

export function PlatformPricingContent() {
  const [search, setSearch] = useState('')
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<PlatformCardPriceRecord | null>(null)

  const utils = trpc.useUtils()
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.platformPricing.listPage.useQuery()

  const { data: cardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery()
  const { data: platformRecords = [] } = trpc.supplier.platformPricing.listRecords.useQuery()

  const createMutation = trpc.supplier.platformPricing.create.useMutation({
    onSuccess: async () => {
      toast.success('平台标准价已创建')
      setPlatformDialogOpen(false)
      await utils.supplier.platformPricing.listPage.invalidate()
      await utils.supplier.platformPricing.listRecords.invalidate()
    },
    onError: (e) => toast.error(e.message || '创建失败，请稍后重试'),
  })

  const updateMutation = trpc.supplier.platformPricing.update.useMutation({
    onSuccess: async () => {
      toast.success('平台标准价已更新')
      setPlatformDialogOpen(false)
      await utils.supplier.platformPricing.listPage.invalidate()
      await utils.supplier.platformPricing.listRecords.invalidate()
    },
    onError: (e) => toast.error(e.message || '更新失败，请稍后重试'),
  })

  const stats = data?.stats ?? {
    cardTypeCount: 0,
    activePlatformPriceCount: 0,
    datacenterCardPairCount: 0,
    sellPriceEntryCount: 0,
  }
  const rows = data?.rows ?? []

  const handlePlatformSaved = (
    record: PlatformCardPriceRecord,
    isNew: boolean,
    form: {
      gpuCardTypeId: string
      productLine: PlatformCardPriceRecord['productLine']
      billingUnit: PlatformCardPriceRecord['billingUnit']
      sellPrice: number
      effectiveFrom: string
      status: PlatformCardPriceRecord['status']
      remark?: string
    },
  ) => {
    if (isNew) {
      createMutation.mutate(form)
      return
    }
    updateMutation.mutate({
      recordId: record.id,
      ...form,
    })
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">平台定价</h1>
          <p className="text-sm text-muted-foreground">
            按卡型维护平台刊例价（L1）；点击详情可管理各产品线价格
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/supplier/gpu-card-types">系统卡型</Link>
          </Button>
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
            disabled={cardTypes.length === 0}
          >
            <Plus className="size-4" />
            平台标准价
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">{error.message || '加载平台定价失败'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      )}

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

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : (
        <CardTypeListView rows={rows} search={search} onSearchChange={setSearch} />
      )}

      <PlatformPriceDialog
        open={platformDialogOpen}
        onOpenChange={setPlatformDialogOpen}
        existingRecords={platformRecords}
        cardTypes={cardTypes}
        editing={editingPlatform}
        isSubmitting={isSaving}
        onSaved={handlePlatformSaved}
      />
    </div>
  )
}
