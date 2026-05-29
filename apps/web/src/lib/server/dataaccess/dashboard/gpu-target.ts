import { db } from '@/lib/db'
import {
  aggregateGpuTargetAt,
  planLineCardKeysFromJson,
  TARGET_OFFBOARD_BATCH_KIND,
  TARGET_ONBOARD_BATCH_KINDS,
  type TargetPlanBatch,
} from '@/lib/server/aggregation/overview-aggregation'
import type { GlobalDashboardFilters } from '@/lib/types/global-dashboard-api'
import type { OverviewFiltersInput } from '@/lib/types/supplier-overview-api'
import { onboardingBatch } from '@workspace/db/schema'
import { and, eq, inArray, lte } from 'drizzle-orm'

const TARGET_BATCH_KINDS = [...TARGET_ONBOARD_BATCH_KINDS, TARGET_OFFBOARD_BATCH_KIND] as const

function toTargetFilters(
  filters: OverviewFiltersInput | GlobalDashboardFilters,
): {
  region?: string
  cardType?: string
  supplierId?: string
  dataCenterId?: string
} {
  return {
    region: filters.region ?? 'all',
    cardType: filters.cardType ?? 'all',
    supplierId: filters.supplierId ?? 'all',
    dataCenterId: 'dataCenterId' in filters ? filters.dataCenterId : undefined,
  }
}

export async function loadGpuTargetPlanBatches(options?: {
  createdBefore?: Date
  supplierId?: string
}): Promise<TargetPlanBatch[]> {
  const conditions = [inArray(onboardingBatch.batchKind, [...TARGET_BATCH_KINDS])]

  if (options?.supplierId && options.supplierId !== 'all') {
    conditions.push(eq(onboardingBatch.supplierId, options.supplierId))
  }
  if (options?.createdBefore) {
    conditions.push(lte(onboardingBatch.createdAt, options.createdBefore))
  }

  const rows = await db
    .select({
      batchKind: onboardingBatch.batchKind,
      batchStatus: onboardingBatch.batchStatus,
      supplierId: onboardingBatch.supplierId,
      dataCenterId: onboardingBatch.dataCenterId,
      dataCenterName: onboardingBatch.dataCenterName,
      idcRegion: onboardingBatch.idcRegion,
      plannedDeviceCount: onboardingBatch.plannedDeviceCount,
      plannedGpuCount: onboardingBatch.plannedGpuCount,
      plannedLinesJson: onboardingBatch.plannedLinesJson,
      createdAt: onboardingBatch.createdAt,
      updatedAt: onboardingBatch.updatedAt,
    })
    .from(onboardingBatch)
    .where(and(...conditions))

  return rows.map((row) => ({
    batchKind: row.batchKind,
    batchStatus: row.batchStatus,
    supplierId: row.supplierId,
    dataCenterId: row.dataCenterId,
    dataCenterName: row.dataCenterName,
    idcRegion: row.idcRegion,
    plannedDeviceCount: row.plannedDeviceCount,
    plannedGpuCount: row.plannedGpuCount,
    plannedLinesJson: row.plannedLinesJson,
    plannedLineCardKeys: planLineCardKeysFromJson(row.plannedLinesJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

export async function resolveGpuTargetGpu(
  filters: OverviewFiltersInput | GlobalDashboardFilters,
  at: Date,
): Promise<number> {
  const targetFilters = toTargetFilters(filters)
  const batches = await loadGpuTargetPlanBatches({
    createdBefore: at,
    supplierId: targetFilters.supplierId,
  })
  return aggregateGpuTargetAt(batches, at, targetFilters)
}
