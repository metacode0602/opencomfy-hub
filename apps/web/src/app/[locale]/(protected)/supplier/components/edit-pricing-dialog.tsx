'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Percent } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/lib/platform-pricing/datetime'
import { trpc } from '@/lib/trpc/client'
import type { ContractPricingMode, SupplierPricingRecord } from '@/lib/data/types'
import { getRecordPricingMode } from './unit-costs-utils'
import { PricingModeBadge } from './pricing-mode-badge'
import { RevenueShareRatioTiersEditor } from './revenue-share-ratio-tiers-editor'
import {
  type RevenueShareRatioTierDraft,
  revenueShareRatioTiersFromRecord,
  revenueShareRatioTiersToContractTiers,
  validateRevenueShareRatioTiers,
} from './revenue-share-ratio-tiers'

export type EditPricingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: SupplierPricingRecord | null
  /** 用于 mutation 成功后 invalidate 列表缓存 */
  listInput?: { supplierId: string }
  onSuccess?: () => void
}

function isFixedCardTimeMode(mode: ContractPricingMode) {
  return mode === 'card_time'
}

function isFixedShareMode(mode: ContractPricingMode) {
  return mode === 'revenue_share'
}

function isTieredShareMode(mode: ContractPricingMode) {
  return mode === 'tiered_revenue_share'
}

export function EditPricingDialog({
  open,
  onOpenChange,
  record,
  listInput,
  onSuccess,
}: EditPricingDialogProps) {
  const utils = trpc.useUtils()

  const [unitPrice, setUnitPrice] = useState('')
  const [sharePercent, setSharePercent] = useState('')
  const [ratioTiers, setRatioTiers] = useState<RevenueShareRatioTierDraft[]>([])
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !record) return
    setUnitPrice(record.unitPricePerHour?.toString() ?? '')
    setSharePercent(record.revenueSharePercent?.toString() ?? '')
    setRatioTiers(revenueShareRatioTiersFromRecord(record))
    setEffectiveFrom(toDatetimeLocalValue(record.effectiveFrom))
    setEffectiveTo(record.effectiveTo ? toDatetimeLocalValue(record.effectiveTo) : '')
    setReason('')
    setFormError(null)
  }, [open, record])

  const updateMutation = trpc.supplier.unitCosts.update.useMutation({
    onSuccess: async () => {
      await utils.supplier.unitCosts.listRecords.invalidate(listInput)
      await utils.supplier.unitCosts.listHistory.invalidate(listInput)
      toast.success('单价 / 分成已保存并记录历史')
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => {
      const message = error.message || '保存失败，请稍后重试'
      setFormError(message)
      toast.error(message)
    },
  })

  const handleConfirm = () => {
    if (!record) return

    setFormError(null)

    if (!effectiveFrom.trim()) {
      setFormError('请填写生效时间')
      return
    }

    const pricingMode = getRecordPricingMode(record)
    const effectiveFromValue = fromDatetimeLocalValue(effectiveFrom)
    const effectiveToValue = effectiveTo.trim()
      ? fromDatetimeLocalValue(effectiveTo)
      : null

    if (isTieredShareMode(pricingMode)) {
      const validationError = validateRevenueShareRatioTiers(ratioTiers)
      if (validationError) {
        setFormError(validationError)
        return
      }

      updateMutation.mutate({
        recordId: record.id,
        pricingMode,
        pricingTiers: revenueShareRatioTiersToContractTiers(ratioTiers),
        effectiveFrom: effectiveFromValue,
        effectiveTo: effectiveToValue,
        reason: reason || undefined,
      })
      return
    }

    if (isFixedCardTimeMode(pricingMode)) {
      const newUnitPrice = parseFloat(unitPrice)
      if (Number.isNaN(newUnitPrice) || newUnitPrice <= 0) {
        setFormError('请填写有效的卡时单价')
        return
      }

      updateMutation.mutate({
        recordId: record.id,
        pricingMode,
        unitPricePerHour: newUnitPrice,
        effectiveFrom: effectiveFromValue,
        effectiveTo: effectiveToValue,
        reason: reason || undefined,
      })
      return
    }

    if (isFixedShareMode(pricingMode)) {
      const newShare = parseFloat(sharePercent)
      if (Number.isNaN(newShare) || newShare <= 0 || newShare > 100) {
        setFormError('请填写有效的分成比例（0–100）')
        return
      }

      updateMutation.mutate({
        recordId: record.id,
        pricingMode,
        revenueSharePercent: newShare,
        effectiveFrom: effectiveFromValue,
        effectiveTo: effectiveToValue,
        reason: reason || undefined,
      })
    }
  }

  if (!record) return null

  const pricingMode = getRecordPricingMode(record)
  const isFixedCardTime = isFixedCardTimeMode(pricingMode)
  const isFixedShare = isFixedShareMode(pricingMode)
  const isTieredShare = isTieredShareMode(pricingMode)
  const isTieredCardTime = pricingMode === 'tiered_card_time'

  const dialogMaxWidth = isTieredShare ? 'sm:max-w-2xl' : 'sm:max-w-md'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${dialogMaxWidth} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>调整单价 / 分成</DialogTitle>
          <DialogDescription>
            {record.supplierName} · {record.dataCenterName} · {record.cardTypeName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>计价方式</Label>
            <PricingModeBadge mode={pricingMode} />
          </div>

          {isFixedCardTime ? (
            <div className="grid gap-2">
              <Label>卡时单价（元/小时）</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-9"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {isFixedShare ? (
            <div className="grid gap-2">
              <Label>供应商分成比例（%）</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-9"
                  min={0}
                  max={100}
                  value={sharePercent}
                  onChange={(e) => setSharePercent(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {isTieredShare ? (
            <RevenueShareRatioTiersEditor
              tiers={ratioTiers}
              onChange={(next) => {
                setRatioTiers(next)
                setFormError(null)
              }}
              error={formError}
            />
          ) : null}

          {isTieredCardTime ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-3">
              阶梯卡时档位编辑即将支持；当前可调整生效时间与变更备注。
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label>生效时间</Label>
            <Input
              type="datetime-local"
              step={1}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">格式：yyyy-MM-dd HH:mm:ss</p>
          </div>
          <div className="grid gap-2">
            <Label>结束时间（可选）</Label>
            <Input
              type="datetime-local"
              step={1}
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">留空表示长期有效</p>
          </div>
          <div className="grid gap-2">
            <Label>变更备注</Label>
            <Textarea
              placeholder="如：季度调价、合同补充协议..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {formError && !isTieredShare ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={updateMutation.isPending || isTieredCardTime}
          >
            {updateMutation.isPending ? '保存中…' : '保存并记录历史'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
