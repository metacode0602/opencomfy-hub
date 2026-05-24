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
import { buildDetailPageDataForPeriod, toPeriodRows } from '@/lib/platform-pricing/transforms'
import {
  formatPeriodRange,
  getPeriodPhase,
  parsePeriodDate,
  platformPricePeriodPhaseNames,
} from '@/lib/platform-pricing/periods'
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

type LocalPeriodMeta = {
  periodId: string
  effectiveFrom: string
  effectiveTo: string | null
}

const EMPTY_PLATFORM_RECORDS: PlatformCardPriceRecord[] = []

function mergePeriodRows(
  records: PlatformCardPriceRecord[],
  cardTypeId: string,
  emptyPeriods: LocalPeriodMeta[],
): PlatformCardPricePeriodRow[] {
  const fromRecords = toPeriodRows(records, cardTypeId)
  const existingIds = new Set(fromRecords.map((period) => period.periodId))
  const extras = emptyPeriods
    .filter((period) => !existingIds.has(period.periodId))
    .map((period) => {
      const phase = getPeriodPhase(period.effectiveFrom, period.effectiveTo, false)
      return {
        periodId: period.periodId,
        effectiveFrom: period.effectiveFrom,
        effectiveTo: period.effectiveTo,
        rangeLabel: formatPeriodRange(period.effectiveFrom, period.effectiveTo),
        phase,
        phaseLabel: platformPricePeriodPhaseNames[phase],
        priceEntryCount: 0,
        isCurrent: false,
      }
    })

  const merged = [...fromRecords, ...extras]
  const currentCandidates = merged.filter((period) => period.phase === 'current')
  if (currentCandidates.length === 1) {
    currentCandidates[0]!.isCurrent = true
  }

  return merged.sort(
    (a, b) => parsePeriodDate(b.effectiveFrom) - parsePeriodDate(a.effectiveFrom),
  )
}

async function invalidatePlatformPricingQueries(
  utils: ReturnType<typeof trpc.useUtils>,
  cardTypeId: string,
  options?: { includeHistory?: boolean },
) {
  await Promise.all([
    utils.supplier.platformPricing.getDetailPage.invalidate({ cardTypeId }),
    utils.supplier.platformPricing.listRecordsForCardType.invalidate({ cardTypeId }),
    utils.supplier.platformPricing.listPage.invalidate(),
    utils.supplier.platformPricing.listRecords.invalidate(),
    options?.includeHistory
      ? utils.supplier.platformPricing.listHistory.invalidate({ cardTypeId })
      : Promise.resolve(),
  ])
}

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

  const { data: platformRecordsData } =
    trpc.supplier.platformPricing.listRecordsForCardType.useQuery({ cardTypeId })
  const platformRecords = platformRecordsData ?? EMPTY_PLATFORM_RECORDS

  /** 无价格的时间段在落库前仅本地占位，待新增产品线价后清除 */
  const [localEmptyPeriods, setLocalEmptyPeriods] = useState<LocalPeriodMeta[]>([])

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

  const mergedPeriods = useMemo(
    () => mergePeriodRows(platformRecords, cardTypeId, localEmptyPeriods),
    [platformRecords, cardTypeId, localEmptyPeriods],
  )

  const mergedPeriodIdsKey = useMemo(
    () => mergedPeriods.map((period) => period.periodId).join('\0'),
    [mergedPeriods],
  )

  useEffect(() => {
    if (!detail) return
    setSelectedPeriodId((current) => {
      if (current && mergedPeriods.some((period) => period.periodId === current)) {
        return current
      }
      const next =
        mergedPeriods.find((period) => period.isCurrent)?.periodId ??
        detail.currentPeriodId ??
        mergedPeriods[0]?.periodId ??
        null
      return next === current ? current : next
    })
  }, [detail, mergedPeriodIdsKey, mergedPeriods])

  const createMutation = trpc.supplier.platformPricing.create.useMutation({
    onSuccess: async () => {
      toast.success('平台标准价已创建')
      setPlatformDialogOpen(false)
      setLocalEmptyPeriods((prev) =>
        selectedPeriodId
          ? prev.filter((period) => period.periodId !== selectedPeriodId)
          : prev,
      )
      await invalidatePlatformPricingQueries(utils, cardTypeId, {
        includeHistory: platformHistoryOpen,
      })
    },
    onError: (e) => toast.error(e.message || '创建失败，请稍后重试'),
  })

  const updateMutation = trpc.supplier.platformPricing.update.useMutation({
    onSuccess: async () => {
      toast.success('平台标准价已更新')
      setPlatformDialogOpen(false)
      await invalidatePlatformPricingQueries(utils, cardTypeId, { includeHistory: true })
    },
    onError: (e) => toast.error(e.message || '更新失败，请稍后重试'),
  })

  const createPeriodMutation = trpc.supplier.platformPricing.createPeriod.useMutation({
    onError: (e) => toast.error(e.message || '创建时间段失败，请稍后重试'),
  })

  const updatePeriodMutation = trpc.supplier.platformPricing.updatePeriod.useMutation({
    onError: (e) => toast.error(e.message || '更新时间段失败，请稍后重试'),
  })

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    createPeriodMutation.isPending ||
    updatePeriodMutation.isPending

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
        periods: mergedPeriods,
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
    mergedPeriods,
  ])

  const selectedPeriod = useMemo(
    () => mergedPeriods.find((p) => p.periodId === selectedPeriodId) ?? null,
    [mergedPeriods, selectedPeriodId],
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

  const handlePeriodSaved = async (payload: PlatformPricePeriodSavePayload) => {
    try {
      if (editingPeriod) {
        const isLocalOnly = localEmptyPeriods.some(
          (period) => period.periodId === editingPeriod.periodId,
        )

        if (isLocalOnly) {
          const nextPeriodId = `${cardTypeId}:${payload.effectiveFrom}`
          setLocalEmptyPeriods((prev) =>
            prev.map((period) =>
              period.periodId === editingPeriod.periodId
                ? {
                    periodId: nextPeriodId,
                    effectiveFrom: payload.effectiveFrom,
                    effectiveTo: payload.effectiveTo,
                  }
                : period,
            ),
          )
          toast.success('时间段已更新')
          setSelectedPeriodId(nextPeriodId)
        } else {
          const result = await updatePeriodMutation.mutateAsync({
            gpuCardTypeId: cardTypeId,
            periodId: payload.periodId,
            effectiveFrom: payload.effectiveFrom,
            effectiveTo: payload.effectiveTo,
          })
          toast.success('时间段已更新')
          setSelectedPeriodId(result.periodId)
          await invalidatePlatformPricingQueries(utils, cardTypeId, { includeHistory: true })
        }
      } else {
        const result = await createPeriodMutation.mutateAsync({
          gpuCardTypeId: cardTypeId,
          effectiveFrom: payload.effectiveFrom,
          effectiveTo: payload.effectiveTo,
          copyFromPeriodId: payload.copyFromPeriodId,
          autoClosePreviousCurrent: payload.autoClosePreviousCurrent,
          manualPrices: payload.manualPrices,
        })

        if (result.recordCount === 0) {
          setLocalEmptyPeriods((prev) => [
            ...prev.filter((period) => period.periodId !== result.periodId),
            {
              periodId: result.periodId,
              effectiveFrom: result.effectiveFrom,
              effectiveTo: result.effectiveTo,
            },
          ])
          toast.success('时间段已创建，请在下方补充产品线价格')
        } else if (payload.copyFromPeriodId) {
          toast.success('时间段已创建，已复制产品线价格')
        } else {
          toast.success(`时间段已创建，已配置 ${result.recordCount} 条价格`)
        }
        setSelectedPeriodId(result.periodId)
        await invalidatePlatformPricingQueries(utils, cardTypeId, { includeHistory: true })
      }

      setEditingPeriod(null)
      setPeriodDialogOpen(false)
    } catch {
      // 错误已在 mutation.onError 中 toast
    }
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
        periods={mergedPeriods}
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
        periods={mergedPeriods}
        editing={editingPeriod}
        isSubmitting={createPeriodMutation.isPending || updatePeriodMutation.isPending}
        onSaved={handlePeriodSaved}
      />

      <PlatformPriceDialog
        open={platformDialogOpen}
        onOpenChange={setPlatformDialogOpen}
        existingRecords={platformRecords}
        cardTypes={cardTypes.length > 0 ? cardTypes : [card]}
        editing={editingPlatform}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
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
