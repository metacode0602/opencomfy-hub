'use client'

import { useEffect, useMemo, useState } from 'react'
import { Cpu } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import type { MerchantDatacenterRegion } from '@/lib/types/merchant'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Label } from '@workspace/ui/components/label'
import { Switch } from '@workspace/ui/components/switch'
import { cn } from '@workspace/ui/lib/utils'

export type MerchantRegionCardTypesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  region: MerchantDatacenterRegion | null
  onSaved: (region: MerchantDatacenterRegion) => void
}

export function MerchantRegionCardTypesDialog({
  open,
  onOpenChange,
  merchantId,
  region,
  onSaved,
}: MerchantRegionCardTypesDialogProps) {
  const [enabledIds, setEnabledIds] = useState<string[]>([])
  const updateMutation = trpc.merchant.region.updateCardTypes.useMutation()

  const cardTypes = region?.availableCardTypes ?? []
  const enabledCount = useMemo(
    () => cardTypes.filter((card) => enabledIds.includes(card.id)).length,
    [cardTypes, enabledIds],
  )

  useEffect(() => {
    if (!open || !region) return
    setEnabledIds(region.enabledCardTypeIds)
  }, [open, region])

  const handleToggle = (cardTypeId: string, nextEnabled: boolean) => {
    setEnabledIds((prev) => {
      if (nextEnabled) {
        return prev.includes(cardTypeId) ? prev : [...prev, cardTypeId]
      }
      const next = prev.filter((id) => id !== cardTypeId)
      if (next.length === 0) {
        toast.error('至少须保留一种启用卡型')
        return prev
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (!region) return
    if (enabledIds.length === 0) {
      toast.error('至少须保留一种启用卡型')
      return
    }

    try {
      const updated = await updateMutation.mutateAsync({
        merchantId,
        regionId: region.id,
        enabledCardTypeIds: enabledIds,
      })
      onSaved(updated)
      toast.success('卡型配置已保存')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存卡型配置失败')
    }
  }

  const isSubmitting = updateMutation.isPending
  const hasChanges =
    !!region &&
    (enabledIds.length !== region.enabledCardTypeIds.length ||
      enabledIds.some((id) => !region.enabledCardTypeIds.includes(id)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="size-4" />
            配置启用卡型
          </DialogTitle>
        </DialogHeader>

        {cardTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">该机房暂无可售卡型。</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              关闭后该卡型对商户租户不可见；至少须保留一种启用卡型。
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {cardTypes.map((card) => {
                const enabled = enabledIds.includes(card.id)
                const isLastEnabled = enabled && enabledCount <= 1

                return (
                  <div
                    key={card.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
                      enabled ? 'border-border bg-background' : 'border-dashed bg-muted/30',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {card.manufacturer} · {card.memoryGB} GB
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Label htmlFor={`region-card-${card.id}`} className="text-xs text-muted-foreground">
                        {enabled ? '启用' : '关闭'}
                      </Label>
                      <Switch
                        id={`region-card-${card.id}`}
                        checked={enabled}
                        disabled={isSubmitting || isLastEnabled}
                        onCheckedChange={(checked) => handleToggle(card.id, checked)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || cardTypes.length === 0 || !hasChanges}
          >
            {isSubmitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
