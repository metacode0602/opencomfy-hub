'use client'

import { useMemo } from 'react'
import { DollarSign } from 'lucide-react'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { RadioGroup, RadioGroupItem } from '@workspace/ui/components/radio-group'
import {
  DEFAULT_CARDS_PER_MACHINE,
  daysInNaturalMonth,
  deriveCardHourPriceFromMonthlyRent,
  formatCardHourPrice,
  type SupplierBillingUnit,
} from '@/lib/supplier/monthly-rent-pricing'

export type CardTimePricingFieldsProps = {
  billingUnit: SupplierBillingUnit
  onBillingUnitChange: (unit: SupplierBillingUnit) => void
  unitPrice: string
  onUnitPriceChange: (value: string) => void
  cardsPerMachine: string
  onCardsPerMachineChange: (value: string) => void
  /** 用于月租折算的自然月参考日（严格按 effectiveFrom） */
  referenceDate: string
}

export function CardTimePricingFields({
  billingUnit,
  onBillingUnitChange,
  unitPrice,
  onUnitPriceChange,
  cardsPerMachine,
  onCardsPerMachineChange,
  referenceDate,
}: CardTimePricingFieldsProps) {
  const derivedHourly = useMemo(() => {
    if (billingUnit !== 'month') return null
    const rent = parseFloat(unitPrice)
    const cards = parseInt(cardsPerMachine, 10) || DEFAULT_CARDS_PER_MACHINE
    if (Number.isNaN(rent) || rent <= 0) return null
    return deriveCardHourPriceFromMonthlyRent({
      monthlyRentPerMachine: rent,
      cardsPerMachine: cards,
      referenceDate,
    })
  }, [billingUnit, unitPrice, cardsPerMachine, referenceDate])

  const days = useMemo(() => daysInNaturalMonth(referenceDate), [referenceDate])

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>计费单位</Label>
        <RadioGroup
          value={billingUnit}
          onValueChange={(v) => onBillingUnitChange(v as SupplierBillingUnit)}
          className="grid grid-cols-2 gap-2"
        >
          <label
            htmlFor="billing-unit-hour"
            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
              billingUnit === 'hour'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem value="hour" id="billing-unit-hour" />
            按卡时（元/小时）
          </label>
          <label
            htmlFor="billing-unit-month"
            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
              billingUnit === 'month'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem value="month" id="billing-unit-month" />
            按月租（整租）
          </label>
        </RadioGroup>
      </div>

      {billingUnit === 'hour' ? (
        <div className="grid gap-2">
          <Label>卡时单价（元/小时）</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="number"
              className="pl-9"
              min={0}
              step="0.0001"
              value={unitPrice}
              onChange={(e) => onUnitPriceChange(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label>月租金额（元/台/月）</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                className="pl-9"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => onUnitPriceChange(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>每台 GPU 卡数</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={cardsPerMachine}
              onChange={(e) => onCardsPerMachineChange(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">
              折算卡时单价（按生效时间所在自然月 {days} 天）
            </p>
            <p className="mt-1 font-medium text-foreground">
              {derivedHourly != null ? `≈ ¥${formatCardHourPrice(derivedHourly)} / 小时` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              公式：月租 ÷ {days}天 ÷ 24小时 ÷ {cardsPerMachine || DEFAULT_CARDS_PER_MACHINE}卡
            </p>
          </div>
        </>
      )}
    </div>
  )
}
