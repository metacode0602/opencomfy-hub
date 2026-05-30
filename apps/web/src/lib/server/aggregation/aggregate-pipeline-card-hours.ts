/**
 * Period 计划虚拟扇区卡时/台时 — 缺口时点阶梯积分（M4：无 progress_event 时用 batch+link 回放）
 * @see global-dashboard-period-composition-card-hours-design.md §9.3
 */

import type { PeriodBucket } from '@/lib/server/dataaccess/dashboard/period-time'
import { effectiveBucketDurationHours } from '@/lib/server/dataaccess/dashboard/period-time'
import type { PipelinePendingGap } from './overview-aggregation'

export type PipelineCardHoursTotals = {
  pendingAccess: { cardHours: number; machineHours: number }
  retiring: { cardHours: number; machineHours: number }
}

export function emptyPipelineCardHours(): PipelineCardHoursTotals {
  return {
    pendingAccess: { cardHours: 0, machineHours: 0 },
    retiring: { cardHours: 0, machineHours: 0 },
  }
}

/**
 * 对每个桶 τ，在 τ 起点取缺口 GPU/台数，乘以 |τ| 累加（§9.3）。
 */
export function aggregatePipelineCardHoursFromGapSeries(input: {
  buckets: PeriodBucket[]
  periodStart: Date
  periodEnd: Date
  gapAtBucketStart: Array<{
    pendingAccess: PipelinePendingGap
    retiring: PipelinePendingGap
  }>
}): PipelineCardHoursTotals {
  const totals = emptyPipelineCardHours()

  if (input.gapAtBucketStart.length !== input.buckets.length) {
    throw new Error(
      `aggregatePipelineCardHoursFromGapSeries: bucket count mismatch (${input.buckets.length} vs ${input.gapAtBucketStart.length})`,
    )
  }

  for (let i = 0; i < input.buckets.length; i++) {
    const bucket = input.buckets[i]!
    const gap = input.gapAtBucketStart[i]!
    const hours = effectiveBucketDurationHours(bucket, input.periodStart, input.periodEnd)
    if (hours <= 0) continue

    totals.pendingAccess.cardHours += gap.pendingAccess.gpuCount * hours
    totals.pendingAccess.machineHours += gap.pendingAccess.deviceCount * hours
    totals.retiring.cardHours += gap.retiring.gpuCount * hours
    totals.retiring.machineHours += gap.retiring.deviceCount * hours
  }

  return totals
}
