import { db } from '@/lib/db'
import { crmWarn } from '@/lib/server/dataaccess/crm/logger'
import { endpointMatches } from '@/lib/supplier/ip-endpoint-utils'
import { normalizeIdcKey } from '@/lib/server/dataaccess/supplier/device-platform-probe-keys'
import type { IdcDataCenterRef } from '@/lib/server/dataaccess/supplier/device-platform-probe-build'
import type { StagedK8sRow, StagedProxyRow } from '@/lib/server/integrations/suanli-device-probe-api'
import { dataCenter } from '@workspace/db/schema'
import { sql, type SQL } from 'drizzle-orm'

/** 与 resolveGpuCardTypeRole === 'infra' 口径一致（device_role 或名称/编码含 cpu） */
export function sqlIsInfraGpuCardType(gctAlias = 'gct'): SQL {
  return sql.raw(`
    COALESCE(${gctAlias}.device_role, 'compute') = 'infra'
    OR LOWER(COALESCE(${gctAlias}.name, '') || ' ' || COALESCE(${gctAlias}.code, '')) LIKE '%cpu%'
  `)
}

export async function countActiveCpuInventoryDevices(): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT count(*)::text AS count
    FROM supplier_device sd
    LEFT JOIN gpu_card_type gct ON gct.id = sd.gpu_card_type_id
    WHERE sd.lifecycle_status <> '退订'
      AND sd.ops_status <> '已退订'
      AND (${sqlIsInfraGpuCardType()})
  `)
  return Number(result.rows[0]?.count ?? 0)
}

/** 与 activeInventoryDeviceFilter 排除口径一致 */
export function sqlIsRetiredSupplierDevice(sdAlias = 'sd'): SQL {
  return sql.raw(`
    ${sdAlias}.lifecycle_status = '退订'
    OR ${sdAlias}.ops_status = '已退订'
  `)
}

/** 移除当前快照小时内不应参与比对的 CRM 锚点行（已退订、CPU/infra） */
export async function purgeExcludedDeviceSnapshots(snapshotHour: Date): Promise<void> {
  await db.execute(sql`
    DELETE FROM device_platform_probe_snapshot dps
    USING supplier_device sd
    LEFT JOIN gpu_card_type gct ON gct.id = sd.gpu_card_type_id
    WHERE dps.supplier_device_id = sd.id
      AND dps.snapshot_hour = ${snapshotHour}
      AND dps.record_kind = 'crm_inventory'
      AND (
        (${sqlIsRetiredSupplierDevice()})
        OR (${sqlIsInfraGpuCardType()})
      )
  `)
}

/** 删除当前快照小时内全部孤儿行（重建前幂等清理） */
export async function deleteOrphanSnapshotsForHour(snapshotHour: Date): Promise<void> {
  await db.execute(sql`
    DELETE FROM device_platform_probe_snapshot
    WHERE snapshot_hour = ${snapshotHour}
      AND record_kind = 'platform_orphan'
  `)
}

/** idc_key → 机房，供孤儿行反查 supplier / 机房名 */
export async function loadIdcKeyDataCenterMap(): Promise<Map<string, IdcDataCenterRef>> {
  const rows = await db
    .select({
      id: dataCenter.id,
      supplierId: dataCenter.supplierId,
      name: dataCenter.name,
    })
    .from(dataCenter)

  const map = new Map<string, IdcDataCenterRef>()
  for (const row of rows) {
    const key = normalizeIdcKey(row.name)
    if (key && !map.has(key)) {
      map.set(key, { id: row.id, supplierId: row.supplierId, name: row.name })
    }
  }
  return map
}

export type StagedInventoryRow = {
  supplierDeviceId: string
  supplierId: string
  dataCenterId: string | null
  internalIp: string | null
  ipHost: string | null
  idcKey: string | null
  regionKey: string | null
  bmRegionKey: string | null
  opsStatus: string
  lifecycleStatus: string
  inMaintenance: boolean
  sn: string
  dataCenterName: string | null
  externalIp: string | null
  idcCode: string | null
  gpuCardTypeName: string | null
  gpuCount: number | null
  containerInstanceRegion: string | null
  bareMetalRegion: string | null
}

export type StagedBareMetalRow = {
  bareMetalOrderId: string
  bareMetalOrderDeviceId: string
  bmRegionKey: string | null
  idcKey: string | null
  ipHost: string | null
  orderNo: string | null
  orderStatus: string | null
  tenantName: string | null
  rentEndsAt: Date | null
  payload: Record<string, unknown>
}

export async function clearProbeStaging(jobRunId: string): Promise<void> {
  // node-pg prepared statements cannot contain multiple SQL commands
  await Promise.all([
    db.execute(
      sql`DELETE FROM device_platform_probe_staging_inventory WHERE job_run_id = ${jobRunId}`,
    ),
    db.execute(sql`DELETE FROM device_platform_probe_staging_proxy WHERE job_run_id = ${jobRunId}`),
    db.execute(sql`DELETE FROM device_platform_probe_staging_k8s WHERE job_run_id = ${jobRunId}`),
    db.execute(
      sql`DELETE FROM device_platform_probe_staging_bare_metal WHERE job_run_id = ${jobRunId}`,
    ),
  ])
}

export async function insertStagingInventory(jobRunId: string): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH inserted AS (
      INSERT INTO device_platform_probe_staging_inventory (
        job_run_id, supplier_device_id, supplier_id, data_center_id, internal_ip, ip_host,
        idc_key, region_key, bm_region_key, ops_status, lifecycle_status, in_maintenance,
        sn, data_center_name, external_ip, idc_code, gpu_card_type_name, gpu_count,
        container_instance_region, bare_metal_region
      )
      SELECT
        ${jobRunId},
        sd.id,
        sd.supplier_id,
        sd.data_center_id,
        sd.internal_ip,
        normalize_ip_host(sd.internal_ip),
        normalize_idc_key(dc.name),
        normalize_region_key(dc.container_instance_region),
        normalize_region_key(dc.bare_metal_region),
        sd.ops_status,
        sd.lifecycle_status,
        sd.in_maintenance,
        sd.sn,
        dc.name,
        sd.external_ip,
        sd.idc_code,
        gct.name,
        sd.gpu_count,
        dc.container_instance_region,
        dc.bare_metal_region
      FROM supplier_device sd
      LEFT JOIN data_center dc ON dc.id = sd.data_center_id
      LEFT JOIN gpu_card_type gct ON gct.id = sd.gpu_card_type_id
      WHERE sd.lifecycle_status <> '退订'
        AND sd.ops_status <> '已退订'
        AND NOT (${sqlIsInfraGpuCardType()})
      RETURNING 1
    )
    SELECT count(*)::text AS count FROM inserted
  `)
  return Number(result.rows[0]?.count ?? 0)
}

export async function loadStagingInventory(jobRunId: string): Promise<StagedInventoryRow[]> {
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
      supplier_device_id, supplier_id, data_center_id, internal_ip, ip_host,
      idc_key, region_key, bm_region_key, ops_status, lifecycle_status, in_maintenance,
      sn, data_center_name, external_ip, idc_code, gpu_card_type_name, gpu_count,
      container_instance_region, bare_metal_region
    FROM device_platform_probe_staging_inventory
    WHERE job_run_id = ${jobRunId}
  `)

  return result.rows.map((row) => ({
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
  }))
}

export async function insertStagingProxy(jobRunId: string, rows: StagedProxyRow[]): Promise<void> {
  if (rows.length === 0) return
  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values = chunk.map(
      (row) =>
        sql`(${jobRunId}, ${row.platformDeviceId}, ${row.idcKey}, ${row.ipHost}, ${row.rawInnerIp}, ${row.rentStatus}, ${row.isContainerInstance}, ${JSON.stringify(row.payload)}::jsonb)`,
    )
    await db.execute(sql`
      INSERT INTO device_platform_probe_staging_proxy (
        job_run_id, platform_device_id, idc_key, ip_host, raw_inner_ip,
        rent_status, is_container_instance, payload
      ) VALUES ${sql.join(values, sql`, `)}
    `)
  }
}

export async function insertStagingK8s(jobRunId: string, rows: StagedK8sRow[]): Promise<void> {
  if (rows.length === 0) return
  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values = chunk.map(
      (row) =>
        sql`(${jobRunId}, ${row.platformNodeId}, ${row.regionKey}, ${row.ipHost}, ${row.rawInnerIp}, ${row.deviceName}, ${row.gpuName}, ${row.gpuCount}, ${row.hash}, ${JSON.stringify(row.payload)}::jsonb)`,
    )
    await db.execute(sql`
      INSERT INTO device_platform_probe_staging_k8s (
        job_run_id, platform_node_id, region_key, ip_host, raw_inner_ip,
        device_name, gpu_name, gpu_count, hash, payload
      ) VALUES ${sql.join(values, sql`, `)}
    `)
  }
}

export async function insertStagingBareMetal(jobRunId: string): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH inserted AS (
      INSERT INTO device_platform_probe_staging_bare_metal (
        job_run_id, bare_metal_order_id, bare_metal_order_device_id,
        bm_region_key, idc_key, ip_host, order_no, order_status, tenant_name, rent_ends_at, payload
      )
      SELECT
        ${jobRunId},
        bo.id,
        bod.id,
        normalize_region_key(dc.bare_metal_region),
        normalize_idc_key(COALESCE(dc.name, bo.idc_name)),
        normalize_ip_host(bod.internal_ip),
        bo.order_no,
        bo.status,
        bt.name,
        bo.rent_ends_at,
        jsonb_build_object(
          'platform_order_id', bo.platform_order_id,
          'idc_name', bo.idc_name,
          'gpu_model_text', bod.device_model_text,
          'tenant_name', bt.name,
          'rent_ends_at', bo.rent_ends_at
        )
      FROM bare_metal_order_device bod
      INNER JOIN bare_metal_order bo ON bo.id = bod.bare_metal_order_id
      LEFT JOIN data_center dc ON dc.id = bo.data_center_id
      LEFT JOIN tenant bt ON bt.id = bo.tenant_id
      WHERE bo.status IN ('pending', 'paid', 'provisioning', 'active')
        AND (bod.allocation_status IS NULL OR bod.allocation_status <> 'released')
        AND bod.internal_ip IS NOT NULL
        AND btrim(bod.internal_ip) <> ''
      RETURNING 1
    )
    SELECT count(*)::text AS count FROM inserted
  `)
  return Number(result.rows[0]?.count ?? 0)
}

export async function loadStagingBareMetal(jobRunId: string): Promise<StagedBareMetalRow[]> {
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
      bare_metal_order_id, bare_metal_order_device_id, bm_region_key, idc_key, ip_host,
      order_no, order_status, tenant_name, rent_ends_at, payload
    FROM device_platform_probe_staging_bare_metal
    WHERE job_run_id = ${jobRunId}
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

export function groupByKey<T>(
  rows: T[],
  keyFn: (row: T) => string | null,
  ipFn: (row: T) => string | null,
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const ip = ipFn(row)
    if (!key || !ip) continue
    const composite = `${key}::${ip}`
    const list = map.get(composite) ?? []
    list.push(row)
    map.set(composite, list)
  }
  return map
}

export function pickUniqueOrAmbiguous<T>(rows: T[] | undefined): {
  row: T | null
  ambiguous: boolean
} {
  if (!rows || rows.length === 0) return { row: null, ambiguous: false }
  if (rows.length === 1) return { row: rows[0]!, ambiguous: false }
  return { row: null, ambiguous: true }
}

export function matchBareMetalRow(
  inv: StagedInventoryRow,
  bareMetalByBm: Map<string, StagedBareMetalRow[]>,
  bareMetalByIdc: Map<string, StagedBareMetalRow[]>,
): { row: StagedBareMetalRow | null; ambiguous: boolean } {
  if (!inv.ipHost) return { row: null, ambiguous: false }
  if (inv.bmRegionKey) {
    const hit = pickUniqueOrAmbiguous(bareMetalByBm.get(`${inv.bmRegionKey}::${inv.ipHost}`))
    if (hit.row || hit.ambiguous) return hit
  }
  if (inv.idcKey) {
    return pickUniqueOrAmbiguous(bareMetalByIdc.get(`${inv.idcKey}::${inv.ipHost}`))
  }
  return { row: null, ambiguous: false }
}

/** PO-4：等值 Join 未命中时，用 endpointMatches 在候选集中复核 */
export function endpointReviewMatch<T extends { rawInnerIp?: string | null }>(
  crmIp: string | null | undefined,
  exactRows: T[] | undefined,
  allRows: T[],
  keyMatch: (row: T) => boolean,
): { row: T | null; reviewed: boolean } {
  if (exactRows && exactRows.length === 1) return { row: exactRows[0]!, reviewed: false }
  if (!crmIp || !crmIp.includes(':')) return { row: null, reviewed: false }
  const candidates = allRows.filter(keyMatch)
  const matched = candidates.filter((row) => endpointMatches(crmIp, row.rawInnerIp ?? null))
  if (matched.length === 1) return { row: matched[0]!, reviewed: true }
  return { row: null, reviewed: matched.length > 1 }
}

export async function cleanupOldFailedStaging(retentionHours: number): Promise<void> {
  const retentionFilter = sql`
    finished_at IS NOT NULL
    AND finished_at < now() - (${retentionHours}::text || ' hours')::interval
  `
  const deletes = [
    sql`
      DELETE FROM device_platform_probe_staging_inventory
      WHERE job_run_id IN (
        SELECT id FROM device_platform_probe_job_run
        WHERE status IN ('failed', 'partial') AND ${retentionFilter}
      )
    `,
    sql`
      DELETE FROM device_platform_probe_staging_proxy
      WHERE job_run_id IN (
        SELECT id FROM device_platform_probe_job_run
        WHERE status IN ('failed', 'partial') AND ${retentionFilter}
      )
    `,
    sql`
      DELETE FROM device_platform_probe_staging_k8s
      WHERE job_run_id IN (
        SELECT id FROM device_platform_probe_job_run
        WHERE status IN ('failed', 'partial') AND ${retentionFilter}
      )
    `,
    sql`
      DELETE FROM device_platform_probe_staging_bare_metal
      WHERE job_run_id IN (
        SELECT id FROM device_platform_probe_job_run
        WHERE status IN ('failed', 'partial') AND ${retentionFilter}
      )
    `,
  ]

  for (const statement of deletes) {
    try {
      await db.execute(statement)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('does not exist')) {
        crmWarn('device-platform-probe', 'staging cleanup skipped (tables missing)', { message })
        return
      }
      throw error
    }
  }
}

export async function cleanupExpiredSnapshots(retentionDays: number): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM device_platform_probe_snapshot
      WHERE snapshot_hour < (
        date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai')
        - (${retentionDays - 1}::text || ' days')::interval
      )
      RETURNING 1
    )
    SELECT count(*)::text AS count FROM deleted
  `)
  return Number(result.rows[0]?.count ?? 0)
}
