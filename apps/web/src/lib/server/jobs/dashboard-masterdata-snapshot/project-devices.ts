import { db } from '@/lib/db'
import { dashboardError, dashboardLog, dashboardWarn } from '@/lib/server/dataaccess/dashboard/logger'
import {
  endOfLocalDay,
  formatDateKey,
  parseDateKey,
  startOfLocalDay,
} from '@/lib/server/dataaccess/dashboard/period-time'
import {
  deviceDailySnapshot,
  deviceHourlySnapshot,
  supplierDevice,
} from '@workspace/db/schema'
import { and, asc, gte, inArray, lte, ne, sql } from 'drizzle-orm'

import type { MasterdataEtlJobCode } from './etl-batch'
import { finishDashboardEtlBatch, startDashboardEtlBatch } from './etl-batch'
import {
  buildDailySnapshotInsert,
  buildHourlySnapshotInsert,
  resolveSnapshotDate,
  resolveSnapshotHour,
  type DeviceSnapshotSourceRow,
} from './project-device-snapshot-row'

const CHUNK_SIZE = 400
const phase = 'projectDeviceSnapshots'

function deviceNotExcluded() {
  return and(ne(supplierDevice.lifecycleStatus, '退订'), ne(supplierDevice.opsStatus, '已退订'))
}

async function loadDeviceSnapshotSources(deviceIds?: string[]): Promise<DeviceSnapshotSourceRow[]> {
  const conditions = [deviceNotExcluded()]
  if (deviceIds?.length) {
    conditions.push(inArray(supplierDevice.id, deviceIds))
  }

  return db
    .select({
      id: supplierDevice.id,
      supplierId: supplierDevice.supplierId,
      dataCenterId: supplierDevice.dataCenterId,
      gpuCardTypeId: supplierDevice.gpuCardTypeId,
      gpuCount: supplierDevice.gpuCount,
      lifecycleStatus: supplierDevice.lifecycleStatus,
      opsStatus: supplierDevice.opsStatus,
      inMaintenance: supplierDevice.inMaintenance,
      idcCode: supplierDevice.idcCode,
      idcRegion: supplierDevice.idcRegion,
      cooperationType: supplierDevice.cooperationType,
    })
    .from(supplierDevice)
    .where(and(...conditions))
}

async function upsertHourlyChunk(
  devices: DeviceSnapshotSourceRow[],
  snapshotHour: Date,
  etlBatchId: string | null,
): Promise<void> {
  if (devices.length === 0) return
  const values = devices.map((d) => buildHourlySnapshotInsert(d, { snapshotHour, etlBatchId }))
  await db
    .insert(deviceHourlySnapshot)
    .values(values)
    .onConflictDoUpdate({
      target: [deviceHourlySnapshot.snapshotHour, deviceHourlySnapshot.supplierDeviceId],
      set: {
        supplierId: sql`excluded.supplier_id`,
        dataCenterId: sql`excluded.data_center_id`,
        gpuCardTypeId: sql`excluded.gpu_card_type_id`,
        gpuCount: sql`excluded.gpu_count`,
        lifecycleStatus: sql`excluded.lifecycle_status`,
        opsStatus: sql`excluded.ops_status`,
        inMaintenance: sql`excluded.in_maintenance`,
        isOnlineAtEnd: sql`excluded.is_online_at_end`,
        onlineHours: sql`excluded.online_hours`,
        poolCodes: sql`excluded.pool_codes`,
        idcCode: sql`excluded.idc_code`,
        idcRegion: sql`excluded.idc_region`,
        cooperationType: sql`excluded.cooperation_type`,
        etlBatchId: sql`excluded.etl_batch_id`,
        updatedAt: new Date(),
      },
    })
}

async function upsertDailyChunk(
  rows: Array<ReturnType<typeof buildDailySnapshotInsert>>,
): Promise<void> {
  if (rows.length === 0) return
  await db
    .insert(deviceDailySnapshot)
    .values(rows)
    .onConflictDoUpdate({
      target: [deviceDailySnapshot.snapshotDate, deviceDailySnapshot.supplierDeviceId],
      set: {
        supplierId: sql`excluded.supplier_id`,
        dataCenterId: sql`excluded.data_center_id`,
        gpuCardTypeId: sql`excluded.gpu_card_type_id`,
        gpuCount: sql`excluded.gpu_count`,
        lifecycleStatus: sql`excluded.lifecycle_status`,
        opsStatus: sql`excluded.ops_status`,
        inMaintenance: sql`excluded.in_maintenance`,
        isOnlineAtEnd: sql`excluded.is_online_at_end`,
        onlineHours: sql`excluded.online_hours`,
        poolCodes: sql`excluded.pool_codes`,
        idcCode: sql`excluded.idc_code`,
        idcRegion: sql`excluded.idc_region`,
        cooperationType: sql`excluded.cooperation_type`,
        etlBatchId: sql`excluded.etl_batch_id`,
        updatedAt: new Date(),
      },
    })
}

/** 导入 / 实时：写当小时桶 + 日桶末态（日 online_hours 由 MD-2 聚合） */
export async function projectDeviceSnapshotsForDevices(input: {
  deviceIds: string[]
  occurredAt: Date
  jobCode?: MasterdataEtlJobCode
  etlBatchId?: string | null
}): Promise<{ hourlyRows: number; dailyRows: number }> {
  if (input.deviceIds.length === 0) {
    return { hourlyRows: 0, dailyRows: 0 }
  }

  const devices = await loadDeviceSnapshotSources(input.deviceIds)
  if (devices.length === 0) {
    dashboardWarn(phase, '无有效设备可投影（可能已退订）', { requested: input.deviceIds.length })
    return { hourlyRows: 0, dailyRows: 0 }
  }

  const snapshotHour = resolveSnapshotHour(input.occurredAt)
  const snapshotDate = resolveSnapshotDate(input.occurredAt)
  const batchId = input.etlBatchId ?? null

  let hourlyRows = 0
  for (let i = 0; i < devices.length; i += CHUNK_SIZE) {
    const chunk = devices.slice(i, i + CHUNK_SIZE)
    await upsertHourlyChunk(chunk, snapshotHour, batchId)
    hourlyRows += chunk.length
  }

  const dailyValues = devices.map((d) =>
    buildDailySnapshotInsert(d, {
      snapshotDate,
      onlineHours: '0',
      etlBatchId: batchId,
    }),
  )
  for (let i = 0; i < dailyValues.length; i += CHUNK_SIZE) {
    await upsertDailyChunk(dailyValues.slice(i, i + CHUNK_SIZE))
  }

  dashboardLog(phase, 'projected devices', {
    jobCode: input.jobCode,
    snapshotHour: snapshotHour.toISOString(),
    snapshotDate,
    hourlyRows,
    dailyRows: devices.length,
  })

  return { hourlyRows, dailyRows: devices.length }
}

/** ETL-MD-1：全量活跃设备 → 当前整点小时桶 */
export async function runEtlMdHourly(input?: { occurredAt?: Date }): Promise<{
  rowsAffected: number
  etlBatchId: string
}> {
  const occurredAt = input?.occurredAt ?? new Date()
  const snapshotHour = resolveSnapshotHour(occurredAt)
  const bucketEnd = new Date(snapshotHour.getTime() + 60 * 60 * 1000)

  const etlBatchId = await startDashboardEtlBatch({
    jobCode: 'etl_md_hourly',
    granularity: 'hour',
    bucketStart: snapshotHour,
    bucketEnd,
  })

  try {
    const devices = await loadDeviceSnapshotSources()
    let rowsAffected = 0
    for (let i = 0; i < devices.length; i += CHUNK_SIZE) {
      const chunk = devices.slice(i, i + CHUNK_SIZE)
      await upsertHourlyChunk(chunk, snapshotHour, etlBatchId)
      rowsAffected += chunk.length
    }
    await finishDashboardEtlBatch({
      batchId: etlBatchId,
      status: 'succeeded',
      rowsAffected,
    })
    dashboardLog('etl-md-hourly', 'succeeded', {
      snapshotHour: snapshotHour.toISOString(),
      rowsAffected,
    })
    return { rowsAffected, etlBatchId }
  } catch (error) {
    await finishDashboardEtlBatch({
      batchId: etlBatchId,
      status: 'failed',
      rowsAffected: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    dashboardError('etl-md-hourly', 'failed', error)
    throw error
  }
}

function sumOnlineHoursCap24(values: string[]): string {
  const total = values.reduce((s, v) => s + Number(v), 0)
  return String(Math.min(24, Math.max(0, total)))
}

/** ETL-MD-2：聚合自然日小时快照 → 日快照（默认跑「昨日」上海自然日） */
export async function runEtlMdDaily(input?: { snapshotDate?: string }): Promise<{
  rowsAffected: number
  etlBatchId: string
  snapshotDate: string
}> {
  const snapshotDate =
    input?.snapshotDate ??
    (() => {
      const todayStart = startOfLocalDay(new Date())
      const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
      return formatDateKey(yesterday)
    })()

  const dayStart = parseDateKey(snapshotDate)
  if (!dayStart) {
    throw new Error(`无效 snapshotDate: ${snapshotDate}`)
  }
  const dayEnd = endOfLocalDay(dayStart)

  const etlBatchId = await startDashboardEtlBatch({
    jobCode: 'etl_md_daily',
    granularity: 'day',
    bucketStart: dayStart,
    bucketEnd: dayEnd,
    payload: { snapshotDate },
  })

  try {
    const hourlyRows = await db
      .select()
      .from(deviceHourlySnapshot)
      .where(
        and(
          gte(deviceHourlySnapshot.snapshotHour, dayStart),
          lte(deviceHourlySnapshot.snapshotHour, dayEnd),
        ),
      )
      .orderBy(asc(deviceHourlySnapshot.snapshotHour))

    const byDevice = new Map<string, typeof hourlyRows>()
    for (const row of hourlyRows) {
      const list = byDevice.get(row.supplierDeviceId) ?? []
      list.push(row)
      byDevice.set(row.supplierDeviceId, list)
    }

    const dailyValues: Array<ReturnType<typeof buildDailySnapshotInsert>> = []
    for (const [deviceId, hours] of byDevice) {
      if (hours.length === 0) continue
      const last = hours[hours.length - 1]!
      const onlineHours = sumOnlineHoursCap24(hours.map((h) => String(h.onlineHours)))
      dailyValues.push(
        buildDailySnapshotInsert(
          {
            id: deviceId,
            supplierId: last.supplierId,
            dataCenterId: last.dataCenterId,
            gpuCardTypeId: last.gpuCardTypeId,
            gpuCount: last.gpuCount,
            lifecycleStatus: last.lifecycleStatus,
            opsStatus: last.opsStatus,
            inMaintenance: last.inMaintenance,
            idcCode: last.idcCode,
            idcRegion: last.idcRegion,
            cooperationType: last.cooperationType,
          },
          { snapshotDate, onlineHours, etlBatchId },
        ),
      )
    }

    for (let i = 0; i < dailyValues.length; i += CHUNK_SIZE) {
      await upsertDailyChunk(dailyValues.slice(i, i + CHUNK_SIZE))
    }

    await finishDashboardEtlBatch({
      batchId: etlBatchId,
      status: 'succeeded',
      rowsAffected: dailyValues.length,
    })
    dashboardLog('etl-md-daily', 'succeeded', { snapshotDate, rowsAffected: dailyValues.length })
    return { rowsAffected: dailyValues.length, etlBatchId, snapshotDate }
  } catch (error) {
    await finishDashboardEtlBatch({
      batchId: etlBatchId,
      status: 'failed',
      rowsAffected: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    dashboardError('etl-md-daily', 'failed', error, { snapshotDate })
    throw error
  }
}

/** 导入 commit 后：带 etl_batch 审计 */
export async function projectDeviceSnapshotsAfterInventoryImport(input: {
  deviceIds: string[]
  occurredAt: Date
  onboardingBatchId?: string
}): Promise<void> {
  if (input.deviceIds.length === 0) return

  const snapshotHour = resolveSnapshotHour(input.occurredAt)
  const etlBatchId = await startDashboardEtlBatch({
    jobCode: 'etl_md_inventory_realtime',
    granularity: 'hour',
    bucketStart: snapshotHour,
    payload: { onboardingBatchId: input.onboardingBatchId },
  })

  try {
    const { hourlyRows } = await projectDeviceSnapshotsForDevices({
      deviceIds: input.deviceIds,
      occurredAt: input.occurredAt,
      jobCode: 'etl_md_inventory_realtime',
      etlBatchId,
    })
    await finishDashboardEtlBatch({
      batchId: etlBatchId,
      status: 'succeeded',
      rowsAffected: hourlyRows,
    })
  } catch (error) {
    await finishDashboardEtlBatch({
      batchId: etlBatchId,
      status: 'failed',
      rowsAffected: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
