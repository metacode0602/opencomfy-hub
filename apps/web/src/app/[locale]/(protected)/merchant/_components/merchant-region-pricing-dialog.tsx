'use client'

import { useEffect, useMemo, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import type { MerchantDatacenterRegion, MerchantRegionPricingCell } from '@/lib/types/merchant'
import { platformProductLineNames } from '@/lib/types/platform-pricing'
import { formatMoney } from './merchant-utils'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

const PRICING_PRODUCT_LINES = [
  'elastic_service',
  'cloud_vm',
  'job',
  'spot',
] as const

type RegionPricingProductLine = (typeof PRICING_PRODUCT_LINES)[number]

type PriceCellKey = `${string}:${RegionPricingProductLine}`

function cellKey(cardTypeId: string, productLine: RegionPricingProductLine): PriceCellKey {
  return `${cardTypeId}:${productLine}`
}

export type MerchantRegionPricingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  region: MerchantDatacenterRegion | null
  onSaved: (payload: { regionId: string; effectiveFrom: string }) => void
}

export function MerchantRegionPricingDialog({
  open,
  onOpenChange,
  merchantId,
  region,
  onSaved,
}: MerchantRegionPricingDialogProps) {
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [prices, setPrices] = useState<Record<PriceCellKey, string>>({})

  const gpuCardTypeIds = region?.enabledCardTypeIds ?? []
  const cardTypes = region?.enabledCardTypes ?? []

  const formQuery = trpc.merchant.pricing.getRegionForm.useQuery(
    {
      merchantId,
      dataCenterId: region?.dataCenterId ?? '',
      gpuCardTypeIds,
      effectiveFrom: effectiveFrom || region?.effectiveFrom || '',
    },
    {
      enabled: open && !!region && gpuCardTypeIds.length > 0,
    },
  )

  const upsertMutation = trpc.merchant.pricing.batchUpsertForRegion.useMutation()

  const cellMap = useMemo(() => {
    const map = new Map<PriceCellKey, MerchantRegionPricingCell>()
    for (const cell of formQuery.data?.cells ?? []) {
      map.set(cellKey(cell.gpuCardTypeId, cell.productLine as RegionPricingProductLine), cell)
    }
    return map
  }, [formQuery.data])

  useEffect(() => {
    if (!open || !region) return
    setEffectiveFrom(region.effectiveFrom)
    setPrices({})
  }, [open, region])

  useEffect(() => {
    if (!formQuery.data) return

    if (formQuery.data.effectiveFrom && formQuery.data.effectiveFrom !== effectiveFrom) {
      setEffectiveFrom(formQuery.data.effectiveFrom)
    }

    const next: Record<PriceCellKey, string> = {}
    for (const cell of formQuery.data.cells) {
      const key = cellKey(cell.gpuCardTypeId, cell.productLine as RegionPricingProductLine)
      const fallback = cell.platformListPrice
      const value = cell.purchasePrice ?? fallback
      next[key] = value != null ? String(value) : ''
    }
    setPrices(next)
  }, [formQuery.data])

  const handleSubmit = async () => {
    if (!region) return
    if (!effectiveFrom.trim()) {
      toast.error('请指定生效开始时间')
      return
    }

    const items: {
      gpuCardTypeId: string
      productLine: RegionPricingProductLine
      purchasePrice: number
    }[] = []

    for (const card of cardTypes) {
      for (const pl of PRICING_PRODUCT_LINES) {
        const key = cellKey(card.id, pl)
        const raw = prices[key]?.trim()
        if (!raw) {
          toast.error(`请填写 ${card.name} · ${platformProductLineNames[pl]} 进货价`)
          return
        }
        const num = Number(raw)
        if (!Number.isFinite(num) || num < 0) {
          toast.error(`${card.name} · ${platformProductLineNames[pl]} 须为非负数字`)
          return
        }
        items.push({
          gpuCardTypeId: card.id,
          productLine: pl,
          purchasePrice: num,
        })
      }
    }

    try {
      await upsertMutation.mutateAsync({
        merchantId,
        dataCenterId: region.dataCenterId,
        effectiveFrom,
        items,
      })
      onSaved({ regionId: region.id, effectiveFrom })
      toast.success('区域进货价已保存')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存进货价失败')
    }
  }

  if (!region) return null

  const isLoading = formQuery.isLoading
  const isSubmitting = upsertMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="size-4" />
            配置区域进货价
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {region.displayName ?? region.dataCenterName} · {region.regionCode}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merchant-region-pricing-effective-from">
              生效开始时间 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="merchant-region-pricing-effective-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              新进货价自该自然日（含）起生效；未覆盖产品线仍继承 L1 平台刊例价。
            </p>
          </div>

          {formQuery.isError ? (
            <p className="text-sm text-destructive py-4">
              {formQuery.error.message || '加载进货价失败'}
            </p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground py-4">加载进货价…</p>
          ) : cardTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">该区域未启用卡型，请先配置卡型白名单。</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>卡型</TableHead>
                    {PRICING_PRODUCT_LINES.map((pl) => (
                      <TableHead key={pl} className="text-center text-xs">
                        {platformProductLineNames[pl]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardTypes.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="text-sm font-medium">{card.name}</TableCell>
                      {PRICING_PRODUCT_LINES.map((pl) => {
                        const key = cellKey(card.id, pl)
                        const cell = cellMap.get(key)
                        const listPrice = cell?.platformListPrice
                        return (
                          <TableCell key={pl} className="p-2">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 text-center text-sm tabular-nums"
                              value={prices[key] ?? ''}
                              onChange={(e) =>
                                setPrices((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                            />
                            <p className="text-[10px] text-muted-foreground text-center mt-1">
                              {listPrice != null ? (
                                <>刊例 ¥{formatMoney(listPrice)}</>
                              ) : (
                                '暂无 L1 刊例价'
                              )}
                            </p>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting || cardTypes.length === 0 || formQuery.isError}
          >
            {isSubmitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
