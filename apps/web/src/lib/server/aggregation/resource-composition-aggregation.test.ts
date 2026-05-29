import { describe, expect, it } from 'vitest'

import {
  aggregateEntityCompositionBuckets,
  classifyDeviceExclusiveBucket,
} from './resource-composition-aggregation'

const baseDevice = {
  id: 'd1',
  gpuCount: 8,
  cardTypeName: 'H800',
  cardTypeCode: 'h800',
  cardTypeRole: 'compute' as const,
}

describe('classifyDeviceExclusiveBucket', () => {
  it('prioritizes maintenance over pool membership', () => {
    const key = classifyDeviceExclusiveBucket(
      {
        ...baseDevice,
        lifecycleStatus: '维护中',
        opsStatus: '在集群中',
        inMaintenance: true,
      },
      new Set(),
    )
    expect(key).toBe('maintenance')
  })

  it('splits dual pool into exclusive bucket', () => {
    const key = classifyDeviceExclusiveBucket(
      {
        ...baseDevice,
        lifecycleStatus: '在线',
        opsStatus: '网关代理裸金属上架中',
        inMaintenance: false,
      },
      new Set(),
    )
    expect(key).toBe('pool_dual')
  })
})

describe('aggregateEntityCompositionBuckets', () => {
  it('mutually excludes devices across buckets', () => {
    const buckets = aggregateEntityCompositionBuckets(
      [
        {
          ...baseDevice,
          id: 'd1',
          lifecycleStatus: '在线',
          opsStatus: '在集群中',
          inMaintenance: false,
        },
        {
          ...baseDevice,
          id: 'd2',
          lifecycleStatus: '接入中',
          opsStatus: '预留闲置中',
          inMaintenance: false,
        },
      ],
      new Set(),
    )
    expect(buckets.pool_elastic_only.deviceCount).toBe(1)
    expect(buckets.reserved_idle.deviceCount).toBe(1)
    const totalDevices =
      buckets.pool_elastic_only.deviceCount + buckets.reserved_idle.deviceCount
    expect(totalDevices).toBe(2)
  })
})
