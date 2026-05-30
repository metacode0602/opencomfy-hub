import { resolveDevicePoolMemberships } from '@/lib/supplier/device-pool-membership'
import {
  formatDateKey,
  formatDateTimeKey,
  startOfLocalHour,
} from '@/lib/server/dataaccess/dashboard/period-time'

export type DeviceSnapshotSourceRow = {
  id: string
  supplierId: string
  dataCenterId: string | null
  gpuCardTypeId: string
  gpuCount: number
  lifecycleStatus: string
  opsStatus: string
  inMaintenance: boolean
  idcCode: string | null
  idcRegion: string | null
  cooperationType: string | null
}

export function isOnlineAtEnd(lifecycleStatus: string, inMaintenance: boolean): boolean {
  return lifecycleStatus === '在线' && !inMaintenance
}

/** 小时桶内在线时长权重 0~1（MVP：整小时采用桶末态） */
export function hourlyOnlineHoursValue(lifecycleStatus: string, inMaintenance: boolean): string {
  return isOnlineAtEnd(lifecycleStatus, inMaintenance) ? '1' : '0'
}

export function poolCodesFromOpsStatus(opsStatus: string): string[] {
  return [...resolveDevicePoolMemberships(opsStatus)]
}

export function hourlySnapshotRowId(snapshotHour: Date, supplierDeviceId: string): string {
  return `${formatDateTimeKey(snapshotHour)}:${supplierDeviceId}`
}

export function dailySnapshotRowId(snapshotDate: string, supplierDeviceId: string): string {
  return `${snapshotDate}:${supplierDeviceId}`
}

export function resolveSnapshotHour(occurredAt: Date): Date {
  return startOfLocalHour(occurredAt)
}

export function resolveSnapshotDate(occurredAt: Date): string {
  return formatDateKey(occurredAt)
}

export function buildHourlySnapshotInsert(row: DeviceSnapshotSourceRow, input: {
  snapshotHour: Date
  etlBatchId?: string | null
}) {
  const online = isOnlineAtEnd(row.lifecycleStatus, row.inMaintenance)
  return {
    id: hourlySnapshotRowId(input.snapshotHour, row.id),
    snapshotHour: input.snapshotHour,
    supplierDeviceId: row.id,
    supplierId: row.supplierId,
    dataCenterId: row.dataCenterId,
    gpuCardTypeId: row.gpuCardTypeId,
    gpuCount: row.gpuCount,
    lifecycleStatus: row.lifecycleStatus,
    opsStatus: row.opsStatus,
    inMaintenance: row.inMaintenance,
    isOnlineAtEnd: online,
    onlineHours: hourlyOnlineHoursValue(row.lifecycleStatus, row.inMaintenance),
    poolCodes: poolCodesFromOpsStatus(row.opsStatus),
    idcCode: row.idcCode,
    idcRegion: row.idcRegion,
    cooperationType: row.cooperationType,
    etlBatchId: input.etlBatchId ?? null,
  }
}

export function buildDailySnapshotInsert(row: DeviceSnapshotSourceRow, input: {
  snapshotDate: string
  onlineHours: string
  etlBatchId?: string | null
}) {
  const online = isOnlineAtEnd(row.lifecycleStatus, row.inMaintenance)
  return {
    id: dailySnapshotRowId(input.snapshotDate, row.id),
    snapshotDate: input.snapshotDate,
    supplierDeviceId: row.id,
    supplierId: row.supplierId,
    dataCenterId: row.dataCenterId,
    gpuCardTypeId: row.gpuCardTypeId,
    gpuCount: row.gpuCount,
    lifecycleStatus: row.lifecycleStatus,
    opsStatus: row.opsStatus,
    inMaintenance: row.inMaintenance,
    isOnlineAtEnd: online,
    onlineHours: input.onlineHours,
    poolCodes: poolCodesFromOpsStatus(row.opsStatus),
    idcCode: row.idcCode,
    idcRegion: row.idcRegion,
    cooperationType: row.cooperationType,
    etlBatchId: input.etlBatchId ?? null,
  }
}
