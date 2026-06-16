import { db } from '@/lib/db'
import { crmError, crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import {
  buildCrmSnapshots,
  buildOrphanSnapshots,
  type ProbeSnapshotInsert,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-build'
import { isNeedsActionConsistency } from '@/lib/server/dataaccess/supplier/device-platform-probe-consistency'
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
  deleteOrphanSnapshotsForHour,
  insertStagingBareMetal,
  insertStagingInventory,
  insertStagingK8s,
  insertStagingProxy,
  loadIdcKeyDataCenterMap,
  loadStagingBareMetal,
  loadStagingInventory,
  purgeExcludedDeviceSnapshots,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-staging'
import { fetchDeviceProbeChannels } from '@/lib/server/integrations/suanli-device-probe-api'
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

async function isBareMetalSyncStale(): Promise<boolean> {
  const state = await db.query.bareMetalSyncState.findFirst({
    where: (t, { eq }) => eq(t.id, 'default'),
  })
  if (!state?.lastSuccessAt) return true
  const staleMs = getDevicePlatformProbeBareMetalStaleHours() * 60 * 60 * 1000
  return Date.now() - state.lastSuccessAt.getTime() > staleMs
}

async function upsertCrmSnapshots(rows: ProbeSnapshotInsert[]): Promise<void> {
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await db
      .insert(devicePlatformProbeSnapshot)
      .values(chunk)
      .onConflictDoUpdate({
        target: [devicePlatformProbeSnapshot.supplierDeviceId, devicePlatformProbeSnapshot.snapshotHour],
        targetWhere: sql`record_kind = 'crm_inventory' AND supplier_device_id IS NOT NULL`,
        set: {
          jobRunId: sql`excluded.job_run_id`,
          recordKind: sql`excluded.record_kind`,
          probeStatus: sql`excluded.probe_status`,
          consistencyFlag: sql`excluded.consistency_flag`,
          presenceCrm: sql`excluded.presence_crm`,
          presenceProxy: sql`excluded.presence_proxy`,
          presenceK8s: sql`excluded.presence_k8s`,
          presenceBareMetal: sql`excluded.presence_bare_metal`,
          orphanMergeKey: sql`excluded.orphan_merge_key`,
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
          supplierId: sql`excluded.supplier_id`,
        },
      })
  }
}

async function insertOrphanSnapshots(rows: ProbeSnapshotInsert[]): Promise<void> {
  if (rows.length === 0) return
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(devicePlatformProbeSnapshot).values(rows.slice(i, i + chunkSize))
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
    const idcMap = await loadIdcKeyDataCenterMap()

    const { snapshots: crmSnapshots, claimed } = buildCrmSnapshots({
      jobRunId,
      snapshotHour,
      inventory,
      proxyRows,
      k8sRows,
      bareMetalRows,
      bareMetalStale,
    })

    await deleteOrphanSnapshotsForHour(snapshotHour)
    await upsertCrmSnapshots(crmSnapshots)

    const orphanSnapshots = buildOrphanSnapshots({
      jobRunId,
      snapshotHour,
      proxyRows,
      k8sRows,
      bareMetalRows,
      claimed,
      idcMap,
      bareMetalStale,
    })
    await insertOrphanSnapshots(orphanSnapshots)

    await purgeExcludedDeviceSnapshots(snapshotHour)
    await clearProbeStaging(jobRunId)

    const allSnapshots = [...crmSnapshots, ...orphanSnapshots]
    const matchedProxyCount = allSnapshots.filter((s) => s.proxyMatched).length
    const matchedK8sCount = allSnapshots.filter((s) => s.k8sMatched).length
    const matchedBareMetalCount = allSnapshots.filter((s) => s.bareMetalMatched).length
    const ambiguousCount = crmSnapshots.filter((s) => s.probeStatus === 'ambiguous').length
    const missingPlatformCount = crmSnapshots.filter((s) =>
      isNeedsActionConsistency(s.consistencyFlag as never),
    ).length
    const orphanCount = orphanSnapshots.length
    const missingCrmCount = orphanSnapshots.filter((s) => s.consistencyFlag === 'missing_crm').length

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
        orphanCount,
        missingCrmCount,
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
      crmSnapshots: crmSnapshots.length,
      orphanSnapshots: orphanSnapshots.length,
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
    try {
      await cleanupOldFailedStaging(getDevicePlatformProbeStagingRetentionHours())
    } catch (error) {
      crmWarn('device-platform-probe', 'staging cleanup failed', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export async function runDevicePlatformProbeSnapshotCleanup(): Promise<{ deletedCount: number }> {
  const deletedCount = await cleanupExpiredSnapshots(getDevicePlatformProbeSnapshotRetentionDays())
  crmLog('device-platform-probe', 'snapshot cleanup', { deletedCount })
  return { deletedCount }
}
