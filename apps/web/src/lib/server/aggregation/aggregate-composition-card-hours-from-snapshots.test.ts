import { describe, expect, it } from 'vitest'

import {
  aggregateCompositionCardHoursFromSnapshots,
  integrateDeviceAtBucketEnd,
  emptyEntityCardHoursBuckets,
} from './aggregate-composition-card-hours-from-snapshots'
import type { PeriodBucket } from '@/lib/server/dataaccess/dashboard/period-time'

const device = {
  id: 'd1',
  gpuCount: 8,
  lifecycleStatus: '在线',
  opsStatus: '在集群中',
  inMaintenance: false,
  cardTypeName: 'H800',
  cardTypeCode: 'h800',
  cardTypeRole: 'compute' as const,
}

const oneDayBucket: PeriodBucket = {
  key: '2026-05-28',
  label: '2026-05-28 00:00',
  start: new Date('2026-05-27T16:00:00.000Z'),
  end: new Date('2026-05-28T15:59:59.999Z'),
}

describe('integrateDeviceAtBucketEnd', () => {
  it('accumulates card hours for elastic-only bucket (PC-T1)', () => {
    const buckets = emptyEntityCardHoursBuckets()
    integrateDeviceAtBucketEnd({
      device,
      bucketKey: 'pool_elastic_only',
      durationHours: 24,
      buckets,
    })
    expect(buckets.pool_elastic_only.cardHours).toBe(192)
    expect(buckets.pool_elastic_only.machineHours).toBe(24)
  })
})

describe('aggregateCompositionCardHoursFromSnapshots', () => {
  it('integrates one device over a single day bucket', () => {
    const at = oneDayBucket.end
    const snapshots = new Map([
      [
        'd1',
        [{ at, device }],
      ],
    ])
    const result = aggregateCompositionCardHoursFromSnapshots({
      buckets: [oneDayBucket],
      periodStart: oneDayBucket.start,
      periodEnd: oneDayBucket.end,
      snapshotsByDevice: snapshots,
      fallbackDevices: [],
      internalHoldDeviceIds: new Set(),
    })
    expect(result.pool_elastic_only.cardHours).toBe(192)
  })
})
