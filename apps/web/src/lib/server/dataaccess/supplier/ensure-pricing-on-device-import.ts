import { db } from '@/lib/db'
import { normalizePlatformDateTime } from '@/lib/platform-pricing/datetime'
import { supplierPricingRecord } from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function toMoneyZero(): string {
  return '0.0000'
}

function resolvePlaceholderPricingMode(
  defaultCooperationMode: string | null | undefined,
): 'card_time' | 'revenue_share' {
  return defaultCooperationMode === 'revenue_share' ? 'revenue_share' : 'card_time'
}

/**
 * 设备主数据导入后：为缺失的「机房×卡型」插入占位成本（单价 0、config_status=unavailable）。
 */
export async function ensurePricingRecordsForImportedCardTypes(
  tx: DbTx,
  params: {
    supplierId: string
    dataCenterId: string
    gpuCardTypeIds: string[]
    defaultCooperationMode?: string | null
    syncedAt?: Date
  },
): Promise<{ createdCardTypeIds: string[] }> {
  const uniqueIds = [...new Set(params.gpuCardTypeIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { createdCardTypeIds: [] }
  }

  const effectiveFrom = normalizePlatformDateTime(
    (params.syncedAt ?? new Date()).toISOString(),
  )
  const pricingMode = resolvePlaceholderPricingMode(params.defaultCooperationMode)
  const createdCardTypeIds: string[] = []

  for (const gpuCardTypeId of uniqueIds) {
    const existing = await tx.query.supplierPricingRecord.findFirst({
      where: and(
        eq(supplierPricingRecord.supplierId, params.supplierId),
        eq(supplierPricingRecord.dataCenterId, params.dataCenterId),
        eq(supplierPricingRecord.gpuCardTypeId, gpuCardTypeId),
      ),
      columns: { id: true },
    })
    if (existing) continue

    await tx.insert(supplierPricingRecord).values({
      id: crypto.randomUUID(),
      supplierId: params.supplierId,
      dataCenterId: params.dataCenterId,
      gpuCardTypeId,
      pricingMode,
      configStatus: 'unavailable',
      unitPricePerHour: pricingMode === 'card_time' ? toMoneyZero() : null,
      revenueSharePercent: pricingMode === 'revenue_share' ? '0' : null,
      pricingTiers: null,
      effectiveFrom,
      effectiveTo: null,
      updatedByStaffId: null,
    })
    createdCardTypeIds.push(gpuCardTypeId)
  }

  return { createdCardTypeIds }
}
