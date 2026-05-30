/**
 * Period 实体扇区卡时/台时 — 主数据 device_*_snapshot 阶梯积分（纯函数）
 * @see apps/web/content/design/global-dashboard-period-composition-card-hours-design.md §8.4
 */

import { metricGpuCount } from '@/lib/supplier/gpu-card-type-metrics'
import type { PeriodBucket } from '@/lib/server/dataaccess/dashboard/period-time'
import { effectiveBucketDurationHours } from '@/lib/server/dataaccess/dashboard/period-time'

import {
  classifyDeviceExclusiveBucket,
  isDeviceExcludedFromComposition,
  type CompositionDeviceInput,
  type ResourceCompositionBucketKey,
  RESOURCE_COMPOSITION_BUCKET_KEYS,
} from './resource-composition-aggregation'

export type DeviceSnapshotPoint = {
  at: Date
  device: CompositionDeviceInput
}

export type EntityCardHoursBucketAcc = {
  cardHours: number
  machineHours: number
  byCardType: Map<string, { cardHours: number; machineHours: number }>
}

export function emptyEntityCardHoursBuckets(): Record<
  ResourceCompositionBucketKey,
  EntityCardHoursBucketAcc
> {
  const out = {} as Record<ResourceCompositionBucketKey, EntityCardHoursBucketAcc>
  for (const key of RESOURCE_COMPOSITION_BUCKET_KEYS) {
    out[key] = { cardHours: 0, machineHours: 0, byCardType: new Map() }
  }
  return out
}

/** 单设备在桶末态下的积分增量 */
export function integrateDeviceAtBucketEnd(input: {
  device: CompositionDeviceInput
  bucketKey: ResourceCompositionBucketKey
  durationHours: number
  buckets: Record<ResourceCompositionBucketKey, EntityCardHoursBucketAcc>
}): void {
  const { device, bucketKey, durationHours, buckets } = input
  if (durationHours <= 0) return

  const gpu = metricGpuCount(device)
  const cardHours = gpu * durationHours
  const acc = buckets[bucketKey]
  acc.cardHours += cardHours
  acc.machineHours += durationHours

  if (gpu > 0 && device.cardTypeName) {
    const prev = acc.byCardType.get(device.cardTypeName) ?? {
      cardHours: 0,
      machineHours: 0,
    }
    acc.byCardType.set(device.cardTypeName, {
      cardHours: prev.cardHours + cardHours,
      machineHours: prev.machineHours + durationHours,
    })
  }
}

function resolveDeviceStateAt(
  deviceId: string,
  at: Date,
  timeline: DeviceSnapshotPoint[] | undefined,
  fallback: CompositionDeviceInput | undefined,
): CompositionDeviceInput | null {
  if (timeline && timeline.length > 0) {
    let chosen: DeviceSnapshotPoint | undefined
    const t = at.getTime()
    for (const point of timeline) {
      if (point.at.getTime() <= t) chosen = point
      else break
    }
    if (chosen) return chosen.device
  }
  return fallback ?? null
}

/**
 * 按 Period 桶对实体扇区积分：每桶取末态 classify，h_eff = |τ|（状态停留时长）。
 * 无快照行的设备使用 fallbackDevices 恒定末态（approximate）。
 */
export function aggregateCompositionCardHoursFromSnapshots(input: {
  buckets: PeriodBucket[]
  periodStart: Date
  periodEnd: Date
  snapshotsByDevice: Map<string, DeviceSnapshotPoint[]>
  fallbackDevices: CompositionDeviceInput[]
  internalHoldDeviceIds: ReadonlySet<string>
  /** 若指定，所有桶按该时刻末态积分（用于期初基线对比） */
  stateAnchorAt?: Date
}): Record<ResourceCompositionBucketKey, EntityCardHoursBucketAcc> {
  const totals = emptyEntityCardHoursBuckets()

  const fallbackById = new Map(input.fallbackDevices.map((d) => [d.id, d]))
  const deviceIds = new Set<string>([
    ...input.snapshotsByDevice.keys(),
    ...input.fallbackDevices.map((d) => d.id),
  ])

  for (const bucket of input.buckets) {
    const durationHours = effectiveBucketDurationHours(
      bucket,
      input.periodStart,
      input.periodEnd,
    )
    if (durationHours <= 0) continue

    const at = input.stateAnchorAt ?? bucket.end

    for (const deviceId of deviceIds) {
      const device = resolveDeviceStateAt(
        deviceId,
        at,
        input.snapshotsByDevice.get(deviceId),
        fallbackById.get(deviceId),
      )
      if (!device || isDeviceExcludedFromComposition(device)) continue

      const bucketKey = classifyDeviceExclusiveBucket(device, input.internalHoldDeviceIds)
      integrateDeviceAtBucketEnd({
        device,
        bucketKey,
        durationHours,
        buckets: totals,
      })
    }
  }

  return totals
}
