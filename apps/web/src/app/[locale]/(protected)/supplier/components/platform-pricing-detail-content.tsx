'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { DatacenterSellPriceDialog } from '@/components/dashboard/datacenter-sell-price-dialog'
import {
  PlatformPriceDialog,
  type PlatformPriceFormValues,
} from '@/components/dashboard/platform-price-dialog'
import {
  PlatformPricePeriodDialog,
  type PlatformPricePeriodSavePayload,
} from '@/components/dashboard/platform-price-period-dialog'
import { mockDataCenterDevices, mockGPUCardTypes } from '@/lib/data/mock-data'
import {
  mockSupplierDatacenterSellPriceHistory,
  mockSupplierDatacenterSellPrices,
} from '@/lib/data/platform-pricing-mock'
import { buildDetailPageDataForPeriod } from '@/lib/platform-pricing/transforms'
import type {
  PlatformCardPriceRecord,
  SupplierDatacenterSellPrice,
  SupplierDatacenterSellPriceHistory,
} from '@/lib/types/platform-pricing'
import type { PlatformCardPricePeriodRow } from '@/lib/types/platform-pricing-views'
import { trpc } from '@/lib/trpc/client'
import { CardTypeDetailDatacenters } from './platform-pricing/card-type-detail-datacenters'
import { CardTypeDetailPeriods } from './platform-pricing/card-type-detail-periods'
import { CardTypeDetailPlatformPrices } from './platform-pricing/card-type-detail-platform-prices'
import { PricingHistoryDialog } from './platform-pricing/pricing-history-dialog'
import { cardTypeLabel } from './platform-pricing/platform-pricing-utils'

type PlatformPricingDetailContentProps = {
  cardTypeId: string
}

export function PlatformPricingDetailContent({ cardTypeId }: PlatformPricingDetailContentProps) {
  const utils = trpc.useUtils()

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorObj,
    refetch: refetchDetail,
  } = trpc.supplier.platformPricing.getDetailPage.useQuery({ cardTypeId })

  const {
    data: platformRecords = [],
  } = trpc.supplier.platformPricing.listRecordsForCardType.useQuery({ cardTypeId })

  const { data: cardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery()

  const [platformHistoryOpen, setPlatformHistoryOpen] = useState(false)
  const {
    data: platformHistory = [],
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = trpc.supplier.platformPricing.listHistory.useQuery(
    { cardTypeId },
    { enabled: platformHistoryOpen },
  )

  const [sellRecords, setSellRecords] = useState<SupplierDatacenterSellPrice[]>(
    () => mockSupplierDatacenterSellPrices.map((r) => ({ ...r })),
  )
  const [sellHistory, setSellHistory] = useState<SupplierDatacenterSellPriceHistory[]>(
    () => [...mockSupplierDatacenterSellPriceHistory],
  )

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)

  const [platformDialogOpen, setPlatformDialogOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<PlatformCardPriceRecord | null>(null)

  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<PlatformCardPricePeriodRow | null>(null)

  const [sellDialogOpen, setSellDialogOpen] = useState(false)
  const [editingSell, setEditingSell] = useState<SupplierDatacenterSellPrice | null>(null)
  const [defaultSellDcId, setDefaultSellDcId] = useState<string>()

  const [dcHistoryOpen, setDcHistoryOpen] = useState(false)
  const [dcHistoryTarget, setDcHistoryTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    if (!detail) return
    setSelectedPeriodId((current) => {
      if (current && detail.periods.some((p) => p.periodId === current)) {
        return current
      }
      return detail.currentPeriodId ?? detail.periods[0]?.periodId ?? null
    })
  }, [detail])

  const createMutation = trpc.supplier.platformPricing.create.useMutation({
    onSuccess: async () => {
      toast.success('平台标准价已创建')
      setPlatformDialogOpen(false)
      await Promise.all([
        utils.supplier.platformPricing.getDetailPage.invalidate({ cardTypeId }),
        utils.supplier.platformPricing.listRecordsForCardType.invalidate({ cardTypeId }),
        utils.supplier.platformPricing.listPage.invalidate(),
        utils.supplier.platformPricing.listRecords.invalidate(),
        platformHistoryOpen
          ? utils.supplier.platformPricing.listHistory.invalidate({ cardTypeId })
          : Promise.resolve(),
      ])
    },
    onError: (e) => toast.error(e.message || '创建失败，请稍后重试'),
  })

  const updateMutation = trpc.supplier.platformPricing.update.useMutation({
    onSuccess: async () => {
      toast.success('平台标准价已更新')
      setPlatformDialogOpen(false)
      await Promise.all([
        utils.supplier.platformPricing.getDetailPage.invalidate({ cardTypeId }),
        utils.supplier.platformPricing.listRecordsForCardType.invalidate({ cardTypeId }),
        utils.supplier.platformPricing.listPage.invalidate(),
        utils.supplier.platformPricing.listRecords.invalidate(),
        utils.supplier.platformPricing.listHistory.invalidate({ cardTypeId }),
      ])
    },
    onError: (e) => toast.error(e.message || '更新失败，请稍后重试'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const periodSlice = useMemo(() => {
    if (!detail) {
      return {
        periods: [] as PlatformCardPricePeriodRow[],
        platformPrices: [] as NonNullable<typeof detail>['platformPrices'],
        datacenters: [] as NonNullable<typeof detail>['datacenters'],
      }
    }
    if (!selectedPeriodId) {
      return {
        periods: detail.periods,
        platformPrices: [],
        datacenters: detail.datacenters,
      }
    }
    return buildDetailPageDataForPeriod(
      cardTypeId,
      selectedPeriodId,
      platformRecords,
      sellRecords,
      platformHistoryOpen ? platformHistory.length : detail.platformHistoryCount,
    )
  }, [
    detail,
    selectedPeriodId,
    cardTypeId,
    platformRecords,
    sellRecords,
    platformHistoryOpen,
    platformHistory.length,
  ])

  const selectedPeriod = useMemo(
    () => detail?.periods.find((p) => p.periodId === selectedPeriodId) ?? null,
    [detail?.periods, selectedPeriodId],
  )

  const dcHistoryRows = useMemo(() => {
    if (!dcHistoryTarget) return []
    return sellHistory.filter(
      (h) => h.gpuCardTypeId === cardTypeId && h.dataCenterId === dcHistoryTarget.id,
    )
  }, [sellHistory, cardTypeId, dcHistoryTarget])

  const card = useMemo(
    () => cardTypes.find((c) => c.id === cardTypeId) ?? mockGPUCardTypes.find((c) => c.id === cardTypeId),
    [cardTypes, cardTypeId],
  )

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
        r.billingUnit === row.billingUnit,
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
    toast.info('时间段管理暂未接入数据库，当前为本地预览')
    setSelectedPeriodId(payload.periodId)
    setEditingPeriod(null)
    setPeriodDialogOpen(false)
  }

  const handlePlatformSaved = (
    record: PlatformCardPriceRecord,
    isNew: boolean,
    form: PlatformPriceFormValues,
  ) => {
    if (isNew) {
      createMutation.mutate(form)
      return
    }
    updateMutation.mutate({ recordId: record.id, ...form })
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
    setSellDialogOpen(false)
  }

  if (detailLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">加载卡型定价详情中…</div>
    )
  }

  if (detailError || !detail) {
    return (
      <div className="space-y-4 py-8">
        <p className="text-destructive">
          {detailErrorObj?.message || '卡型不存在或加载失败'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchDetail()}>
            重试
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/supplier/platform-pricing">返回列表</Link>
          </Button>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-semibold text-foreground">{detail.cardTypeName}</h1>
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
        platformHistoryCount={detail.platformHistoryCount}
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
        cardTypeName={detail.cardTypeName}
        existingRecords={platformRecords}
        periods={periodSlice.periods}
        editing={editingPeriod}
        onSaved={handlePeriodSaved}
      />

      <PlatformPriceDialog
        open={platformDialogOpen}
        onOpenChange={setPlatformDialogOpen}
        existingRecords={platformRecords}
        cardTypes={cardTypes.length > 0 ? cardTypes : [card]}
        editing={editingPlatform}
        isSubmitting={isSaving}
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
        cardTypes={cardTypes.length > 0 ? cardTypes : [card]}
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
        title={`${detail.cardTypeName} · 平台调价历史`}
        description="L1 平台标准价变更记录（全时间段）"
        platformHistory={platformHistory}
        isLoading={historyLoading}
        isError={historyError}
        onRetry={() => refetchHistory()}
      />

      <PricingHistoryDialog
        open={dcHistoryOpen}
        onOpenChange={setDcHistoryOpen}
        mode="datacenter"
        title={
          dcHistoryTarget
            ? `${detail.cardTypeName} @ ${dcHistoryTarget.name}`
            : '机房调价历史'
        }
        description="L2 该机房该卡型销售价变更记录"
        datacenterHistory={dcHistoryRows}
      />
    </div>
  )
}
