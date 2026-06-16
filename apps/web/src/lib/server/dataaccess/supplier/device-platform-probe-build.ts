import {
  deriveConsistencyFlag,
  deriveProbeStatus,
  deriveSuggestedAction,
  deriveOrphanSuggestedAction,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-consistency'
import type { StagedK8sRow, StagedProxyRow } from '@/lib/server/integrations/suanli-device-probe-api'
import type { ConsistencyFlag, ProxyRentStatus } from '@/lib/supplier/device-platform-probe-utils'
import type { devicePlatformProbeSnapshot } from '@workspace/db/schema'
import {
  endpointReviewMatch,
  groupByKey,
  matchBareMetalRow,
  pickUniqueOrAmbiguous,
  type StagedBareMetalRow,
  type StagedInventoryRow,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-staging'

export type ProbeSnapshotInsert = typeof devicePlatformProbeSnapshot.$inferInsert

export type IdcDataCenterRef = {
  id: string
  supplierId: string
  name: string
}

export type ClaimedStagingKeys = {
  proxy: Set<string>
  k8s: Set<string>
  bareMetal: Set<string>
}

function newId() {
  return crypto.randomUUID()
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

export function proxyClaimKey(row: StagedProxyRow): string {
  return `proxy::${row.idcKey}::${row.ipHost}::${row.platformDeviceId ?? ''}`
}

export function k8sClaimKey(row: StagedK8sRow): string {
  return `k8s::${row.regionKey}::${row.ipHost}::${row.platformNodeId ?? ''}`
}

export function bareMetalClaimKey(row: StagedBareMetalRow): string {
  return `bm::${row.bareMetalOrderDeviceId}`
}

export function orphanMergeKey(ipHost: string, idcKey: string | null | undefined): string {
  return `${ipHost}::${idcKey?.trim() || '__none__'}`
}

function emptyClaimed(): ClaimedStagingKeys {
  return { proxy: new Set(), k8s: new Set(), bareMetal: new Set() }
}

export function buildCrmSnapshots(params: {
  jobRunId: string
  snapshotHour: Date
  inventory: StagedInventoryRow[]
  proxyRows: StagedProxyRow[]
  k8sRows: StagedK8sRow[]
  bareMetalRows: StagedBareMetalRow[]
  bareMetalStale: boolean
}): { snapshots: ProbeSnapshotInsert[]; claimed: ClaimedStagingKeys } {
  const claimed = emptyClaimed()
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

  const snapshots = params.inventory.map((inv) => {
    let proxyAmbiguous = false
    let k8sAmbiguous = false
    let bareMetalAmbiguous = false
    let proxyMatched = false
    let k8sMatched = false
    let bareMetalMatched = false
    let proxyRow = null as StagedProxyRow | null
    let k8sRow = null as StagedK8sRow | null
    let bareMetalRow = null as StagedBareMetalRow | null
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

      if (proxyRow && !proxyAmbiguous) claimed.proxy.add(proxyClaimKey(proxyRow))
      if (k8sRow && !k8sAmbiguous) claimed.k8s.add(k8sClaimKey(k8sRow))
      if (bareMetalRow && !bareMetalAmbiguous) claimed.bareMetal.add(bareMetalClaimKey(bareMetalRow))
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
      recordKind: 'crm_inventory',
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
      presenceCrm: true,
      presenceProxy: proxyMatched,
      presenceK8s: k8sMatched,
      presenceBareMetal: bareMetalMatched,
      orphanMergeKey: null,
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
    } satisfies ProbeSnapshotInsert
  })

  return { snapshots, claimed }
}

type OrphanAccumulator = {
  mergeKey: string
  ipHost: string
  idcKey: string | null
  internalIp: string | null
  dataCenterName: string | null
  dataCenterId: string | null
  supplierId: string | null
  sn: string
  proxyRow: StagedProxyRow | null
  k8sRow: StagedK8sRow | null
  bareMetalRow: StagedBareMetalRow | null
  matchFlags: Record<string, unknown>
}

function resolveIdcContext(
  idcKey: string | null | undefined,
  idcMap: Map<string, IdcDataCenterRef>,
): Pick<OrphanAccumulator, 'dataCenterId' | 'dataCenterName' | 'supplierId'> {
  if (!idcKey) return { dataCenterId: null, dataCenterName: null, supplierId: null }
  const dc = idcMap.get(idcKey)
  if (!dc) return { dataCenterId: null, dataCenterName: null, supplierId: null }
  return { dataCenterId: dc.id, dataCenterName: dc.name, supplierId: dc.supplierId }
}

function getOrCreateOrphan(
  map: Map<string, OrphanAccumulator>,
  ipHost: string,
  idcKey: string | null,
  idcMap: Map<string, IdcDataCenterRef>,
  snFallback: string,
): OrphanAccumulator {
  const mergeKey = orphanMergeKey(ipHost, idcKey)
  let acc = map.get(mergeKey)
  if (!acc) {
    const ctx = resolveIdcContext(idcKey, idcMap)
    acc = {
      mergeKey,
      ipHost,
      idcKey,
      internalIp: null,
      dataCenterName: ctx.dataCenterName,
      dataCenterId: ctx.dataCenterId,
      supplierId: ctx.supplierId,
      sn: snFallback,
      proxyRow: null,
      k8sRow: null,
      bareMetalRow: null,
      matchFlags: {},
    }
    map.set(mergeKey, acc)
  }
  return acc
}

function payloadIdcName(payload: Record<string, unknown>): string | null {
  const value = payload.idc_name
  if (value == null || value === '') return null
  return String(value)
}

export function buildOrphanSnapshots(params: {
  jobRunId: string
  snapshotHour: Date
  proxyRows: StagedProxyRow[]
  k8sRows: StagedK8sRow[]
  bareMetalRows: StagedBareMetalRow[]
  claimed: ClaimedStagingKeys
  idcMap: Map<string, IdcDataCenterRef>
  bareMetalStale: boolean
}): ProbeSnapshotInsert[] {
  const orphans = new Map<string, OrphanAccumulator>()

  for (const row of params.proxyRows) {
    if (params.claimed.proxy.has(proxyClaimKey(row))) continue
    const acc = getOrCreateOrphan(
      orphans,
      row.ipHost,
      row.idcKey,
      params.idcMap,
      `ORPHAN-${row.ipHost}`,
    )
    acc.proxyRow = row
    acc.internalIp = acc.internalIp ?? row.rawInnerIp ?? row.ipHost
    if (row.idcKey) {
      const ctx = resolveIdcContext(row.idcKey, params.idcMap)
      acc.dataCenterId = acc.dataCenterId ?? ctx.dataCenterId
      acc.dataCenterName = acc.dataCenterName ?? ctx.dataCenterName ?? payloadIdcName(row.payload)
      acc.supplierId = acc.supplierId ?? ctx.supplierId
    }
  }

  for (const row of params.k8sRows) {
    if (params.claimed.k8s.has(k8sClaimKey(row))) continue
    const acc = getOrCreateOrphan(
      orphans,
      row.ipHost,
      null,
      params.idcMap,
      row.deviceName?.trim() || `ORPHAN-${row.ipHost}`,
    )
    acc.k8sRow = row
    acc.internalIp = acc.internalIp ?? row.rawInnerIp ?? row.ipHost
    if (row.deviceName?.trim()) acc.sn = row.deviceName.trim()
  }

  for (const row of params.bareMetalRows) {
    if (!row.ipHost || params.claimed.bareMetal.has(bareMetalClaimKey(row))) continue
    const acc = getOrCreateOrphan(
      orphans,
      row.ipHost,
      row.idcKey,
      params.idcMap,
      row.orderNo?.trim() ? `ORPHAN-${row.orderNo}` : `ORPHAN-${row.ipHost}`,
    )
    acc.bareMetalRow = row
    acc.internalIp = acc.internalIp ?? row.ipHost
    if (row.idcKey) {
      const ctx = resolveIdcContext(row.idcKey, params.idcMap)
      acc.dataCenterId = acc.dataCenterId ?? ctx.dataCenterId
      acc.dataCenterName = acc.dataCenterName ?? ctx.dataCenterName ?? payloadIdcName(row.payload)
      acc.supplierId = acc.supplierId ?? ctx.supplierId
    }
  }

  return [...orphans.values()]
    .filter((acc) => acc.proxyRow || acc.k8sRow || acc.bareMetalRow)
    .map((acc) => {
      const proxyMatched = Boolean(acc.proxyRow)
      const k8sMatched = Boolean(acc.k8sRow)
      const bareMetalMatched = Boolean(acc.bareMetalRow)
      const matchFlags = { ...acc.matchFlags }
      if (params.bareMetalStale) matchFlags.bare_metal_stale = true

      const probeStatus = deriveProbeStatus({
        hasInternalIp: Boolean(acc.internalIp?.trim() || acc.ipHost),
        hasDcMapping: true,
        proxyMatched,
        k8sMatched,
        bareMetalMatched,
        ambiguous: false,
      })

      const proxyRow = acc.proxyRow
      const k8sRow = acc.k8sRow
      const bareMetalRow = acc.bareMetalRow

      return {
        id: newId(),
        jobRunId: params.jobRunId,
        recordKind: 'platform_orphan',
        supplierDeviceId: null,
        supplierId: acc.supplierId,
        dataCenterId: acc.dataCenterId,
        sn: acc.sn,
        internalIp: acc.internalIp ?? acc.ipHost,
        dataCenterName: acc.dataCenterName,
        opsStatus: null,
        lifecycleStatus: null,
        snapshotHour: params.snapshotHour,
        probeStatus,
        consistencyFlag: 'missing_crm' satisfies ConsistencyFlag,
        presenceCrm: false,
        presenceProxy: proxyMatched,
        presenceK8s: k8sMatched,
        presenceBareMetal: bareMetalMatched,
        orphanMergeKey: acc.mergeKey,
        proxyMatched,
        proxyRentStatus: proxyRow ? toProxyRentStatus(proxyRow.rentStatus) : null,
        proxyIsContainerInstance: proxyRow?.isContainerInstance ?? null,
        proxyPlatformDeviceId: proxyRow?.platformDeviceId ?? null,
        k8sMatched,
        k8sDeviceName: k8sRow?.deviceName ?? null,
        k8sRegion: k8sRow?.regionKey ?? null,
        bareMetalMatched,
        bareMetalOrderNo: bareMetalRow?.orderNo ?? null,
        bareMetalOrderStatus: bareMetalRow?.orderStatus ?? null,
        suggestedAction: deriveOrphanSuggestedAction(),
        matchFlags,
        proxyPayload: proxyRow?.payload ?? null,
        k8sPayload: k8sRow?.payload ?? null,
        bareMetalPayload: bareMetalRow?.payload ?? null,
      } satisfies ProbeSnapshotInsert
    })
}
