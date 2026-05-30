'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
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
import { getCurrentPlatformRecords } from '@/lib/platform-pricing/periods'
import { trpc } from '@/lib/trpc/client'
import type {
  PlatformBillingUnit,
  PlatformProductLine,
  SupplierDatacenterSellPrice,
} from '@/lib/types/platform-pricing'
import {
  platformBillingUnitNames,
  platformProductLineNames,
  platformSellPriceSourceNames,
} from '@/lib/types/platform-pricing'

const PRODUCT_LINES: PlatformProductLine[] = [
  'elastic_service',
  'cloud_vm',
  'bare_metal',
  'job',
  'spot',
]

const BARE_METAL_UNITS: PlatformBillingUnit[] = ['hour', 'day', 'week', 'month']

export type DatacenterSellPriceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingRecords: SupplierDatacenterSellPrice[]
  cardTypes: GPUCardType[]
  /** 已接入卡型 id 列表（机房维度校验） */
  availableCardTypeIds?: string[]
  editing?: SupplierDatacenterSellPrice | null
  defaultSupplierId?: string
  defaultDataCenterId?: string
  defaultCardTypeId?: string
  onSaved: (record: SupplierDatacenterSellPrice, isNew: boolean) => void
}

export function DatacenterSellPriceDialog({
  open,
  onOpenChange,
  existingRecords,
  cardTypes,
  availableCardTypeIds,
  editing,
  defaultSupplierId,
  defaultDataCenterId,
  defaultCardTypeId,
  onSaved,
}: DatacenterSellPriceDialogProps) {
  const isEdit = Boolean(editing)

  const [supplierId, setSupplierId] = useState('')
  const [dataCenterId, setDataCenterId] = useState('')
  const [cardTypeId, setCardTypeId] = useState('')
  const [productLine, setProductLine] = useState<PlatformProductLine>('elastic_service')
  const [billingUnit, setBillingUnit] = useState<PlatformBillingUnit>('hour')
  const [sellPrice, setSellPrice] = useState('')
  const [inheritPlatformPrice, setInheritPlatformPrice] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [remark, setRemark] = useState('')

  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, { enabled: open })

  const { data: dataCenterOptions = [] } = trpc.supplier.listDataCenters.useQuery(
    { supplierId },
    { enabled: open && Boolean(supplierId) },
  )

  const { data: platformRecords = [] } =
    trpc.supplier.platformPricing.listRecordsForCardType.useQuery(
      { cardTypeId },
      { enabled: open && Boolean(cardTypeId) },
    )

  const selectableCardTypes = useMemo(() => {
    const active = cardTypes.filter((c) => c.status === 'active')
    if (!availableCardTypeIds?.length) return active
    return active.filter((c) => availableCardTypeIds.includes(c.id))
  }, [cardTypes, availableCardTypeIds])

  const platformRef = useMemo(() => {
    if (!cardTypeId) return undefined
    const current = getCurrentPlatformRecords(platformRecords, cardTypeId)
    return current.find(
      (r) => r.productLine === productLine && r.billingUnit === billingUnit,
    )
  }, [platformRecords, cardTypeId, productLine, billingUnit])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setSupplierId(editing.supplierId)
      setDataCenterId(editing.dataCenterId)
      setCardTypeId(editing.gpuCardTypeId)
      setProductLine(editing.productLine)
      setBillingUnit(editing.billingUnit)
      setSellPrice(String(editing.sellPrice))
      setInheritPlatformPrice(editing.inheritPlatformPrice)
      setEffectiveFrom(editing.effectiveFrom)
      setRemark(editing.remark ?? '')
    } else {
      setSupplierId(defaultSupplierId ?? '')
      setDataCenterId(defaultDataCenterId ?? '')
      setCardTypeId(
        defaultCardTypeId && selectableCardTypes.some((c) => c.id === defaultCardTypeId)
          ? defaultCardTypeId
          : (selectableCardTypes[0]?.id ?? ''),
      )
      setProductLine('elastic_service')
      setBillingUnit('hour')
      setSellPrice('')
      setInheritPlatformPrice(false)
      setEffectiveFrom(new Date().toISOString().slice(0, 10))
      setRemark('')
    }
  }, [
    open,
    editing,
    selectableCardTypes,
    defaultSupplierId,
    defaultDataCenterId,
    defaultCardTypeId,
  ])

  useEffect(() => {
    if (!open || isEdit || editing || defaultSupplierId || supplierId) return
    if (suppliers.length > 0) {
      setSupplierId(suppliers[0]!.id)
    }
  }, [open, isEdit, editing, defaultSupplierId, supplierId, suppliers])

  useEffect(() => {
    if (productLine !== 'bare_metal') setBillingUnit('hour')
  }, [productLine])

  useEffect(() => {
    if (inheritPlatformPrice && platformRef) {
      setSellPrice(String(platformRef.sellPrice))
    }
  }, [inheritPlatformPrice, platformRef])

  useEffect(() => {
    if (!isEdit && dataCenterOptions.length && !dataCenterId) {
      setDataCenterId(dataCenterOptions[0]?.id ?? '')
    }
  }, [dataCenterOptions, dataCenterId, isEdit])

  const duplicate = useMemo(() => {
    if (isEdit) return false
    return existingRecords.some(
      (r) =>
        r.dataCenterId === dataCenterId &&
        r.gpuCardTypeId === cardTypeId &&
        r.productLine === productLine &&
        r.billingUnit === billingUnit,
    )
  }, [
    existingRecords,
    dataCenterId,
    cardTypeId,
    productLine,
    billingUnit,
    isEdit,
  ])

  const priceNum = parseFloat(sellPrice)
  const canSubmit =
    supplierId &&
    dataCenterId &&
    cardTypeId &&
    sellPrice.trim() !== '' &&
    !Number.isNaN(priceNum) &&
    priceNum > 0 &&
    effectiveFrom &&
    !duplicate

  const handleSubmit = () => {
    if (!canSubmit) return
    const supplier = suppliers.find((s) => s.id === supplierId)
    const dc = dataCenterOptions.find((d) => d.id === dataCenterId)
    const card = cardTypes.find((c) => c.id === cardTypeId)
    if (!supplier || !dc || !card) return

    const now = new Date().toISOString()
    const source = inheritPlatformPrice
      ? 'platform_inherit'
      : ('manual' as const)

    const record: SupplierDatacenterSellPrice = {
      id: editing?.id ?? `sdsp-${Date.now()}`,
      supplierId,
      supplierName: supplier.shortName,
      dataCenterId,
      dataCenterName: dc.name,
      gpuCardTypeId: cardTypeId,
      cardTypeName: card.name,
      productLine,
      billingUnit,
      sellPrice: priceNum,
      platformSellPrice: platformRef?.sellPrice,
      inheritPlatformPrice,
      currency: 'CNY',
      effectiveFrom,
      source,
      remark: remark.trim() || undefined,
      updatedAt: now,
      updatedBy: '当前用户',
    }
    onSaved(record, !isEdit)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑机房销售价' : '新增机房销售价'}</DialogTitle>
          <DialogDescription>
            L2 供应商机房级销售价格；可继承平台标准价或单独定价
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>供应商</Label>
              <Select
                value={supplierId}
                onValueChange={(v) => {
                  setSupplierId(v)
                  setDataCenterId('')
                }}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>机房</Label>
              <Select
                value={dataCenterId}
                onValueChange={setDataCenterId}
                disabled={isEdit || !supplierId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择机房" />
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
          </div>

          <div className="grid gap-2">
            <Label>GPU 卡型</Label>
            <Select
              value={cardTypeId}
              onValueChange={setCardTypeId}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择卡型" />
              </SelectTrigger>
              <SelectContent>
                {selectableCardTypes.map((c) => (
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
                disabled={isEdit}
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
                  disabled={isEdit}
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

          {platformRef && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              平台标准价：
              <span className="font-medium text-foreground ml-1">
                ¥{platformRef.sellPrice.toFixed(2)}
              </span>
              <span className="text-muted-foreground ml-1">
                /{productLine === 'bare_metal' ? platformBillingUnitNames[billingUnit] : '时'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="inherit-platform"
              checked={inheritPlatformPrice}
              onCheckedChange={(v) => setInheritPlatformPrice(v === true)}
              disabled={!platformRef}
            />
            <Label htmlFor="inherit-platform" className="font-normal cursor-pointer">
              继承平台标准价（平台调价时自动跟随）
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>销售单价（元）</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                disabled={inheritPlatformPrice}
              />
            </div>
            <div className="grid gap-2">
              <Label>生效日期</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>备注</Label>
            <Textarea
              placeholder="定价说明（可选）"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
            />
          </div>

          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              来源将标记为：
              {platformSellPriceSourceNames[inheritPlatformPrice ? 'platform_inherit' : 'manual']}
            </p>
          )}

          {duplicate && (
            <p className="text-sm text-destructive">
              该机房在此卡型、产品线与租期下已有销售价
            </p>
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
