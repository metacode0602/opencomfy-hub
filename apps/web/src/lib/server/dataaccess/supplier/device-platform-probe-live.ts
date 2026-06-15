import { db } from '@/lib/db'
import { crmLog } from '@/lib/server/dataaccess/crm/logger'
import {
  deriveConsistencyFlag,
  deriveProbeStatus,
  deriveSuggestedAction,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-consistency'
import { getDevicePlatformProbeBareMetalStaleHours } from '@/lib/server/dataaccess/supplier/device-platform-probe-config'
import {
  endpointReviewMatch,
  groupByKey,
  matchBareMetalRow,
  pickUniqueOrAmbiguous,
  type StagedBareMetalRow,
  type StagedInventoryRow,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-staging'
import {
  fetchDeviceProbeChannelsScoped,
  type DeviceProbeFetchScope,
  type StagedK8sRow,
  type StagedProxyRow,
} from '@/lib/server/integrations/suanli-device-probe-api'
import {
  buildProbeCompareRows,
  type DevicePlatformProbeDetail,
  type ProxyRentStatus,
} from '@/lib/supplier/device-platform-probe-utils'
import type { DevicePlatformProbeLiveResultDto } from '@/lib/types/device-platform-probe-api'
import { sql } from 'drizzle-orm'

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

function payloadString(payload: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = payload?.[key]
  if (value == null || value === '') return null
  return String(value)
}

function payloadNumber(payload: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = payload?.[key]
  return typeof value === 'number' ? value : null
}

async function loadInventoryForDevice(supplierDeviceId: string): Promise<StagedInventoryRow | null> {
  const result = await db.execute<{
    supplier_device_id: string
    supplier_id: string
    data_center_id: string | null
    internal_ip: string | null
    ip_host: string | null
    idc_key: string | null
    region_key: string | null
    bm_region_key: string | null
    ops_status: string
    lifecycle_status: string
    in_maintenance: boolean
    sn: string
    data_center_name: string | null
    external_ip: string | null
    idc_code: string | null
    gpu_card_type_name: string | null
    gpu_count: number | null
    container_instance_region: string | null
    bare_metal_region: string | null
  }>(sql`
    SELECT
      sd.id AS supplier_device_id,
      sd.supplier_id,
      sd.data_center_id,
      sd.internal_ip,
      normalize_ip_host(sd.internal_ip) AS ip_host,
      normalize_idc_key(dc.name) AS idc_key,
      normalize_region_key(dc.container_instance_region) AS region_key,
      normalize_region_key(dc.bare_metal_region) AS bm_region_key,
      sd.ops_status,
      sd.lifecycle_status,
      sd.in_maintenance,
      sd.sn,
      dc.name AS data_center_name,
      sd.external_ip,
      sd.idc_code,
      gct.name AS gpu_card_type_name,
      sd.gpu_count,
      dc.container_instance_region,
      dc.bare_metal_region
    FROM supplier_device sd
    LEFT JOIN data_center dc ON dc.id = sd.data_center_id
    LEFT JOIN gpu_card_type gct ON gct.id = sd.gpu_card_type_id
    WHERE sd.id = ${supplierDeviceId}
    LIMIT 1
  `)

  const row = result.rows[0]
  if (!row) return null

  return {
    supplierDeviceId: row.supplier_device_id,
    supplierId: row.supplier_id,
    dataCenterId: row.data_center_id,
    internalIp: row.internal_ip,
    ipHost: row.ip_host,
    idcKey: row.idc_key,
    regionKey: row.region_key,
    bmRegionKey: row.bm_region_key,
    opsStatus: row.ops_status,
    lifecycleStatus: row.lifecycle_status,
    inMaintenance: row.in_maintenance,
    sn: row.sn,
    dataCenterName: row.data_center_name,
    externalIp: row.external_ip,
    idcCode: row.idc_code,
    gpuCardTypeName: row.gpu_card_type_name,
    gpuCount: row.gpu_count,
    containerInstanceRegion: row.container_instance_region,
    bareMetalRegion: row.bare_metal_region,
  }
}

async function loadBareMetalForProbeScoped(dataCenterId: string): Promise<StagedBareMetalRow[]> {
  const result = await db.execute<{
    bare_metal_order_id: string
    bare_metal_order_device_id: string
    bm_region_key: string | null
    idc_key: string | null
    ip_host: string | null
    order_no: string | null
    order_status: string | null
    tenant_name: string | null
    rent_ends_at: Date | null
    payload: Record<string, unknown> | null
  }>(sql`
    SELECT
      bo.id AS bare_metal_order_id,
      bod.id AS bare_metal_order_device_id,
      normalize_region_key(dc.bare_metal_region) AS bm_region_key,
      normalize_idc_key(COALESCE(dc.name, bo.idc_name)) AS idc_key,
      normalize_ip_host(bod.internal_ip) AS ip_host,
      bo.order_no,
      bo.status AS order_status,
      bt.name AS tenant_name,
      bo.rent_ends_at,
      jsonb_build_object(
        'platform_order_id', bo.platform_order_id,
        'idc_name', bo.idc_name,
        'gpu_model_text', bod.device_model_text,
        'tenant_name', bt.name,
        'rent_ends_at', bo.rent_ends_at
      ) AS payload
    FROM bare_metal_order_device bod
    INNER JOIN bare_metal_order bo ON bo.id = bod.bare_metal_order_id
    LEFT JOIN data_center dc ON dc.id = bo.data_center_id
    LEFT JOIN tenant bt ON bt.id = bo.tenant_id
    WHERE bo.status IN ('pending', 'paid', 'provisioning', 'active')
      AND (bod.allocation_status IS NULL OR bod.allocation_status <> 'released')
      AND bod.internal_ip IS NOT NULL
      AND btrim(bod.internal_ip) <> ''
      AND bo.data_center_id = ${dataCenterId}
  `)

  return result.rows.map((row) => ({
    bareMetalOrderId: row.bare_metal_order_id,
    bareMetalOrderDeviceId: row.bare_metal_order_device_id,
    bmRegionKey: row.bm_region_key,
    idcKey: row.idc_key,
    ipHost: row.ip_host,
    orderNo: row.order_no,
    orderStatus: row.order_status,
    tenantName: row.tenant_name,
    rentEndsAt: row.rent_ends_at,
    payload: row.payload ?? {},
  }))
}

function resolveLiveProbeFetchScope(inv: StagedInventoryRow): DeviceProbeFetchScope {
  if (!inv.dataCenterId) {
    throw new Error('设备未关联机房，无法按机房范围拉取平台数据')
  }
  if (!inv.idcKey || !inv.regionKey) {
    throw new Error('机房未配置完整（需机房名称与容器 region），无法按机房范围拉取平台数据')
  }
  if (!inv.dataCenterName?.trim()) {
    throw new Error('机房名称缺失，无法按 idc_name 拉取接入端数据')
  }
  if (!inv.containerInstanceRegion?.trim()) {
    throw new Error('机房未配置容器实例 region，无法按 region 拉取 K8s 数据')
  }

  return {
    idcKey: inv.idcKey,
    regionKey: inv.regionKey,
    idcName: inv.dataCenterName,
    containerInstanceRegion: inv.containerInstanceRegion,
  }
}

async function isBareMetalSyncStale(): Promise<boolean> {
  const state = await db.query.bareMetalSyncState.findFirst({
    where: (t, { eq }) => eq(t.id, 'default'),
  })
  if (!state?.lastSuccessAt) return true
  const staleMs = getDevicePlatformProbeBareMetalStaleHours() * 60 * 60 * 1000
  return Date.now() - state.lastSuccessAt.getTime() > staleMs
}

function matchDeviceProbe(input: {
  inv: StagedInventoryRow
  proxyRows: StagedProxyRow[]
  k8sRows: StagedK8sRow[]
  bareMetalRows: StagedBareMetalRow[]
  bareMetalStale: boolean
}) {
  const { inv, proxyRows, k8sRows, bareMetalRows, bareMetalStale } = input
  const proxyByKey = groupByKey(proxyRows, (r) => r.idcKey, (r) => r.ipHost)
  const k8sByKey = groupByKey(k8sRows, (r) => r.regionKey, (r) => r.ipHost)
  const bareMetalByBm = groupByKey(bareMetalRows, (r) => r.bmRegionKey, (r) => r.ipHost)
  const bareMetalByIdc = groupByKey(bareMetalRows, (r) => r.idcKey, (r) => r.ipHost)

  let proxyAmbiguous = false
  let k8sAmbiguous = false
  let bareMetalAmbiguous = false
  let proxyMatched = false
  let k8sMatched = false
  let bareMetalMatched = false
  let proxyRow = null as (typeof proxyRows)[number] | null
  let k8sRow = null as (typeof k8sRows)[number] | null
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
        proxyRows,
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
        k8sRows,
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

  if (bareMetalStale) matchFlags.bare_metal_stale = true

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
    probeStatus,
    consistencyFlag,
    proxyMatched,
    proxyRentStatus,
    proxyIsContainerInstance: proxyRow?.isContainerInstance ?? null,
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
    proxyPlatformDeviceId: proxyRow?.platformDeviceId ?? null,
  }
}

function buildLiveDetail(
  probeId: string,
  inv: StagedInventoryRow,
  match: ReturnType<typeof matchDeviceProbe>,
  probedAt: string,
): DevicePlatformProbeDetail {
  const proxyPayload = (match.proxyPayload ?? {}) as Record<string, unknown>
  const k8sPayload = (match.k8sPayload ?? {}) as Record<string, unknown>
  const bareMetalPayload = (match.bareMetalPayload ?? {}) as Record<string, unknown>

  const crm = {
    opsStatus: inv.opsStatus,
    lifecycleStatus: inv.lifecycleStatus,
    inMaintenance: inv.inMaintenance,
    internalIp: inv.internalIp,
    externalIp: inv.externalIp,
    dataCenterName: inv.dataCenterName,
    containerInstanceRegion: inv.containerInstanceRegion,
    bareMetalRegion: inv.bareMetalRegion,
    idcCode: inv.idcCode,
    gpuCardTypeName: inv.gpuCardTypeName,
    gpuCount: inv.gpuCount,
  }

  const deviceInfo = {
    matched: match.proxyMatched,
    platformDeviceId: match.proxyPlatformDeviceId,
    name: payloadString(proxyPayload, 'name'),
    idcName: payloadString(proxyPayload, 'idc_name') ?? inv.dataCenterName,
    innerIp: payloadString(proxyPayload, 'inner_ip') ?? inv.internalIp,
    pubIp: payloadString(proxyPayload, 'pub_ip'),
    rentStatus: match.proxyRentStatus,
    isContainerInstance: match.proxyIsContainerInstance,
    onlineStatus: payloadString(proxyPayload, 'online_status'),
    shelfStatus: payloadString(proxyPayload, 'shelf_status'),
    listingMode: payloadString(proxyPayload, 'listing_mode'),
    gpuModel: payloadString(proxyPayload, 'gpu_model'),
    gpuCount: payloadNumber(proxyPayload, 'gpu_count'),
    lastConnectionTime: payloadString(proxyPayload, 'last_connection_time'),
  }

  const nodeDevice = {
    matched: match.k8sMatched,
    platformNodeId: payloadString(k8sPayload, 'id'),
    deviceName: match.k8sDeviceName ?? payloadString(k8sPayload, 'device_name'),
    region: match.k8sRegion ?? payloadString(k8sPayload, 'region'),
    innerIp: payloadString(k8sPayload, 'inner_ip') ?? inv.internalIp,
    gpuName: payloadString(k8sPayload, 'gpu_name'),
    gpuCount: payloadNumber(k8sPayload, 'gpu_count'),
    hash: payloadString(k8sPayload, 'hash'),
    offlineDate: payloadString(k8sPayload, 'offline_date'),
  }

  const bareMetal = {
    matched: match.bareMetalMatched,
    orderNo: match.bareMetalOrderNo,
    orderStatus: match.bareMetalOrderStatus,
    platformOrderId: payloadString(bareMetalPayload, 'platform_order_id'),
    idcName: payloadString(bareMetalPayload, 'idc_name') ?? inv.dataCenterName,
    bareMetalRegion: inv.bareMetalRegion,
    internalIp: inv.internalIp,
    tenantName: payloadString(bareMetalPayload, 'tenant_name'),
    gpuModelText: payloadString(bareMetalPayload, 'gpu_model_text'),
    rentEndsAt: payloadString(bareMetalPayload, 'rent_ends_at'),
  }

  return {
    row: {
      id: probeId,
      supplierDeviceId: inv.supplierDeviceId,
      sn: inv.sn,
      internalIp: inv.internalIp,
      dataCenterName: inv.dataCenterName,
      opsStatus: inv.opsStatus,
      lifecycleStatus: inv.lifecycleStatus,
      snapshotHour: probedAt,
      probeStatus: match.probeStatus,
      consistencyFlag: match.consistencyFlag,
      proxyMatched: match.proxyMatched,
      proxyRentStatus: match.proxyRentStatus,
      proxyIsContainerInstance: match.proxyIsContainerInstance,
      k8sMatched: match.k8sMatched,
      k8sDeviceName: match.k8sDeviceName,
      bareMetalMatched: match.bareMetalMatched,
      bareMetalOrderNo: match.bareMetalOrderNo,
      suggestedAction: match.suggestedAction,
    },
    crm,
    deviceInfo,
    nodeDevice,
    bareMetal,
    changeLogs: [],
  }
}

export async function runLiveDevicePlatformProbe(probeId: string): Promise<DevicePlatformProbeLiveResultDto> {
  const traceId = crypto.randomUUID().slice(0, 8)
  const probedAt = new Date().toISOString()

  const snapshot = await db.query.devicePlatformProbeSnapshot.findFirst({
    where: (t, { eq }) => eq(t.id, probeId),
  })
  if (!snapshot) {
    throw new Error('探测记录不存在')
  }

  const inv = await loadInventoryForDevice(snapshot.supplierDeviceId)
  if (!inv) {
    throw new Error('设备主数据不存在或已删除')
  }

  const fetchScope = resolveLiveProbeFetchScope(inv)

  crmLog('device-platform-probe-live', 'start', {
    traceId,
    probeId,
    sn: inv.sn,
    fetchScope,
  })

  const [{ proxyRows, k8sRows, proxyError, k8sError }, bareMetalRows, bareMetalStale] =
    await Promise.all([
      fetchDeviceProbeChannelsScoped(traceId, fetchScope),
      loadBareMetalForProbeScoped(inv.dataCenterId!),
      isBareMetalSyncStale(),
    ])

  if (proxyError && k8sError) {
    throw new Error(`平台 API 拉取失败：${proxyError}；${k8sError}`)
  }

  const match = matchDeviceProbe({
    inv,
    proxyRows,
    k8sRows,
    bareMetalRows,
    bareMetalStale,
  })

  const detailCore = buildLiveDetail(probeId, inv, match, probedAt)

  crmLog('device-platform-probe-live', 'done', {
    traceId,
    probeId,
    probeStatus: match.probeStatus,
    consistencyFlag: match.consistencyFlag,
  })

  return {
    probedAt,
    fetchScope: {
      dataCenterName: fetchScope.idcName,
      containerInstanceRegion: fetchScope.containerInstanceRegion,
    },
    apiFetch: {
      proxyFetchedCount: proxyRows.length,
      k8sFetchedCount: k8sRows.length,
      bareMetalFetchedCount: bareMetalRows.length,
      proxyError: proxyError ?? null,
      k8sError: k8sError ?? null,
    },
    bareMetalStale,
    matchFlags: match.matchFlags,
    detail: {
      ...detailCore,
      compareRows: buildProbeCompareRows(detailCore),
    },
  }
}
