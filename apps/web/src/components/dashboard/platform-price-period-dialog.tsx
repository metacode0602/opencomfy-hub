'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Switch } from '@workspace/ui/components/switch'
import type { PlatformCardPriceRecord } from '@/lib/types/platform-pricing'
import type { PlatformCardPricePeriodRow } from '@/lib/types/platform-pricing-views'
import {
  fromDatetimeLocalValue,
  nowPlatformDateTime,
  toDatetimeLocalValue,
} from '@/lib/platform-pricing/datetime'
import {
  formatPeriodRange,
  getRecordsForPeriod,
  validatePeriodAgainstExisting,
} from '@/lib/platform-pricing/periods'

export type PlatformPricePeriodSavePayload = {
  periodId: string
  effectiveFrom: string
  effectiveTo: string | null
  /** 从该时间段复制产品线价格 */
  copyFromPeriodId?: string
  /** 新建且与当前时间段重叠时，自动闭合原当前段 */
  autoClosePreviousCurrent: boolean
}

export type PlatformPricePeriodDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardTypeId: string
  cardTypeName: string
  existingRecords: PlatformCardPriceRecord[]
  periods: PlatformCardPricePeriodRow[]
  editing?: PlatformCardPricePeriodRow | null
  onSaved: (payload: PlatformPricePeriodSavePayload) => void
}

export function PlatformPricePeriodDialog({
  open,
  onOpenChange,
  cardTypeId,
  cardTypeName,
  existingRecords,
  periods,
  editing,
  onSaved,
}: PlatformPricePeriodDialogProps) {
  const isEdit = Boolean(editing)

  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [openEnded, setOpenEnded] = useState(true)
  const [copyFromPeriodId, setCopyFromPeriodId] = useState<string>('none')
  const [autoClosePrevious, setAutoClosePrevious] = useState(true)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setEffectiveFrom(editing.effectiveFrom)
      setEffectiveTo(editing.effectiveTo ?? '')
      setOpenEnded(editing.effectiveTo == null)
      setCopyFromPeriodId('none')
      setAutoClosePrevious(false)
    } else {
      setEffectiveFrom(nowPlatformDateTime())
      setEffectiveTo('')
      setOpenEnded(true)
      const current = periods.find((p) => p.isCurrent)
      setCopyFromPeriodId(current?.periodId ?? 'none')
      setAutoClosePrevious(true)
    }
  }, [open, editing, periods])

  const effectiveToValue = openEnded ? null : effectiveTo || null

  const validationError = useMemo(() => {
    const err = validatePeriodAgainstExisting(
      cardTypeId,
      effectiveFrom,
      effectiveToValue,
      existingRecords,
      editing?.periodId,
    )
    return err?.message ?? null
  }, [
    cardTypeId,
    effectiveFrom,
    effectiveToValue,
    existingRecords,
    editing?.periodId,
  ])

  const previewLabel = effectiveFrom
    ? formatPeriodRange(effectiveFrom, effectiveToValue)
    : ''

  const canSubmit = Boolean(effectiveFrom && !validationError)

  const handleSubmit = () => {
    if (!canSubmit) return
    const periodId =
      editing?.periodId ?? `${cardTypeId}-p-${Date.now()}`

    onSaved({
      periodId,
      effectiveFrom,
      effectiveTo: effectiveToValue,
      copyFromPeriodId:
        !isEdit && copyFromPeriodId !== 'none' ? copyFromPeriodId : undefined,
      autoClosePreviousCurrent: !isEdit && autoClosePrevious,
    })
    onOpenChange(false)
  }

  const copySourceCount =
    copyFromPeriodId !== 'none'
      ? getRecordsForPeriod(existingRecords, cardTypeId, copyFromPeriodId).length
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑有效时间段' : '新增有效时间段'}</DialogTitle>
          <DialogDescription>
            {cardTypeName} · 时间段之间不可重叠；全平台仅允许一段「当前有效」
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>生效开始时间</Label>
              <Input
                type="datetime-local"
                step={1}
                value={toDatetimeLocalValue(effectiveFrom)}
                onChange={(e) => setEffectiveFrom(fromDatetimeLocalValue(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label>生效结束时间</Label>
              <Input
                type="datetime-local"
                step={1}
                value={effectiveTo ? toDatetimeLocalValue(effectiveTo) : ''}
                onChange={(e) =>
                  setEffectiveTo(
                    e.target.value ? fromDatetimeLocalValue(e.target.value) : '',
                  )
                }
                disabled={openEnded}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="open-ended" className="text-sm font-normal">
              长期有效（无结束时间）
            </Label>
            <Switch
              id="open-ended"
              checked={openEnded}
              onCheckedChange={setOpenEnded}
            />
          </div>

          {previewLabel && (
            <p className="text-sm text-muted-foreground">
              预览：<span className="font-medium text-foreground">{previewLabel}</span>
            </p>
          )}

          {!isEdit && periods.length > 0 && (
            <div className="grid gap-2">
              <Label>复制产品线价格（可选）</Label>
              <Select value={copyFromPeriodId} onValueChange={setCopyFromPeriodId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不复制，稍后单独配置</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p.periodId} value={p.periodId}>
                      {p.rangeLabel}（{p.priceEntryCount} 条）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {copySourceCount > 0 && copyFromPeriodId !== 'none' && (
                <p className="text-xs text-muted-foreground">
                  将复制 {copySourceCount} 条产品线定价至新时间段
                </p>
              )}
            </div>
          )}

          {!isEdit && periods.some((p) => p.isCurrent) && (
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">自动闭合原当前时间段</p>
                <p className="text-xs text-muted-foreground">
                  新段生效时间的前一秒作为原当前段的结束时间
                </p>
              </div>
              <Switch checked={autoClosePrevious} onCheckedChange={setAutoClosePrevious} />
            </div>
          )}

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
