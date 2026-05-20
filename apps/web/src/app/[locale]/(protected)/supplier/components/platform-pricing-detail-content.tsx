'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, DollarSign } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { DatacenterSellPriceDialog } from '@/components/dashboard/datacenter-sell-price-dialog'
import { PlatformPriceDialog } from '@/components/dashboard/platform-price-dialog'
import {
  PlatformPricePeriodDialog,
  type PlatformPricePeriodSavePayload,
} from '@/components/dashboard/platform-price-period-dialog'
import {
  mockDataCenterDevices,
  mockGPUCardTypes,
} from '@/lib/data/mock-data'
import {
  mockPlatformCardPriceHistory,
  mockPlatformCardPriceRecords,
  mockSupplierDatacenterSellPriceHistory,
  mockSupplierDatacenterSellPrices,
} from '@/lib/data/platform-pricing-mock'
import {
  closePreviousCurrentPeriod,
  findCurrentPeriodId,
  getRecordsForPeriod,
} from '@/lib/platform-pricing/periods'
import {
  buildDetailPageData,
  buildDetailPageDataForPeriod,
} from '@/lib/platform-pricing/transforms'
import type {
  PlatformCardPriceHistory,
  PlatformCardPriceRecord,
  SupplierDatacenterSellPrice,
  SupplierDatacenterSellPriceHistory,
} from '@/lib/types/platform-pricing'
import type {
  PlatformCardPricePeriodRow,
  PlatformPricingDetailPageData,
} from '@/lib/types/platform-pricing-views'
import { CardTypeDetailDatacenters } from './platform-pricing/card-type-detail-datacenters'
import { CardTypeDetailPeriods } from './platform-pricing/card-type-detail-periods'
import { CardTypeDetailPlatformPrices } from './platform-pricing/card-type-detail-platform-prices'
import { PricingHistoryDialog } from './platform-pricing/pricing-history-dialog'
import { cardTypeLabel } from './platform-pricing/platform-pricing-utils'

type PlatformPricingDetailContentProps = {
  initialData: PlatformPricingDetailPageData
}

export function PlatformPricingDetailContent({
  initialData,
}: PlatformPricingDetailContentProps) {
  const [platformRecords, setPlatformRecords] = useState<PlatformCardPriceRecord[]>(
    () => mockPlatformCardPriceRecords.map((r) => ({ ...r })),
  )
  const [sellRecords, setSellRecords] = useState<SupplierDatacenterSellPrice[]>(
    () => mockSupplierDatacenterSellPrices.map((r) => ({ ...r })),
  )
  const [platformHistory, setPlatformHistory] = useState<PlatformCardPriceHistory[]>(
    () => [...mockPlatformCardPriceHistory],
  )
  const [sellHistory, setSellHistory] = useState<SupplierDatacenterSellPriceHistory[]>(
    () => [...mockSupplierDatacenterSellPriceHistory],
  )

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(
    initialData.currentPeriodId ?? initialData.periods[0]?.periodId ?? null,
  )

  const [platformDialogOpen, setPlatformDialogOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<PlatformCardPriceRecord | null>(null)

  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<PlatformCardPricePeriodRow | null>(
    null,
  )

  const [sellDialogOpen, setSellDialogOpen] = useState(false)
  const [editingSell, setEditingSell] = useState<SupplierDatacenterSellPrice | null>(null)
  const [defaultSellDcId, setDefaultSellDcId] = useState<string>()

  const [platformHistoryOpen, setPlatformHistoryOpen] = useState(false)
  const [dcHistoryOpen, setDcHistoryOpen] = useState(false)
  const [dcHistoryTarget, setDcHistoryTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  const cardTypeId = initialData.cardTypeId
  const card = mockGPUCardTypes.find((c) => c.id === cardTypeId)

  const platformHistoryRows = useMemo(
    () => platformHistory.filter((h) => h.gpuCardTypeId === cardTypeId),
    [platformHistory, cardTypeId],
  )

  const baseDetail = useMemo(
    () =>
      buildDetailPageData(
        cardTypeId,
        platformRecords,
        sellRecords,
        platformHistoryRows.length,
      )!,
    [cardTypeId, platformRecords, sellRecords, platformHistoryRows.length],
  )

  useEffect(() => {
    if (
      selectedPeriodId &&
      baseDetail.periods.some((p) => p.periodId === selectedPeriodId)
    ) {
      return
    }
    setSelectedPeriodId(
      baseDetail.currentPeriodId ?? baseDetail.periods[0]?.periodId ?? null,
    )
  }, [baseDetail.periods, baseDetail.currentPeriodId, selectedPeriodId])

  const periodSlice = useMemo(() => {
    if (!selectedPeriodId) {
      return {
        periods: baseDetail.periods,
        platformPrices: [] as PlatformPricingDetailPageData['platformPrices'],
        datacenters: baseDetail.datacenters,
      }
    }
    return buildDetailPageDataForPeriod(
      cardTypeId,
      selectedPeriodId,
      platformRecords,
      sellRecords,
      platformHistoryRows.length,
    )
  }, [
    selectedPeriodId,
    cardTypeId,
    platformRecords,
    sellRecords,
    baseDetail.periods,
    baseDetail.datacenters,
    platformHistoryRows.length,
  ])

  const selectedPeriod = useMemo(
    () => baseDetail.periods.find((p) => p.periodId === selectedPeriodId) ?? null,
    [baseDetail.periods, selectedPeriodId],
  )

  const dcHistoryRows = useMemo(() => {
    if (!dcHistoryTarget) return []
    return sellHistory.filter(
      (h) =>
        h.gpuCardTypeId === cardTypeId && h.dataCenterId === dcHistoryTarget.id,
    )
  }, [sellHistory, cardTypeId, dcHistoryTarget])

  const resolvePlatformRecord = (
    row: {
      productLine: PlatformCardPriceRecord['productLine']
      billingUnit: PlatformCardPriceRecord['billingUnit']
    },
    periodId: string,
  ) =>
    platformRecords.find(
      (r) =>
        r.gpuCardTypeId === cardTypeId &&
        r.periodId === periodId &&
        r.productLine === row.productLine &&
        r.billingUnit === row.billingUnit &&
        r.status !== 'archived',
    )

  const resolveSellRecord = (
    dataCenterId: string,
    productLine: SupplierDatacenterSellPrice['productLine'],
    billingUnit: SupplierDatacenterSellPrice['billingUnit'],
  ) =>
    sellRecords.find(
      (r) =>
        r.gpuCardTypeId === cardTypeId &&
        r.dataCenterId === dataCenterId &&
        r.productLine === productLine &&
        r.billingUnit === billingUnit,
    )

  const handlePeriodSaved = (payload: PlatformPricePeriodSavePayload) => {
    const isEdit = Boolean(editingPeriod)

    setPlatformRecords((list) => {
      let next = [...list]

      if (payload.autoClosePreviousCurrent && !isEdit) {
        next = closePreviousCurrentPeriod(next, cardTypeId, payload.effectiveFrom)
      }

      if (isEdit && editingPeriod) {
        next = next.map((r) => {
          if (r.gpuCardTypeId !== cardTypeId || r.periodId !== editingPeriod.periodId) {
            return r
          }
          return {
            ...r,
            effectiveFrom: payload.effectiveFrom,
            effectiveTo: payload.effectiveTo,
          }
        })
        return next
      }

      if (payload.copyFromPeriodId) {
        const source = getRecordsForPeriod(list, cardTypeId, payload.copyFromPeriodId)
        const copies = source.map((r) => ({
          ...r,
          id: `pcp-${Date.now()}-${r.productLine}-${r.billingUnit}`,
          periodId: payload.periodId,
          effectiveFrom: payload.effectiveFrom,
          effectiveTo: payload.effectiveTo,
          updatedAt: new Date().toISOString(),
        }))
        return [...next, ...copies]
      }

      return next
    })

    setSelectedPeriodId(payload.periodId)
    setEditingPeriod(null)
  }

  const handlePlatformSaved = (record: PlatformCardPriceRecord, isNew: boolean) => {
    const prev = isNew ? undefined : platformRecords.find((r) => r.id === record.id)

    if (!isNew && prev && prev.sellPrice !== record.sellPrice) {
      setPlatformHistory((h) => [
        {
          id: `pcph-${Date.now()}`,
          priceRecordId: record.id,
          gpuCardTypeId: record.gpuCardTypeId,
          cardTypeName: record.cardTypeName,
          productLine: record.productLine,
          billingUnit: record.billingUnit,
          previousSellPrice: prev.sellPrice,
          newSellPrice: record.sellPrice,
          changedAt: record.updatedAt,
          changedBy: record.updatedBy ?? '当前用户',
          reason: record.remark,
        },
        ...h,
      ])
    }

    setPlatformRecords((list) => {
      const updated = isNew
        ? [...list, record]
        : list.map((r) => (r.id === record.id ? record : r))
      const currentId = findCurrentPeriodId(updated, cardTypeId)
      if (record.periodId === currentId) {
        setSellRecords((sellList) =>
          sellList.map((r) => {
            if (
              r.inheritPlatformPrice &&
              r.gpuCardTypeId === record.gpuCardTypeId &&
              r.productLine === record.productLine &&
              r.billingUnit === record.billingUnit
            ) {
              return {
                ...r,
                sellPrice: record.sellPrice,
                platformSellPrice: record.sellPrice,
                updatedAt: record.updatedAt,
              }
            }
            return r
          }),
        )
      }
      return updated
    })
  }

  const handleSellSaved = (record: SupplierDatacenterSellPrice, isNew: boolean) => {
    const prev = isNew ? undefined : sellRecords.find((r) => r.id === record.id)

    if (isNew) {
      setSellRecords((list) => [...list, record])
    } else {
      setSellRecords((list) => list.map((r) => (r.id === record.id ? record : r)))
    }

    if (!isNew && prev && prev.sellPrice !== record.sellPrice) {
      setSellHistory((h) => [
        {
          id: `sdsph-${Date.now()}`,
          sellPriceId: record.id,
          supplierId: record.supplierId,
          supplierName: record.supplierName,
          dataCenterId: record.dataCenterId,
          dataCenterName: record.dataCenterName,
          gpuCardTypeId: record.gpuCardTypeId,
          cardTypeName: record.cardTypeName,
          productLine: record.productLine,
          billingUnit: record.billingUnit,
          previousSellPrice: prev.sellPrice,
          newSellPrice: record.sellPrice,
          changedAt: record.updatedAt,
          changedBy: record.updatedBy ?? '当前用户',
          reason: record.remark,
        },
        ...h,
      ])
    }
  }

  if (!card) return null

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2 h-8" asChild>
            <Link href="/supplier/platform-pricing">
              <ArrowLeft className="size-4" />
              返回列表
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">{initialData.cardTypeName}</h1>
          <p className="text-sm text-muted-foreground">{cardTypeLabel(card)}</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" asChild>
          <Link href="/supplier/unit-costs">
            <DollarSign className="size-4" />
            机房成本定价
          </Link>
        </Button>
      </div>

      <CardTypeDetailPeriods
        periods={periodSlice.periods}
        selectedPeriodId={selectedPeriodId}
        onSelectPeriod={setSelectedPeriodId}
        onAddPeriod={() => {
          setEditingPeriod(null)
          setPeriodDialogOpen(true)
        }}
        onEditPeriod={(period) => {
          setEditingPeriod(period)
          setPeriodDialogOpen(true)
        }}
      />

      <CardTypeDetailPlatformPrices
        selectedPeriod={selectedPeriod}
        rows={periodSlice.platformPrices}
        platformHistoryCount={platformHistoryRows.length}
        onOpenHistory={() => setPlatformHistoryOpen(true)}
        onAddPrice={() => {
          setEditingPlatform(null)
          setPlatformDialogOpen(true)
        }}
        onEditPrice={(record) => {
          setEditingPlatform(record)
          setPlatformDialogOpen(true)
        }}
        resolveRecord={(row) =>
          row.recordId
            ? platformRecords.find((r) => r.id === row.recordId)
            : selectedPeriodId
              ? resolvePlatformRecord(row, selectedPeriodId)
              : undefined
        }
      />

      <CardTypeDetailDatacenters
        datacenters={periodSlice.datacenters}
        onOpenDatacenterHistory={(id, name) => {
          setDcHistoryTarget({ id, name })
          setDcHistoryOpen(true)
        }}
        onEditSellPrice={(record) => {
          setEditingSell(record)
          setDefaultSellDcId(record.dataCenterId)
          setSellDialogOpen(true)
        }}
        onAddSellPrice={(dataCenterId) => {
          setEditingSell(null)
          setDefaultSellDcId(dataCenterId)
          setSellDialogOpen(true)
        }}
        resolveSellRecord={resolveSellRecord}
      />

      <PlatformPricePeriodDialog
        open={periodDialogOpen}
        onOpenChange={setPeriodDialogOpen}
        cardTypeId={cardTypeId}
        cardTypeName={initialData.cardTypeName}
        existingRecords={platformRecords}
        periods={periodSlice.periods}
        editing={editingPeriod}
        onSaved={handlePeriodSaved}
      />

      <PlatformPriceDialog
        open={platformDialogOpen}
        onOpenChange={setPlatformDialogOpen}
        existingRecords={platformRecords}
        cardTypes={mockGPUCardTypes}
        editing={editingPlatform}
        defaultCardTypeId={cardTypeId}
        periodId={selectedPeriodId ?? undefined}
        periodEffectiveFrom={selectedPeriod?.effectiveFrom}
        periodEffectiveTo={selectedPeriod?.effectiveTo ?? null}
        onSaved={handlePlatformSaved}
      />

      <DatacenterSellPriceDialog
        open={sellDialogOpen}
        onOpenChange={setSellDialogOpen}
        existingRecords={sellRecords}
        cardTypes={mockGPUCardTypes}
        availableCardTypeIds={[...new Set(mockDataCenterDevices.map((d) => d.cardTypeId))]}
        editing={editingSell}
        defaultDataCenterId={defaultSellDcId}
        defaultCardTypeId={cardTypeId}
        onSaved={handleSellSaved}
      />

      <PricingHistoryDialog
        open={platformHistoryOpen}
        onOpenChange={setPlatformHistoryOpen}
        mode="platform"
        title={`${initialData.cardTypeName} · 平台调价历史`}
        description="L1 平台标准价变更记录（全时间段）"
        platformHistory={platformHistoryRows}
      />

      <PricingHistoryDialog
        open={dcHistoryOpen}
        onOpenChange={setDcHistoryOpen}
        mode="datacenter"
        title={
          dcHistoryTarget
            ? `${initialData.cardTypeName} @ ${dcHistoryTarget.name}`
            : '机房调价历史'
        }
        description="L2 该机房该卡型销售价变更记录"
        datacenterHistory={dcHistoryRows}
      />
    </div>
  )
}
