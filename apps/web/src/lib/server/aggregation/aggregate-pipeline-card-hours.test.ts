import { describe, expect, it } from 'vitest'

import { aggregatePipelineCardHoursFromGapSeries } from './aggregate-pipeline-card-hours'
import type { PeriodBucket } from '@/lib/server/dataaccess/dashboard/period-time'

const bucket: PeriodBucket = {
  key: '2026-05-28',
  label: '2026-05-28 00:00',
  start: new Date('2026-05-27T16:00:00.000Z'),
  end: new Date('2026-05-28T15:59:59.999Z'),
}

describe('aggregatePipelineCardHoursFromGapSeries', () => {
  it('computes pipeline gap card hours (PC-T4)', () => {
    const totals = aggregatePipelineCardHoursFromGapSeries({
      buckets: [bucket],
      periodStart: bucket.start,
      periodEnd: bucket.end,
      gapAtBucketStart: [
        {
          pendingAccess: { deviceCount: 2, gpuCount: 32 },
          retiring: { deviceCount: 0, gpuCount: 0 },
        },
      ],
    })
    expect(totals.pendingAccess.cardHours).toBe(32 * 24)
    expect(totals.pendingAccess.machineHours).toBe(2 * 24)
  })
})
