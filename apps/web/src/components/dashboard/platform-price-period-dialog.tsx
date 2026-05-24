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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  PLATFORM_PRICE_SLOTS,
  platformPriceSlotKey,
} from '@/lib/platform-pricing/transforms'
import type {
  PlatformBillingUnit,
  PlatformCardPriceRecord,
  PlatformProductLine,
} from '@/lib/types/platform-pricing'
import {
  platformBillingUnitNames,
  platformProductLineNames,
} from '@/lib/types/platform-pricing'
import type { PlatformCardPricePeriodRow } from '@/lib/types/platform-pricing-views'
import {
  fromDatetimeLocalValue,
  nowPlatformDateTime,
  toDatetimeLocalValue,
} from '@/lib/platform-pricing/datetime'
import {
  formatPeriodRange,
  getPeriodPhase,
  getRecordsForPeriod,
  validatePeriodAgainstExisting,
} from '@/lib/platform-pricing/periods'

export type PlatformPricePeriodManualPrice = {
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  sellPrice: number
}

export type PlatformPricePeriodSavePayload = {
  periodId: string
  effectiveFrom: string
  effectiveTo: string | null
  /** 从该时间段复制产品线价格 */
  copyFromPeriodId?: string
  /** 新建且与当前时间段重叠时，自动闭合原当前段 */
  autoClosePreviousCurrent: boolean
  /** 不复制时手动填写的产品线价格 */
  manualPrices?: PlatformPricePeriodManualPrice[]
}

export type PlatformPricePeriodDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardTypeId: string
  cardTypeName: string
  existingRecords: PlatformCardPriceRecord[]
  periods: PlatformCardPricePeriodRow[]
  editing?: PlatformCardPricePeriodRow | null
  isSubmitting?: boolean
  onSaved: (payload: PlatformPricePeriodSavePayload) => void
}

function billingUnitLabel(
  productLine: PlatformProductLine,
  billingUnit: PlatformBillingUnit,
): string {
  if (productLine === 'bare_metal') return platformBillingUnitNames[billingUnit]
  return '小时'
}

export function PlatformPricePeriodDialog({
  open,
  onOpenChange,
  cardTypeId,
  cardTypeName,
  existingRecords,
  periods,
  editing,
  isSubmitting = false,
  onSaved,
}: PlatformPricePeriodDialogProps) {
  const isEdit = Boolean(editing)

  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [openEnded, setOpenEnded] = useState(true)
  const [copyFromPeriodId, setCopyFromPeriodId] = useState<string>('none')
  const [autoClosePrevious, setAutoClosePrevious] = useState(true)
  const [manualPriceInputs, setManualPriceInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (editing) {
      setEffectiveFrom(editing.effectiveFrom)
      setEffectiveTo(editing.effectiveTo ?? '')
      setOpenEnded(editing.effectiveTo == null)
      setCopyFromPeriodId('none')
      setAutoClosePrevious(false)
      setManualPriceInputs({})
    } else {
      setEffectiveFrom(nowPlatformDateTime())
      setEffectiveTo('')
      setOpenEnded(true)
      const current = periods.find((p) => p.isCurrent)
      setCopyFromPeriodId(current?.periodId ?? 'none')
      setAutoClosePrevious(true)
      setManualPriceInputs({})
    }
  }, [open, editing, periods])

  const effectiveToValue = openEnded ? null : effectiveTo || null
  const showManualPrices = !isEdit && copyFromPeriodId === 'none'

  const newPeriodPhase = useMemo(() => {
    if (!effectiveFrom) return null
    return getPeriodPhase(effectiveFrom, effectiveToValue, false)
  }, [effectiveFrom, effectiveToValue])

  const showAutoCloseOption =
    !isEdit &&
    periods.some((p) => p.isCurrent) &&
    newPeriodPhase === 'current'

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

  const manualPrices = useMemo(() => {
    const entries: PlatformPricePeriodManualPrice[] = []
    for (const slot of PLATFORM_PRICE_SLOTS) {
      const key = platformPriceSlotKey(slot.productLine, slot.billingUnit)
      const raw = manualPriceInputs[key]?.trim()
      if (!raw) continue
      const price = parseFloat(raw)
      if (Number.isNaN(price) || price <= 0) continue
      entries.push({
        productLine: slot.productLine,
        billingUnit: slot.billingUnit,
        sellPrice: price,
      })
    }
    return entries
  }, [manualPriceInputs])

  const manualPriceError = useMemo(() => {
    if (!showManualPrices) return null
    for (const slot of PLATFORM_PRICE_SLOTS) {
      const key = platformPriceSlotKey(slot.productLine, slot.billingUnit)
      const raw = manualPriceInputs[key]?.trim()
      if (!raw) continue
      const price = parseFloat(raw)
      if (Number.isNaN(price) || price <= 0) {
        return `${platformProductLineNames[slot.productLine]}（${billingUnitLabel(slot.productLine, slot.billingUnit)}）价格无效`
      }
    }
    return null
  }, [showManualPrices, manualPriceInputs])

  const canSubmit = Boolean(
    effectiveFrom && !validationError && !manualPriceError && !isSubmitting,
  )

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
      autoClosePreviousCurrent: !isEdit && showAutoCloseOption && autoClosePrevious,
      manualPrices: showManualPrices && manualPrices.length > 0 ? manualPrices : undefined,
    })
  }

  const copySourceCount =
    copyFromPeriodId !== 'none'
      ? getRecordsForPeriod(existingRecords, cardTypeId, copyFromPeriodId).length
      : 0

  const groupedSlots = useMemo(() => {
    const groups = new Map<PlatformProductLine, typeof PLATFORM_PRICE_SLOTS>()
    for (const slot of PLATFORM_PRICE_SLOTS) {
      const list = groups.get(slot.productLine) ?? []
      list.push(slot)
      groups.set(slot.productLine, list)
    }
    return [...groups.entries()]
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showManualPrices ? 'sm:max-w-2xl max-h-[90vh] overflow-y-auto' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑有效时间段' : '新增有效时间段'}</DialogTitle>
          <DialogDescription>
            {cardTypeName} · 时间段之间不可重叠；支持补录历史时间段
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
              预览：
              <span className="font-medium text-foreground">{previewLabel}</span>
              {newPeriodPhase === 'expired' && (
                <span className="ml-2 text-xs">（历史时间段）</span>
              )}
              {newPeriodPhase === 'scheduled' && (
                <span className="ml-2 text-xs">（未生效）</span>
              )}
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

          {showManualPrices && (
            <div className="grid gap-2">
              <div>
                <Label>产品线价格（可选）</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  可按产品线单独填写价格，未填写的可在创建后补充
                </p>
              </div>
              <div className="rounded-md border max-h-[280px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品线</TableHead>
                      <TableHead>租期单位</TableHead>
                      <TableHead className="w-[140px]">销售单价（元）</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedSlots.map(([productLine, slots]) =>
                      slots.map((slot, index) => {
                        const key = platformPriceSlotKey(slot.productLine, slot.billingUnit)
                        return (
                          <TableRow key={key}>
                            <TableCell className="text-sm">
                              {index === 0 ? platformProductLineNames[productLine] : ''}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {billingUnitLabel(slot.productLine, slot.billingUnit)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="—"
                                className="h-8"
                                value={manualPriceInputs[key] ?? ''}
                                onChange={(e) =>
                                  setManualPriceInputs((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            </TableCell>
                          </TableRow>
                        )
                      }),
                    )}
                  </TableBody>
                </Table>
              </div>
              {manualPrices.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  已填写 {manualPrices.length} 条产品线价格
                </p>
              )}
            </div>
          )}

          {showAutoCloseOption && (
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
          {manualPriceError && (
            <p className="text-sm text-destructive">{manualPriceError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? '保存中…' : isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
