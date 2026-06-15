import { db } from '@/lib/db'
import { isNeedsActionConsistency } from '@/lib/server/dataaccess/supplier/device-platform-probe-consistency'
import { getDevicePlatformProbeConfig } from '@/lib/server/dataaccess/supplier/device-platform-probe-config'
import type { DevicePlatformProbeListInput } from '@/lib/server/routers/supplier/device-platform-probe-schemas'
import type {
  DevicePlatformProbeDetailDto,
  DevicePlatformProbeListItemDto,
  DevicePlatformProbeStateDto,
  DevicePlatformProbeStatsDto,
} from '@/lib/types/device-platform-probe-api'
import type {
  BareMetalPlatformRecord,
  CrmProbeSnapshot,
  DeviceInfoPlatformRecord,
  DeviceProbeChangeLog,
  NodeDevicePlatformRecord,
  ProxyRentStatus,
} from '@/lib/supplier/device-platform-probe-utils'
import {
  buildProbeCompareRows,
  type DevicePlatformProbeDetail,
} from '@/lib/supplier/device-platform-probe-utils'
import {
  dataCenter,
  devicePlatformProbeJobRun,
  devicePlatformProbeSnapshot,
  devicePlatformProbeState,
  gpuCardType,
  supplierDevice,
  supplierDeviceChangeLog,
} from '@workspace/db/schema'
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

async function resolveSnapshotHour(inputHour?: string): Promise<Date | null> {
  if (inputHour) return new Date(inputHour)
  const state = await db.query.devicePlatformProbeState.findFirst({
    where: (t, { eq }) => eq(t.id, 'default'),
  })
  return state?.lastSnapshotHour ?? null
}

function mapListRow(row: typeof devicePlatformProbeSnapshot.$inferSelect): DevicePlatformProbeListItemDto {
  return {
    id: row.id,
    supplierDeviceId: row.supplierDeviceId,
    sn: row.sn,
    internalIp: row.internalIp,
    dataCenterName: row.dataCenterName,
    opsStatus: row.opsStatus,
    lifecycleStatus: row.lifecycleStatus,
    snapshotHour: toIso(row.snapshotHour)!,
    probeStatus: row.probeStatus as DevicePlatformProbeListItemDto['probeStatus'],
    consistencyFlag: row.consistencyFlag as DevicePlatformProbeListItemDto['consistencyFlag'],
    proxyMatched: row.proxyMatched,
    proxyRentStatus: (row.proxyRentStatus as ProxyRentStatus | null) ?? null,
    proxyIsContainerInstance: row.proxyIsContainerInstance,
    k8sMatched: row.k8sMatched,
    k8sDeviceName: row.k8sDeviceName,
    bareMetalMatched: row.bareMetalMatched,
    bareMetalOrderNo: row.bareMetalOrderNo,
    suggestedAction: row.suggestedAction ?? '—',
  }
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

function buildDetailFromSnapshot(
  row: typeof devicePlatformProbeSnapshot.$inferSelect,
  crmExtra: {
    externalIp: string | null
    containerInstanceRegion: string | null
    bareMetalRegion: string | null
    idcCode: string | null
    gpuCardTypeName: string | null
    gpuCount: number | null
    inMaintenance: boolean
  },
  changeLogs: DeviceProbeChangeLog[],
): DevicePlatformProbeDetailDto {
  const listRow = mapListRow(row)
  const proxyPayload = (row.proxyPayload ?? {}) as Record<string, unknown>
  const k8sPayload = (row.k8sPayload ?? {}) as Record<string, unknown>
  const bareMetalPayload = (row.bareMetalPayload ?? {}) as Record<string, unknown>

  const crm: CrmProbeSnapshot = {
    opsStatus: row.opsStatus,
    lifecycleStatus: row.lifecycleStatus,
    inMaintenance: crmExtra.inMaintenance,
    internalIp: row.internalIp,
    externalIp: crmExtra.externalIp,
    dataCenterName: row.dataCenterName,
    containerInstanceRegion: crmExtra.containerInstanceRegion,
    bareMetalRegion: crmExtra.bareMetalRegion,
    idcCode: crmExtra.idcCode,
    gpuCardTypeName: crmExtra.gpuCardTypeName,
    gpuCount: crmExtra.gpuCount,
  }

  const deviceInfo: DeviceInfoPlatformRecord = {
    matched: row.proxyMatched,
    platformDeviceId: row.proxyPlatformDeviceId,
    name: payloadString(proxyPayload, 'name'),
    idcName: payloadString(proxyPayload, 'idc_name') ?? row.dataCenterName,
    innerIp: payloadString(proxyPayload, 'inner_ip') ?? row.internalIp,
    pubIp: payloadString(proxyPayload, 'pub_ip'),
    rentStatus: (row.proxyRentStatus as ProxyRentStatus | null) ?? null,
    isContainerInstance: row.proxyIsContainerInstance,
    onlineStatus: payloadString(proxyPayload, 'online_status'),
    shelfStatus: payloadString(proxyPayload, 'shelf_status'),
    listingMode: payloadString(proxyPayload, 'listing_mode'),
    gpuModel: payloadString(proxyPayload, 'gpu_model'),
    gpuCount: payloadNumber(proxyPayload, 'gpu_count'),
    lastConnectionTime: payloadString(proxyPayload, 'last_connection_time'),
  }

  const nodeDevice: NodeDevicePlatformRecord = {
    matched: row.k8sMatched,
    platformNodeId: payloadString(k8sPayload, 'id'),
    deviceName: row.k8sDeviceName ?? payloadString(k8sPayload, 'device_name'),
    region: row.k8sRegion ?? payloadString(k8sPayload, 'region'),
    innerIp: payloadString(k8sPayload, 'inner_ip') ?? row.internalIp,
    gpuName: payloadString(k8sPayload, 'gpu_name'),
    gpuCount: payloadNumber(k8sPayload, 'gpu_count'),
    hash: payloadString(k8sPayload, 'hash'),
    offlineDate: payloadString(k8sPayload, 'offline_date'),
  }

  const bareMetal: BareMetalPlatformRecord = {
    matched: row.bareMetalMatched,
    orderNo: row.bareMetalOrderNo,
    orderStatus: row.bareMetalOrderStatus,
    platformOrderId: payloadString(bareMetalPayload, 'platform_order_id'),
    idcName: payloadString(bareMetalPayload, 'idc_name') ?? row.dataCenterName,
    bareMetalRegion: crmExtra.bareMetalRegion,
    internalIp: row.internalIp,
    tenantName: payloadString(bareMetalPayload, 'tenant_name'),
    gpuModelText: payloadString(bareMetalPayload, 'gpu_model_text'),
    rentEndsAt: payloadString(bareMetalPayload, 'rent_ends_at'),
  }

  const detailCore: DevicePlatformProbeDetail = {
    row: listRow,
    crm,
    deviceInfo,
    nodeDevice,
    bareMetal,
    changeLogs,
  }

  return {
    ...detailCore,
    compareRows: buildProbeCompareRows(detailCore),
  }
}

export const devicePlatformProbeDataAccess = {
  async getState(): Promise<DevicePlatformProbeStateDto> {
    const state = await db.query.devicePlatformProbeState.findFirst({
      where: (t, { eq }) => eq(t.id, 'default'),
    })
    const config = getDevicePlatformProbeConfig()
    return {
      enabled: config.enabled,
      lastRunAt: toIso(state?.lastRunAt),
      lastSuccessAt: toIso(state?.lastSuccessAt),
      lastSnapshotHour: toIso(state?.lastSnapshotHour),
      cron: config.cron,
    }
  },

  async list(input: DevicePlatformProbeListInput = { page: 1, pageSize: 20 }): Promise<{
    items: DevicePlatformProbeListItemDto[]
    total: number
    snapshotHour: string | null
    stats: DevicePlatformProbeStatsDto
  }> {
    const snapshotHour = await resolveSnapshotHour(input.snapshotHour)
    if (!snapshotHour) {
      return {
        items: [],
        total: 0,
        snapshotHour: null,
        stats: { total: 0, consistent: 0, needsAction: 0, notEvaluated: 0 },
      }
    }

    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 20
    const offset = (page - 1) * pageSize
    const q = input.search?.trim()

    const filters = [eq(devicePlatformProbeSnapshot.snapshotHour, snapshotHour)]

    if (input.consistencyFlag) {
      filters.push(eq(devicePlatformProbeSnapshot.consistencyFlag, input.consistencyFlag))
    }
    if (input.probeStatus) {
      filters.push(eq(devicePlatformProbeSnapshot.probeStatus, input.probeStatus))
    }
    if (input.needsActionOnly) {
      filters.push(
        sql`${devicePlatformProbeSnapshot.consistencyFlag} IN ('missing_platform', 'unexpected_platform', 'multi_channel_conflict')`,
      )
    }
    if (q) {
      filters.push(
        or(
          ilike(devicePlatformProbeSnapshot.sn, `%${q}%`),
          ilike(devicePlatformProbeSnapshot.internalIp, `%${q}%`),
          ilike(devicePlatformProbeSnapshot.dataCenterName, `%${q}%`),
          ilike(devicePlatformProbeSnapshot.opsStatus, `%${q}%`),
          ilike(devicePlatformProbeSnapshot.bareMetalOrderNo, `%${q}%`),
        )!,
      )
    }

    const whereClause = and(...filters)

    const [rows, totalRow, statsRows] = await Promise.all([
      db
        .select()
        .from(devicePlatformProbeSnapshot)
        .where(whereClause)
        .orderBy(desc(devicePlatformProbeSnapshot.consistencyFlag), desc(devicePlatformProbeSnapshot.sn))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(devicePlatformProbeSnapshot).where(whereClause),
      db
        .select({
          consistencyFlag: devicePlatformProbeSnapshot.consistencyFlag,
          total: count(),
        })
        .from(devicePlatformProbeSnapshot)
        .where(eq(devicePlatformProbeSnapshot.snapshotHour, snapshotHour))
        .groupBy(devicePlatformProbeSnapshot.consistencyFlag),
    ])

    const stats: DevicePlatformProbeStatsDto = {
      total: statsRows.reduce((sum, r) => sum + Number(r.total), 0),
      consistent: Number(statsRows.find((r) => r.consistencyFlag === 'consistent')?.total ?? 0),
      needsAction: statsRows
        .filter((r) => isNeedsActionConsistency(r.consistencyFlag as never))
        .reduce((sum, r) => sum + Number(r.total), 0),
      notEvaluated: Number(statsRows.find((r) => r.consistencyFlag === 'not_evaluated')?.total ?? 0),
    }

    return {
      items: rows.map(mapListRow),
      total: Number(totalRow[0]?.total ?? 0),
      snapshotHour: snapshotHour.toISOString(),
      stats,
    }
  },

  async getById(id: string): Promise<DevicePlatformProbeDetailDto | null> {
    const row = await db.query.devicePlatformProbeSnapshot.findFirst({
      where: (t, { eq }) => eq(t.id, id),
    })
    if (!row) return null

    const [deviceRow] = await db
      .select({
        externalIp: supplierDevice.externalIp,
        idcCode: supplierDevice.idcCode,
        inMaintenance: supplierDevice.inMaintenance,
        gpuCount: supplierDevice.gpuCount,
        gpuCardTypeName: gpuCardType.name,
        containerInstanceRegion: dataCenter.containerInstanceRegion,
        bareMetalRegion: dataCenter.bareMetalRegion,
      })
      .from(supplierDevice)
      .leftJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .leftJoin(dataCenter, eq(supplierDevice.dataCenterId, dataCenter.id))
      .where(eq(supplierDevice.id, row.supplierDeviceId))
      .limit(1)

    const changeLogRows = await db
      .select({
        id: supplierDeviceChangeLog.id,
        occurredAt: supplierDeviceChangeLog.occurredAt,
        changeAction: supplierDeviceChangeLog.changeAction,
        changeContent: supplierDeviceChangeLog.changeContent,
        description: supplierDeviceChangeLog.description,
        ticketNo: supplierDeviceChangeLog.ticketNo,
        internalIp: supplierDeviceChangeLog.internalIp,
      })
      .from(supplierDeviceChangeLog)
      .where(eq(supplierDeviceChangeLog.supplierDeviceId, row.supplierDeviceId))
      .orderBy(desc(supplierDeviceChangeLog.occurredAt))
      .limit(50)

    const changeLogs: DeviceProbeChangeLog[] = changeLogRows.map((log) => ({
      id: log.id,
      occurredAt: toIso(log.occurredAt)!,
      changeAction: log.changeAction,
      changeContent: log.changeContent,
      description: log.description,
      ticketNo: log.ticketNo,
      internalIp: log.internalIp,
    }))

    return buildDetailFromSnapshot(row, {
      externalIp: deviceRow?.externalIp ?? null,
      containerInstanceRegion: deviceRow?.containerInstanceRegion ?? null,
      bareMetalRegion: deviceRow?.bareMetalRegion ?? null,
      idcCode: deviceRow?.idcCode ?? null,
      gpuCardTypeName: deviceRow?.gpuCardTypeName ?? null,
      gpuCount: deviceRow?.gpuCount ?? null,
      inMaintenance: deviceRow?.inMaintenance ?? false,
    }, changeLogs)
  },

  async listRecentRuns(limit = 10) {
    return db
      .select()
      .from(devicePlatformProbeJobRun)
      .orderBy(desc(devicePlatformProbeJobRun.startedAt))
      .limit(limit)
  },
}
