import { db } from '@/lib/db'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import {
  deriveConsistencyFlag,
  deriveProbeStatus,
  deriveSuggestedAction,
  isNeedsActionConsistency,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-consistency'
import {
  DEVICE_PLATFORM_PROBE_LOCK_KEY,
  getDevicePlatformProbeBareMetalStaleHours,
  getDevicePlatformProbeStagingRetentionHours,
  getDevicePlatformProbeSnapshotRetentionDays,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-config'
import { getSnapshotHourAsiaShanghai } from '@/lib/server/dataaccess/supplier/device-platform-probe-keys'
import {
  cleanupExpiredSnapshots,
  cleanupOldFailedStaging,
  clearProbeStaging,
  endpointReviewMatch,
  groupByKey,
  insertStagingBareMetal,
  insertStagingInventory,
  insertStagingK8s,
  insertStagingProxy,
  loadStagingBareMetal,
  loadStagingInventory,
  matchBareMetalRow,
  pickUniqueOrAmbiguous,
  purgeExcludedDeviceSnapshots,
  type StagedInventoryRow,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-staging'
import { fetchDeviceProbeChannels } from '@/lib/server/integrations/suanli-device-probe-api'
import type { ProxyRentStatus } from '@/lib/supplier/device-platform-probe-utils'
import {
  devicePlatformProbeJobRun,
  devicePlatformProbeSnapshot,
  devicePlatformProbeState,
} from '@workspace/db/schema'
import { sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

async function tryAcquireLock(): Promise<boolean> {
  const result = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${DEVICE_PLATFORM_PROBE_LOCK_KEY}) AS acquired`,
  )
  return Boolean(result.rows[0]?.acquired)
}

async function releaseLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${DEVICE_PLATFORM_PROBE_LOCK_KEY})`)
}

async function touchProbeState(partial: {
  lastRunAt?: Date
  lastSuccessAt?: Date
  lastSnapshotHour?: Date
}) {
  const existing = await db.query.devicePlatformProbeState.findFirst({
    where: (t, { eq }) => eq(t.id, 'default'),
  })
  if (!existing) {
    await db.insert(devicePlatformProbeState).values({
      id: 'default',
      lastRunAt: partial.lastRunAt ?? null,
      lastSuccessAt: partial.lastSuccessAt ?? null,
      lastSnapshotHour: partial.lastSnapshotHour ?? null,
    })
    return
  }
  await db
    .update(devicePlatformProbeState)
    .set({
      lastRunAt: partial.lastRunAt ?? existing.lastRunAt,
      lastSuccessAt: partial.lastSuccessAt ?? existing.lastSuccessAt,
      lastSnapshotHour: partial.lastSnapshotHour ?? existing.lastSnapshotHour,
    })
    .where(sql`id = 'default'`)
}

function hasInternalIp(ip: string | null | undefined): boolean {
  return Boolean(ip?.trim())
}

function hasDcMapping(inv: StagedInventoryRow): boolean {
  return Boolean(inv.dataCenterId && inv.idcKey && inv.regionKey)
}

function toProxyRentStatus(value: string | null | undefined): ProxyRentStatus | null {
  if (value === 'Idle' || value === 'ElasticRenting') return value
  return null
}

async function isBareMetalSyncStale(): Promise<boolean> {
  const state = await db.query.bareMetalSyncState.findFirst({
    where: (t, { eq }) => eq(t.id, 'default'),
  })
  if (!state?.lastSuccessAt) return true
  const staleMs = getDevicePlatformProbeBareMetalStaleHours() * 60 * 60 * 1000
  return Date.now() - state.lastSuccessAt.getTime() > staleMs
}

type BuiltSnapshot = typeof devicePlatformProbeSnapshot.$inferInsert

function buildSnapshots(params: {
  jobRunId: string
  snapshotHour: Date
  inventory: StagedInventoryRow[]
  proxyRows: Awaited<ReturnType<typeof fetchDeviceProbeChannels>>['proxyRows']
  k8sRows: Awaited<ReturnType<typeof fetchDeviceProbeChannels>>['k8sRows']
  bareMetalRows: Awaited<ReturnType<typeof loadStagingBareMetal>>
  bareMetalStale: boolean
}): BuiltSnapshot[] {
  const proxyByKey = groupByKey(
    params.proxyRows,
    (r) => r.idcKey,
    (r) => r.ipHost,
  )
  const k8sByKey = groupByKey(
    params.k8sRows,
    (r) => r.regionKey,
    (r) => r.ipHost,
  )
  const bareMetalByBm = groupByKey(
    params.bareMetalRows,
    (r) => r.bmRegionKey,
    (r) => r.ipHost,
  )
  const bareMetalByIdc = groupByKey(
    params.bareMetalRows,
    (r) => r.idcKey,
    (r) => r.ipHost,
  )

  return params.inventory.map((inv) => {
    let proxyAmbiguous = false
    let k8sAmbiguous = false
    let bareMetalAmbiguous = false
    let proxyMatched = false
    let k8sMatched = false
    let bareMetalMatched = false
    let proxyRow = null as (typeof params.proxyRows)[number] | null
    let k8sRow = null as (typeof params.k8sRows)[number] | null
    let bareMetalRow = null as (typeof params.bareMetalRows)[number] | null
    const matchFlags: Record<string, unknown> = {}

    if (hasInternalIp(inv.internalIp) && hasDcMapping(inv)) {
      const proxyExact = pickUniqueOrAmbiguous(
        inv.idcKey && inv.ipHost ? proxyByKey.get(`${inv.idcKey}::${inv.ipHost}`) : undefined,
      )
      proxyAmbiguous = proxyExact.ambiguous
      proxyRow = proxyExact.row

      if (!proxyRow && !proxyAmbiguous && inv.idcKey) {
        const reviewed = endpointReviewMatch(
          inv.internalIp,
          inv.idcKey && inv.ipHost ? proxyByKey.get(`${inv.idcKey}::${inv.ipHost}`) : undefined,
          params.proxyRows,
          (row) => row.idcKey === inv.idcKey,
        )
        if (reviewed.row) {
          proxyRow = reviewed.row
          if (reviewed.reviewed) matchFlags.endpoint_review = true
        }
      }

      const k8sExact = pickUniqueOrAmbiguous(
        inv.regionKey && inv.ipHost ? k8sByKey.get(`${inv.regionKey}::${inv.ipHost}`) : undefined,
      )
      k8sAmbiguous = k8sExact.ambiguous
      k8sRow = k8sExact.row

      if (!k8sRow && !k8sAmbiguous && inv.regionKey) {
        const reviewed = endpointReviewMatch(
          inv.internalIp,
          inv.regionKey && inv.ipHost ? k8sByKey.get(`${inv.regionKey}::${inv.ipHost}`) : undefined,
          params.k8sRows,
          (row) => row.regionKey === inv.regionKey,
        )
        if (reviewed.row) {
          k8sRow = reviewed.row
          if (reviewed.reviewed) matchFlags.endpoint_review = true
        }
      }

      const bmHit = matchBareMetalRow(inv, bareMetalByBm, bareMetalByIdc)
      bareMetalAmbiguous = bmHit.ambiguous
      bareMetalRow = bmHit.row

      proxyMatched = Boolean(proxyRow)
      k8sMatched = Boolean(k8sRow)
      bareMetalMatched = Boolean(bareMetalRow)
    }

    if (params.bareMetalStale) matchFlags.bare_metal_stale = true

    const ambiguous = proxyAmbiguous || k8sAmbiguous || bareMetalAmbiguous
    const probeStatus = deriveProbeStatus({
      hasInternalIp: hasInternalIp(inv.internalIp),
      hasDcMapping: hasDcMapping(inv),
      proxyMatched,
      k8sMatched,
      bareMetalMatched,
      ambiguous,
    })

    const proxyRentStatus = proxyRow ? toProxyRentStatus(proxyRow.rentStatus) : null
    const consistencyFlag = deriveConsistencyFlag({
      probeStatus,
      opsStatus: inv.opsStatus,
      proxyMatched,
      proxyRentStatus,
      proxyIsContainerInstance: proxyRow?.isContainerInstance ?? null,
      k8sMatched,
      bareMetalMatched,
    })

    const suggestedAction = deriveSuggestedAction({ probeStatus, consistencyFlag })

    return {
      id: newId(),
      jobRunId: params.jobRunId,
      supplierDeviceId: inv.supplierDeviceId,
      supplierId: inv.supplierId,
      dataCenterId: inv.dataCenterId,
      sn: inv.sn,
      internalIp: inv.internalIp,
      dataCenterName: inv.dataCenterName,
      opsStatus: inv.opsStatus,
      lifecycleStatus: inv.lifecycleStatus,
      snapshotHour: params.snapshotHour,
      probeStatus,
      consistencyFlag,
      proxyMatched,
      proxyRentStatus,
      proxyIsContainerInstance: proxyRow?.isContainerInstance ?? null,
      proxyPlatformDeviceId: proxyRow?.platformDeviceId ?? null,
      k8sMatched,
      k8sDeviceName: k8sRow?.deviceName ?? null,
      k8sRegion: k8sRow?.regionKey ?? null,
      bareMetalMatched,
      bareMetalOrderNo: bareMetalRow?.orderNo ?? null,
      bareMetalOrderStatus: bareMetalRow?.orderStatus ?? null,
      suggestedAction,
      matchFlags,
      proxyPayload: proxyRow?.payload ?? null,
      k8sPayload: k8sRow?.payload ?? null,
      bareMetalPayload: bareMetalRow?.payload ?? null,
    }
  })
}

async function upsertSnapshots(rows: BuiltSnapshot[]): Promise<void> {
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await db
      .insert(devicePlatformProbeSnapshot)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          devicePlatformProbeSnapshot.supplierDeviceId,
          devicePlatformProbeSnapshot.snapshotHour,
        ],
        set: {
          jobRunId: sql`excluded.job_run_id`,
          probeStatus: sql`excluded.probe_status`,
          consistencyFlag: sql`excluded.consistency_flag`,
          proxyMatched: sql`excluded.proxy_matched`,
          proxyRentStatus: sql`excluded.proxy_rent_status`,
          proxyIsContainerInstance: sql`excluded.proxy_is_container_instance`,
          proxyPlatformDeviceId: sql`excluded.proxy_platform_device_id`,
          k8sMatched: sql`excluded.k8s_matched`,
          k8sDeviceName: sql`excluded.k8s_device_name`,
          k8sRegion: sql`excluded.k8s_region`,
          bareMetalMatched: sql`excluded.bare_metal_matched`,
          bareMetalOrderNo: sql`excluded.bare_metal_order_no`,
          bareMetalOrderStatus: sql`excluded.bare_metal_order_status`,
          suggestedAction: sql`excluded.suggested_action`,
          matchFlags: sql`excluded.match_flags`,
          proxyPayload: sql`excluded.proxy_payload`,
          k8sPayload: sql`excluded.k8s_payload`,
          bareMetalPayload: sql`excluded.bare_metal_payload`,
          opsStatus: sql`excluded.ops_status`,
          lifecycleStatus: sql`excluded.lifecycle_status`,
          internalIp: sql`excluded.internal_ip`,
          dataCenterName: sql`excluded.data_center_name`,
          dataCenterId: sql`excluded.data_center_id`,
        },
      })
  }
}

export async function runScheduledDevicePlatformProbe(input: {
  trigger: 'scheduled' | 'manual'
}): Promise<{ jobRunId: string; status: string }> {
  const traceId = crypto.randomUUID().slice(0, 8)
  const acquired = await tryAcquireLock()
  if (!acquired) {
    crmWarn('device-platform-probe', 'skipped (lock held)', { traceId })
    return { jobRunId: '', status: 'skipped' }
  }

  const jobRunId = newId()
  const startedAt = new Date()
  const snapshotHour = getSnapshotHourAsiaShanghai(startedAt)
  await touchProbeState({ lastRunAt: startedAt })

  await db.insert(devicePlatformProbeJobRun).values({
    id: jobRunId,
    trigger: input.trigger,
    snapshotHour,
    startedAt,
    status: 'running',
  })

  const errorParts: string[] = []
  let inventoryCount = 0
  let proxyFetched = 0
  let k8sFetched = 0
  let bareMetalHit = 0

  try {
    await clearProbeStaging(jobRunId)
    inventoryCount = await insertStagingInventory(jobRunId)
    crmLog('device-platform-probe', 'inventory staged', { traceId, inventoryCount })

    const { proxyRows, k8sRows, proxyError, k8sError } = await fetchDeviceProbeChannels(traceId)
    if (proxyError) errorParts.push(`proxy: ${proxyError}`)
    if (k8sError) errorParts.push(`k8s: ${k8sError}`)

    if (proxyError && k8sError) {
      throw new Error('device_info 与 node_device 均拉取失败')
    }

    await insertStagingProxy(jobRunId, proxyRows)
    await insertStagingK8s(jobRunId, k8sRows)
    proxyFetched = proxyRows.length
    k8sFetched = k8sRows.length

    bareMetalHit = await insertStagingBareMetal(jobRunId)
    const bareMetalStale = await isBareMetalSyncStale()

    const inventory = await loadStagingInventory(jobRunId)
    const bareMetalRows = await loadStagingBareMetal(jobRunId)
    const snapshots = buildSnapshots({
      jobRunId,
      snapshotHour,
      inventory,
      proxyRows,
      k8sRows,
      bareMetalRows,
      bareMetalStale,
    })

    await upsertSnapshots(snapshots)
    await purgeExcludedDeviceSnapshots(snapshotHour)
    await clearProbeStaging(jobRunId)

    const matchedProxyCount = snapshots.filter((s) => s.proxyMatched).length
    const matchedK8sCount = snapshots.filter((s) => s.k8sMatched).length
    const matchedBareMetalCount = snapshots.filter((s) => s.bareMetalMatched).length
    const ambiguousCount = snapshots.filter((s) => s.probeStatus === 'ambiguous').length
    const missingPlatformCount = snapshots.filter((s) =>
      isNeedsActionConsistency(s.consistencyFlag as never),
    ).length

    const finishedAt = new Date()
    const status = proxyError || k8sError ? 'partial' : 'success'

    await db
      .update(devicePlatformProbeJobRun)
      .set({
        finishedAt,
        status,
        inventoryDeviceCount: inventoryCount,
        proxyFetchedCount: proxyFetched,
        k8sFetchedCount: k8sFetched,
        bareMetalHitCount: bareMetalHit,
        matchedProxyCount,
        matchedK8sCount,
        matchedBareMetalCount,
        ambiguousCount,
        missingPlatformCount,
        errorSummary: errorParts.length > 0 ? errorParts.join('; ') : null,
      })
      .where(sql`id = ${jobRunId}`)

    await touchProbeState({
      lastSuccessAt: status === 'success' || status === 'partial' ? finishedAt : undefined,
      lastSnapshotHour: snapshotHour,
    })

    crmLog('device-platform-probe', 'completed', {
      traceId,
      jobRunId,
      status,
      inventoryCount,
      snapshots: snapshots.length,
    })

    return { jobRunId, status }
  } catch (error) {
    crmError('device-platform-probe', 'job failed', error, { traceId, jobRunId })
    await db
      .update(devicePlatformProbeJobRun)
      .set({
        finishedAt: new Date(),
        status: 'failed',
        inventoryDeviceCount: inventoryCount,
        proxyFetchedCount: proxyFetched,
        k8sFetchedCount: k8sFetched,
        bareMetalHitCount: bareMetalHit,
        errorSummary:
          errorParts.length > 0
            ? `${errorParts.join('; ')}; ${error instanceof Error ? error.message : 'unknown'}`
            : error instanceof Error
              ? error.message
              : 'unknown',
      })
      .where(sql`id = ${jobRunId}`)
    return { jobRunId, status: 'failed' }
  } finally {
    await releaseLock()
    await cleanupOldFailedStaging(getDevicePlatformProbeStagingRetentionHours())
  }
}

export async function runDevicePlatformProbeSnapshotCleanup(): Promise<{ deletedCount: number }> {
  const deletedCount = await cleanupExpiredSnapshots(getDevicePlatformProbeSnapshotRetentionDays())
  crmLog('device-platform-probe', 'snapshot cleanup', { deletedCount })
  return { deletedCount }
}
