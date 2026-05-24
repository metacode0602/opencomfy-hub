'use client'

import { useEffect, useMemo, useState } from 'react'
import { DollarSign, Percent, Plus, Trash2 } from 'lucide-react'
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
import { contractPricingModeNames } from '@/lib/data/types'
import {
  type RevenueShareRatioTierDraft,
  emptyRevenueShareRatioTier,
  revenueShareRatioTiersToContractTiers,
  validateRevenueShareRatioTiers,
} from '@/lib/supplier/revenue-share-ratio-tiers'
import { RevenueShareRatioTiersEditor } from '@/app/[locale]/(protected)/supplier/components/revenue-share-ratio-tiers-editor'
import {
  CardTypeSelect,
  preventCardTypeSelectOutsideDismiss,
} from '@/components/dashboard/card-type-select'
import { trpc } from '@/lib/trpc/client'

type PricingCategory = 'card_time' | 'revenue_share'
type PricingVariant = 'fixed' | 'tiered'

type CreateCardPricingDialogBaseProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingRecords: SupplierPricingRecord[]
  cardTypes: GPUCardType[]
  /** mutation 成功后 invalidate 列表缓存 */
  listInput?: { supplierId: string }
  /** 创建成功后的额外回调（如刷新机房详情） */
  onSuccess?: (record: SupplierPricingRecord) => void | Promise<void>
  /** 来自数据库的供应商列表（优先于 mock） */
  suppliers?: Supplier[]
  /** 来自数据库的机房列表（已按供应商筛选时可直接传入） */
  dataCenters?: DataCenter[]
  lockedSupplierId?: string
  /** 锁定到指定机房（用于机房详情页） */
  lockedDataCenter?: Pick<DataCenter, 'id' | 'name'>
}

export type CreateCardPricingDialogProps =
  | (CreateCardPricingDialogBaseProps & { supplier: Pick<Supplier, 'id' | 'name' | 'shortName'> })
  | (CreateCardPricingDialogBaseProps & { supplier?: undefined })

function pricingModeFromSelection(
  category: PricingCategory,
  variant: PricingVariant,
): ContractPricingMode {
  if (category === 'card_time') return variant === 'fixed' ? 'card_time' : 'tiered_card_time'
  return variant === 'fixed' ? 'revenue_share' : 'tiered_revenue_share'
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
  listInput,
  onSuccess,
  supplier: lockedSupplierProp,
  suppliers: suppliersProp,
  dataCenters: dataCentersProp,
  lockedSupplierId,
  lockedDataCenter,
}: CreateCardPricingDialogProps) {
  const utils = trpc.useUtils()
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
  const [ratioTiers, setRatioTiers] = useState<RevenueShareRatioTierDraft[]>([
    emptyRevenueShareRatioTier(1),
    emptyRevenueShareRatioTier(2),
  ])
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const pricingMode = pricingModeFromSelection(category, variant)
  const isTiered = variant === 'tiered'
  const isShare = category === 'revenue_share'
  const isTieredShare = isTiered && isShare
  const resolvedSupplierId = lockedSupplier?.id ?? supplierId
  const isDbMode =
    Boolean(suppliersProp?.length) ||
    Boolean(lockedSupplierProp) ||
    Boolean(lockedSupplierId)

  const invalidateInput = listInput ?? (resolvedSupplierId ? { supplierId: resolvedSupplierId } : undefined)

  const createMutation = trpc.supplier.unitCosts.create.useMutation({
    onSuccess: async (record) => {
      if (invalidateInput) {
        await utils.supplier.unitCosts.listRecords.invalidate(invalidateInput)
        await utils.supplier.unitCosts.listHistory.invalidate(invalidateInput)
      }
      await onSuccess?.(record)
      toast.success('机房卡型配置已创建')
      onOpenChange(false)
    },
    onError: (error) => {
      const message = error.message || '创建失败，请稍后重试'
      setSubmitError(message)
      toast.error(message)
    },
  })

  const isSubmitting = createMutation.isPending

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
      setDataCenterId(lockedDataCenter?.id ?? '')
      setCardTypeId('')
      setCategory('card_time')
      setVariant('fixed')
      setUnitPrice('')
      setSharePercent('')
      setTiers([emptyTier(1), emptyTier(2)])
      setRatioTiers([emptyRevenueShareRatioTier(1), emptyRevenueShareRatioTier(2)])
      setEffectiveFrom(toDatetimeLocalValue(nowPlatformDateTime()))
      setEffectiveTo('')
      setSubmitError(null)
    }
  }, [open, lockedSupplier?.id, lockedDataCenter?.id])

  useEffect(() => {
    if (lockedSupplier) {
      setSupplierId(lockedSupplier.id)
    }
  }, [lockedSupplier])

  useEffect(() => {
    if (lockedDataCenter) {
      setDataCenterId(lockedDataCenter.id)
      return
    }
    setDataCenterId('')
  }, [resolvedSupplierId, lockedDataCenter])

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
    if (isSubmitting) return

    setSubmitError(null)

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

    if (!isDbMode) {
      setSubmitError('当前为演示模式，无法保存到数据库')
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
    } else if (isShare) {
      const validationError = validateRevenueShareRatioTiers(ratioTiers)
      if (validationError) {
        setSubmitError(validationError)
        return
      }
      pricingTiers = revenueShareRatioTiersToContractTiers(ratioTiers)
    } else {
      const parsed = tiers.map((t) => ({
        ...t,
        thresholdFromHours: Number(t.thresholdFromHours) || 0,
        thresholdToHours:
          t.thresholdToHours === undefined || t.thresholdToHours === null
            ? null
            : Number(t.thresholdToHours),
        unitPricePerHour: t.unitPricePerHour != null ? Number(t.unitPricePerHour) : undefined,
      }))
      if (parsed.length < 1) {
        setSubmitError('请至少配置一档阶梯')
        return
      }
      for (const t of parsed) {
        if (t.unitPricePerHour == null || Number.isNaN(t.unitPricePerHour)) {
          setSubmitError(`请填写第 ${t.tierOrder} 档卡时单价`)
          return
        }
      }
      pricingTiers = parsed
    }

    const effectiveFromValue = fromDatetimeLocalValue(effectiveFrom)
    const effectiveToValue = effectiveTo.trim()
      ? fromDatetimeLocalValue(effectiveTo)
      : null

    createMutation.mutate({
      supplierId: resolvedSupplierId,
      dataCenterId,
      gpuCardTypeId: cardTypeId,
      pricingMode,
      unitPricePerHour,
      revenueSharePercent,
      pricingTiers,
      effectiveFrom: effectiveFromValue,
      effectiveTo: effectiveToValue,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSubmitting) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={preventCardTypeSelectOutsideDismiss}
        onInteractOutside={preventCardTypeSelectOutsideDismiss}
        onFocusOutside={preventCardTypeSelectOutsideDismiss}
      >
        <DialogHeader>
          <DialogTitle>新增机房卡型配置</DialogTitle>
          <DialogDescription>
            {lockedDataCenter
              ? `为 ${lockedDataCenter.name} 的卡型建立单价或分成配置，支持固定与阶梯两种计价方式`
              : lockedSupplier
                ? `为 ${lockedSupplier.shortName} 的机房卡型建立单价或分成配置，支持固定与阶梯两种计价方式`
                : '为供应商机房卡型建立单价或分成配置，支持固定与阶梯两种计价方式'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div
            className={`grid gap-4 ${
              lockedSupplier && lockedDataCenter
                ? 'grid-cols-1'
                : lockedSupplier
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
            }`}
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
            {!lockedDataCenter ? (
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
            ) : (
              <div className="grid gap-2">
                <Label>机房</Label>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                  {lockedDataCenter.name}
                </div>
              </div>
            )}
            <CardTypeSelect
              label="卡型 *"
              value={cardTypeId}
              cardTypes={cardTypes}
              onChange={(v) => {
                setCardTypeId(v)
                setSubmitError(null)
              }}
            />
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
                    : '按成交/刊例比例划档，比例越高分成比例越高'
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

          {isTieredShare ? (
            <RevenueShareRatioTiersEditor
              tiers={ratioTiers}
              onChange={(next) => {
                setRatioTiers(next)
                setSubmitError(null)
              }}
              error={submitError}
            />
          ) : null}

          {isTiered && !isShare ? (
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
                    <Label className="text-xs">单价 ¥/时</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tier.unitPricePerHour ?? ''}
                      onChange={(e) =>
                        updateTier(tier.tierOrder, {
                          unitPricePerHour: parseFloat(e.target.value),
                        })
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
          ) : null}

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

          {submitError && !isTieredShare ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
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
