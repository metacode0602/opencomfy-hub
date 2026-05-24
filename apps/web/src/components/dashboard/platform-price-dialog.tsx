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
import { Textarea } from '@workspace/ui/components/textarea'
import type { GPUCardType } from '@/lib/data/types'
import {
  fromDatetimeLocalValue,
  nowPlatformDateTime,
  toDatetimeLocalValue,
} from '@/lib/platform-pricing/datetime'
import type {
  PlatformBillingUnit,
  PlatformCardPriceRecord,
  PlatformPriceStatus,
  PlatformProductLine,
} from '@/lib/types/platform-pricing'
import {
  platformBillingUnitNames,
  platformPriceStatusNames,
  platformProductLineNames,
} from '@/lib/types/platform-pricing'

const PRODUCT_LINES: PlatformProductLine[] = [
  'elastic_service',
  'cloud_vm',
  'bare_metal',
  'job',
  'spot',
]

const BARE_METAL_UNITS: PlatformBillingUnit[] = ['hour', 'day', 'week', 'month']

export type PlatformPriceFormValues = {
  gpuCardTypeId: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  sellPrice: number
  effectiveFrom: string
  effectiveTo?: string | null
  status: PlatformPriceStatus
  remark?: string
}

export type PlatformPriceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingRecords: PlatformCardPriceRecord[]
  cardTypes: GPUCardType[]
  editing?: PlatformCardPriceRecord | null
  isSubmitting?: boolean
  /** 新增时默认选中的卡型 */
  defaultCardTypeId?: string
  /** 详情页选定时间段内新增/编辑 */
  periodId?: string
  periodEffectiveFrom?: string
  periodEffectiveTo?: string | null
  onSaved: (
    record: PlatformCardPriceRecord,
    isNew: boolean,
    form: PlatformPriceFormValues,
  ) => void
}

export function PlatformPriceDialog({
  open,
  onOpenChange,
  existingRecords,
  cardTypes,
  editing,
  isSubmitting = false,
  defaultCardTypeId,
  periodId,
  periodEffectiveFrom,
  periodEffectiveTo,
  onSaved,
}: PlatformPriceDialogProps) {
  const isEdit = Boolean(editing)

  const [cardTypeId, setCardTypeId] = useState('')
  const [productLine, setProductLine] = useState<PlatformProductLine>('elastic_service')
  const [billingUnit, setBillingUnit] = useState<PlatformBillingUnit>('hour')
  const [sellPrice, setSellPrice] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [status, setStatus] = useState<PlatformPriceStatus>('active')
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setCardTypeId(editing.gpuCardTypeId)
      setProductLine(editing.productLine)
      setBillingUnit(editing.billingUnit)
      setSellPrice(String(editing.sellPrice))
      setEffectiveFrom(editing.effectiveFrom)
      setStatus(editing.status)
      setRemark(editing.remark ?? '')
    } else {
      setCardTypeId(defaultCardTypeId ?? cardTypes[0]?.id ?? '')
      setProductLine('elastic_service')
      setBillingUnit('hour')
      setSellPrice('')
      setEffectiveFrom(nowPlatformDateTime())
      setStatus('active')
      setRemark('')
    }
  }, [open, editing, cardTypes, defaultCardTypeId])

  useEffect(() => {
    if (productLine !== 'bare_metal') {
      setBillingUnit('hour')
    }
  }, [productLine])

  const duplicate = useMemo(() => {
    if (isEdit) return false
    return existingRecords.some(
      (r) =>
        r.gpuCardTypeId === cardTypeId &&
        (periodId == null || r.periodId === periodId) &&
        r.productLine === productLine &&
        r.billingUnit === billingUnit &&
        r.status !== 'archived',
    )
  }, [existingRecords, cardTypeId, periodId, productLine, billingUnit, isEdit])

  const priceNum = parseFloat(sellPrice)
  const effectiveFromVal = periodEffectiveFrom ?? effectiveFrom
  const canSubmit =
    cardTypeId &&
    sellPrice.trim() !== '' &&
    !Number.isNaN(priceNum) &&
    priceNum > 0 &&
    effectiveFromVal &&
    !duplicate &&
    !isSubmitting

  const handleSubmit = () => {
    if (!canSubmit) return
    const card = cardTypes.find((c) => c.id === cardTypeId)
    if (!card) return

    const form: PlatformPriceFormValues = {
      gpuCardTypeId: cardTypeId,
      productLine,
      billingUnit,
      sellPrice: priceNum,
      effectiveFrom: effectiveFromVal,
      effectiveTo:
        periodEffectiveTo !== undefined ? periodEffectiveTo : editing?.effectiveTo ?? null,
      status,
      remark: remark.trim() || undefined,
    }

    const now = new Date().toISOString()
    const record: PlatformCardPriceRecord = {
      id: editing?.id ?? '',
      gpuCardTypeId: cardTypeId,
      cardTypeName: card.name,
      periodId: editing?.periodId ?? periodId ?? `${cardTypeId}-p-${effectiveFromVal}`,
      productLine,
      billingUnit,
      sellPrice: priceNum,
      currency: 'CNY',
      effectiveFrom: effectiveFromVal,
      effectiveTo:
        periodEffectiveTo !== undefined ? periodEffectiveTo : editing?.effectiveTo ?? null,
      status,
      remark: form.remark,
      updatedAt: now,
    }

    onSaved(record, !isEdit, form)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑平台标准价' : '新增平台标准价'}</DialogTitle>
          <DialogDescription>
            按卡型 × 产品线维护 L1 平台销售价格；裸金属需分别配置小时/天/周/月
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>GPU 卡型</Label>
            <Select
              value={cardTypeId}
              onValueChange={setCardTypeId}
              disabled={isEdit || isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择卡型" />
              </SelectTrigger>
              <SelectContent>
                {cardTypes
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>产品线</Label>
              <Select
                value={productLine}
                onValueChange={(v) => setProductLine(v as PlatformProductLine)}
                disabled={isEdit || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_LINES.map((pl) => (
                    <SelectItem key={pl} value={pl}>
                      {platformProductLineNames[pl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>租期单位</Label>
              {productLine === 'bare_metal' ? (
                <Select
                  value={billingUnit}
                  onValueChange={(v) => setBillingUnit(v as PlatformBillingUnit)}
                  disabled={isEdit || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BARE_METAL_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {platformBillingUnitNames[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value="按小时" disabled className="bg-muted" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>销售单价（元）</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={sellPrice}
                disabled={isSubmitting}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>生效时间</Label>
              {periodEffectiveFrom != null ? (
                <Input value={periodEffectiveFrom} disabled className="bg-muted" />
              ) : (
                <Input
                  type="datetime-local"
                  step={1}
                  value={toDatetimeLocalValue(effectiveFrom)}
                  disabled={isSubmitting}
                  onChange={(e) => setEffectiveFrom(fromDatetimeLocalValue(e.target.value))}
                />
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>状态</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PlatformPriceStatus)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(platformPriceStatusNames) as PlatformPriceStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {platformPriceStatusNames[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>备注</Label>
            <Textarea
              placeholder="调价说明（可选）"
              value={remark}
              disabled={isSubmitting}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
            />
          </div>

          {periodEffectiveFrom != null && (
            <p className="text-xs text-muted-foreground">
              价格归属时间段：{periodEffectiveFrom}
              {periodEffectiveTo ? ` ~ ${periodEffectiveTo}` : ' ~ 至今'}
            </p>
          )}

          {duplicate && (
            <p className="text-sm text-destructive">
              该时间段内此产品线与租期已有价格，请编辑现有记录
            </p>
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
