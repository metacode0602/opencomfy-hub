'use client'

import { useEffect, useMemo, useState } from 'react'
import { DollarSign, Percent, Plus, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Label } from '@workspace/ui/components/label'
import { RadioGroup, RadioGroupItem } from '@workspace/ui/components/radio-group'
import { mockDataCenters, mockSuppliers } from '@/lib/data/mock-data'
import type {
  ContractPricingMode,
  ContractPricingTier,
  CooperationMode,
  DataCenter,
  GPUCardType,
  Supplier,
  SupplierPricingRecord,
} from '@/lib/data/types'
import {
  fromDatetimeLocalValue,
  nowPlatformDateTime,
  toDatetimeLocalValue,
} from '@/lib/platform-pricing/datetime'
import { contractPricingModeNames, isSharePricingMode } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'

type PricingCategory = 'card_time' | 'revenue_share'
type PricingVariant = 'fixed' | 'tiered'

type CreateCardPricingDialogBaseProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingRecords: SupplierPricingRecord[]
  cardTypes: GPUCardType[]
  onCreated: (record: SupplierPricingRecord) => void
  /** 来自数据库的供应商列表（优先于 mock） */
  suppliers?: Supplier[]
  /** 来自数据库的机房列表（已按供应商筛选时可直接传入） */
  dataCenters?: DataCenter[]
  lockedSupplierId?: string
  isSubmitting?: boolean
}

export type CreateCardPricingDialogProps =
  | (CreateCardPricingDialogBaseProps & { supplier: Supplier })
  | (CreateCardPricingDialogBaseProps & { supplier?: undefined })

function pricingModeFromSelection(
  category: PricingCategory,
  variant: PricingVariant,
): ContractPricingMode {
  if (category === 'card_time') return variant === 'fixed' ? 'card_time' : 'tiered_card_time'
  return variant === 'fixed' ? 'revenue_share' : 'tiered_revenue_share'
}

function cooperationModeFromPricingMode(mode: ContractPricingMode): CooperationMode {
  return isSharePricingMode(mode) ? 'revenue_share' : 'card_time'
}

const emptyTier = (order: number): ContractPricingTier => ({
  tierOrder: order,
  thresholdFromHours: order === 1 ? 0 : 0,
  thresholdToHours: null,
  unitPricePerHour: undefined,
  revenueSharePercent: undefined,
})

function PricingOptionCard({
  value,
  id,
  title,
  description,
  selected,
}: {
  value: string
  id: string
  title: string
  description: string
  selected: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
      }`}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="grid gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </label>
  )
}

export function CreateCardPricingDialog({
  open,
  onOpenChange,
  existingRecords,
  cardTypes,
  onCreated,
  supplier: lockedSupplierProp,
  suppliers: suppliersProp,
  dataCenters: dataCentersProp,
  lockedSupplierId,
  isSubmitting = false,
}: CreateCardPricingDialogProps) {
  const supplierOptions = suppliersProp ?? mockSuppliers
  const lockedSupplier =
    lockedSupplierProp ??
    (lockedSupplierId ? supplierOptions.find((s) => s.id === lockedSupplierId) : undefined)

  const [supplierId, setSupplierId] = useState(lockedSupplier?.id ?? lockedSupplierId ?? '')
  const [dataCenterId, setDataCenterId] = useState('')
  const [cardTypeId, setCardTypeId] = useState('')
  const [category, setCategory] = useState<PricingCategory>('card_time')
  const [variant, setVariant] = useState<PricingVariant>('fixed')
  const [unitPrice, setUnitPrice] = useState('')
  const [sharePercent, setSharePercent] = useState('')
  const [tiers, setTiers] = useState<ContractPricingTier[]>([emptyTier(1), emptyTier(2)])
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const pricingMode = pricingModeFromSelection(category, variant)
  const isTiered = variant === 'tiered'
  const isShare = category === 'revenue_share'
  const resolvedSupplierId = lockedSupplier?.id ?? supplierId
  const isDbMode =
    Boolean(suppliersProp?.length) ||
    Boolean(lockedSupplierProp) ||
    Boolean(lockedSupplierId)

  const { data: fetchedDataCenters = [], isLoading: dataCentersLoading } =
    trpc.supplier.listDataCenters.useQuery(
      { supplierId: resolvedSupplierId },
      { enabled: isDbMode && Boolean(resolvedSupplierId) },
    )

  const dataCenterOptions = useMemo(() => {
    if (isDbMode) return fetchedDataCenters
    if (dataCentersProp && dataCentersProp.length > 0) return dataCentersProp
    if (!resolvedSupplierId) return []
    return mockDataCenters.filter((dc) => dc.supplierId === resolvedSupplierId)
  }, [isDbMode, fetchedDataCenters, dataCentersProp, resolvedSupplierId])

  useEffect(() => {
    if (!open) {
      setSupplierId(lockedSupplier?.id ?? '')
      setDataCenterId('')
      setCardTypeId('')
      setCategory('card_time')
      setVariant('fixed')
      setUnitPrice('')
      setSharePercent('')
      setTiers([emptyTier(1), emptyTier(2)])
      setEffectiveFrom(toDatetimeLocalValue(nowPlatformDateTime()))
      setEffectiveTo('')
      setSubmitError(null)
    }
  }, [open, lockedSupplier?.id])

  useEffect(() => {
    if (lockedSupplier) {
      setSupplierId(lockedSupplier.id)
    }
  }, [lockedSupplier])

  useEffect(() => {
    setDataCenterId('')
  }, [resolvedSupplierId])

  const addTier = () => {
    setTiers((prev) => [...prev, emptyTier(prev.length + 1)])
  }

  const removeTier = (order: number) => {
    setTiers((prev) =>
      prev
        .filter((t) => t.tierOrder !== order)
        .map((t, i) => ({ ...t, tierOrder: i + 1 })),
    )
  }

  const updateTier = (order: number, patch: Partial<ContractPricingTier>) => {
    setTiers((prev) => prev.map((t) => (t.tierOrder === order ? { ...t, ...patch } : t)))
  }

  const handleSubmit = () => {
    if (!resolvedSupplierId) {
      setSubmitError('请选择供应商')
      return
    }
    if (!dataCenterId) {
      setSubmitError('请选择机房')
      return
    }
    if (!cardTypeId) {
      setSubmitError('请选择卡型')
      return
    }
    if (!effectiveFrom) {
      setSubmitError('请填写生效时间')
      return
    }

    const duplicate = existingRecords.some(
      (r) =>
        r.supplierId === resolvedSupplierId &&
        r.dataCenterId === dataCenterId &&
        r.cardTypeId === cardTypeId,
    )
    if (duplicate) {
      setSubmitError('该供应商 × 机房 × 卡型已存在配置，请勿重复创建')
      return
    }

    const supplier = lockedSupplier ?? supplierOptions.find((s) => s.id === resolvedSupplierId)
    const dataCenter = dataCenterOptions.find((dc) => dc.id === dataCenterId)
    const cardType = cardTypes.find((c) => c.id === cardTypeId)
    if (!supplier || !dataCenter || !cardType) {
      setSubmitError('所选供应商、机房或卡型无效')
      return
    }

    let unitPricePerHour: number | undefined
    let revenueSharePercent: number | undefined
    let pricingTiers: ContractPricingTier[] | undefined

    if (variant === 'fixed') {
      if (category === 'card_time') {
        const v = parseFloat(unitPrice)
        if (Number.isNaN(v) || v <= 0) {
          setSubmitError('请填写有效的卡时单价')
          return
        }
        unitPricePerHour = v
      } else {
        const v = parseFloat(sharePercent)
        if (Number.isNaN(v) || v <= 0 || v > 100) {
          setSubmitError('请填写有效的分成比例（0-100）')
          return
        }
        revenueSharePercent = v
      }
    } else {
      const parsed = tiers.map((t) => ({
        ...t,
        thresholdFromHours: Number(t.thresholdFromHours) || 0,
        thresholdToHours:
          t.thresholdToHours === undefined || t.thresholdToHours === null
            ? null
            : Number(t.thresholdToHours),
        unitPricePerHour: t.unitPricePerHour != null ? Number(t.unitPricePerHour) : undefined,
        revenueSharePercent:
          t.revenueSharePercent != null ? Number(t.revenueSharePercent) : undefined,
      }))
      if (parsed.length < 1) {
        setSubmitError('请至少配置一档阶梯')
        return
      }
      for (const t of parsed) {
        if (isShare) {
          if (t.revenueSharePercent == null || Number.isNaN(t.revenueSharePercent)) {
            setSubmitError(`请填写第 ${t.tierOrder} 档分成比例`)
            return
          }
        } else if (t.unitPricePerHour == null || Number.isNaN(t.unitPricePerHour)) {
          setSubmitError(`请填写第 ${t.tierOrder} 档卡时单价`)
          return
        }
      }
      pricingTiers = parsed
    }

    const now = new Date().toISOString()
    const effectiveFromValue = fromDatetimeLocalValue(effectiveFrom)
    const effectiveToValue = effectiveTo.trim()
      ? fromDatetimeLocalValue(effectiveTo)
      : null

    onCreated({
      id: `spr-new-${Date.now()}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      dataCenterId: dataCenter.id,
      dataCenterName: dataCenter.name,
      cardTypeId: cardType.id,
      cardTypeName: cardType.name,
      cooperationMode: cooperationModeFromPricingMode(pricingMode),
      pricingMode,
      unitPricePerHour,
      revenueSharePercent,
      pricingTiers,
      effectiveFrom: effectiveFromValue,
      effectiveTo: effectiveToValue,
      updatedAt: now,
      updatedBy: '当前用户',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增机房卡型配置</DialogTitle>
          <DialogDescription>
            {lockedSupplier
              ? `为 ${lockedSupplier.shortName} 的机房卡型建立单价或分成配置，支持固定与阶梯两种计价方式`
              : '为供应商机房卡型建立单价或分成配置，支持固定与阶梯两种计价方式'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div
            className={`grid gap-4 ${lockedSupplier ? 'grid-cols-2' : 'grid-cols-3'}`}
          >
            {!lockedSupplier && (
              <div className="grid gap-2">
                <Label>供应商 *</Label>
                <Select
                  value={supplierId}
                  onValueChange={(v) => {
                    setSupplierId(v)
                    setSubmitError(null)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>机房 *</Label>
              <Select
                value={dataCenterId}
                onValueChange={(v) => {
                  setDataCenterId(v)
                  setSubmitError(null)
                }}
                disabled={!resolvedSupplierId || dataCentersLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !resolvedSupplierId
                        ? '请先选供应商'
                        : dataCentersLoading
                          ? '加载机房…'
                          : dataCenterOptions.length === 0
                            ? '该供应商暂无机房'
                            : '选择机房'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {dataCenterOptions.map((dc) => (
                    <SelectItem key={dc.id} value={dc.id}>
                      {dc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>卡型 *</Label>
              <Select
                value={cardTypeId}
                onValueChange={(v) => {
                  setCardTypeId(v)
                  setSubmitError(null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择卡型" />
                </SelectTrigger>
                <SelectContent>
                  {cardTypes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>合作大类 *</Label>
            <RadioGroup
              value={category}
              onValueChange={(v) => {
                setCategory(v as PricingCategory)
                setSubmitError(null)
              }}
              className="grid grid-cols-2 gap-3"
            >
              <PricingOptionCard
                value="card_time"
                id="pricing-category-card-time"
                title="卡时"
                description="按 GPU 卡时结算，约定元/小时单价"
                selected={category === 'card_time'}
              />
              <PricingOptionCard
                value="revenue_share"
                id="pricing-category-revenue-share"
                title="分成"
                description="按客户消费分成，约定供应商分成比例"
                selected={category === 'revenue_share'}
              />
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label>计价方式 *</Label>
            <RadioGroup
              value={variant}
              onValueChange={(v) => {
                setVariant(v as PricingVariant)
                setSubmitError(null)
              }}
              className="grid grid-cols-2 gap-3"
            >
              <PricingOptionCard
                value="fixed"
                id="pricing-variant-fixed"
                title={category === 'card_time' ? '固定卡时' : '固定分成'}
                description={
                  category === 'card_time'
                    ? '单一卡时单价，全量用量适用同一价格'
                    : '单一分成比例，全量消费适用同一比例'
                }
                selected={variant === 'fixed'}
              />
              <PricingOptionCard
                value="tiered"
                id="pricing-variant-tiered"
                title={category === 'card_time' ? '阶梯卡时' : '阶梯分成'}
                description={
                  category === 'card_time'
                    ? '按自然月累计卡时分档，用量越大单价越低'
                    : '按自然月累计卡时分档，用量越大分成比例越高'
                }
                selected={variant === 'tiered'}
              />
            </RadioGroup>
          </div>

          {variant === 'fixed' && category === 'card_time' && (
            <div className="grid gap-2">
              <Label>卡时单价（元/小时）*</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="pl-9"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
            </div>
          )}

          {variant === 'fixed' && category === 'revenue_share' && (
            <div className="grid gap-2">
              <Label>供应商分成比例（%）*</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="pl-9"
                  value={sharePercent}
                  onChange={(e) => setSharePercent(e.target.value)}
                />
              </div>
            </div>
          )}

          {isTiered && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Label>阶梯档位 *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTier}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  添加档位
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                按自然月累计 GPU 卡时分档；{contractPricingModeNames[pricingMode]}
              </p>
              {tiers.map((tier) => (
                <div
                  key={tier.tierOrder}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
                >
                  <div className="grid gap-1">
                    <Label className="text-xs">起始卡时</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tier.thresholdFromHours}
                      onChange={(e) =>
                        updateTier(tier.tierOrder, {
                          thresholdFromHours: parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">结束卡时（空=无上限）</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="无上限"
                      value={tier.thresholdToHours ?? ''}
                      onChange={(e) =>
                        updateTier(tier.tierOrder, {
                          thresholdToHours: e.target.value ? parseInt(e.target.value, 10) : null,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">{isShare ? '分成 %' : '单价 ¥/时'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={
                        isShare
                          ? (tier.revenueSharePercent ?? '')
                          : (tier.unitPricePerHour ?? '')
                      }
                      onChange={(e) =>
                        updateTier(
                          tier.tierOrder,
                          isShare
                            ? { revenueSharePercent: parseFloat(e.target.value) }
                            : { unitPricePerHour: parseFloat(e.target.value) },
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={tiers.length <= 1}
                    onClick={() => removeTier(tier.tierOrder)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            <Label>生效时间 *</Label>
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

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '创建中…' : '创建配置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
