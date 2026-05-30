import { db } from '@/lib/db'
import { gpuCardType, supplierDevice, supplierGpuInventory } from '@workspace/db/schema'
import { resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import { and, eq, ne } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type AggregateInventoryStatus = 'online' | 'offline' | 'maintenance'

/** 聚合库存运行状态：维护中优先，其次在线，否则离线 */
export function deriveAggregateInventoryStatus(params: {
  quantity: number
  onlineQuantity: number
  maintenanceDeviceCount: number
}): AggregateInventoryStatus {
  if (params.quantity <= 0) return 'offline'
  if (params.maintenanceDeviceCount > 0) return 'maintenance'
  if (params.onlineQuantity > 0) return 'online'
  return 'offline'
}

type InventoryAggregateRow = {
  gpuCardTypeId: string
  quantity: number
  onlineQuantity: number
  maintenanceDeviceCount: number
}

function isDeviceOnline(row: {
  lifecycleStatus: string
  inMaintenance: boolean
  opsStatus: string
}): boolean {
  return (
    row.lifecycleStatus === '在线' &&
    !row.inMaintenance &&
    row.opsStatus !== '不可调度节点运行中'
  )
}

function isDeviceMaintenance(row: {
  lifecycleStatus: string
  inMaintenance: boolean
}): boolean {
  return row.lifecycleStatus === '维护中' || row.inMaintenance
}

async function queryDeviceAggregates(
  tx: DbTx,
  supplierId: string,
  dataCenterId: string,
): Promise<InventoryAggregateRow[]> {
  const rows = await tx
    .select({
      gpuCardTypeId: supplierDevice.gpuCardTypeId,
      gpuCount: supplierDevice.gpuCount,
      lifecycleStatus: supplierDevice.lifecycleStatus,
      inMaintenance: supplierDevice.inMaintenance,
      opsStatus: supplierDevice.opsStatus,
      cardTypeName: gpuCardType.name,
      cardTypeCode: gpuCardType.code,
      deviceRole: gpuCardType.deviceRole,
    })
    .from(supplierDevice)
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(
      and(
        eq(supplierDevice.supplierId, supplierId),
        eq(supplierDevice.dataCenterId, dataCenterId),
        ne(supplierDevice.lifecycleStatus, '退订'),
      ),
    )

  const byCardType = new Map<string, InventoryAggregateRow>()

  for (const row of rows) {
    const role = resolveGpuCardTypeRole({
      name: row.cardTypeName,
      code: row.cardTypeCode,
      deviceRole: row.deviceRole,
    })
    const isOnline = isDeviceOnline(row)
    const isMaintenance = isDeviceMaintenance(row)

    let agg = byCardType.get(row.gpuCardTypeId)
    if (!agg) {
      agg = {
        gpuCardTypeId: row.gpuCardTypeId,
        quantity: 0,
        onlineQuantity: 0,
        maintenanceDeviceCount: 0,
      }
      byCardType.set(row.gpuCardTypeId, agg)
    }

    if (role === 'infra') {
      agg.quantity += 1
      if (isOnline) agg.onlineQuantity += 1
    } else {
      agg.quantity += row.gpuCount
      if (isOnline) agg.onlineQuantity += row.gpuCount
    }
    if (isMaintenance) agg.maintenanceDeviceCount += 1
  }

  return Array.from(byCardType.values())
}

/**
 * 按 supplier_device 重算指定机房的 L1 聚合库存（supplier_gpu_inventory）。
 * 规则见 supplier-device-import-schema.md §6。
 */
export async function refreshSupplierGpuInventoryForDataCenter(
  tx: DbTx,
  params: {
    supplierId: string
    dataCenterId: string
    syncedAt?: Date
  },
): Promise<{ upserted: number }> {
  const syncedAt = params.syncedAt ?? new Date()
  const aggregates = await queryDeviceAggregates(tx, params.supplierId, params.dataCenterId)

  const existing = await tx
    .select()
    .from(supplierGpuInventory)
    .where(
      and(
        eq(supplierGpuInventory.supplierId, params.supplierId),
        eq(supplierGpuInventory.dataCenterId, params.dataCenterId),
      ),
    )

  const existingByCardType = new Map(existing.map((row) => [row.gpuCardTypeId, row]))
  const touchedCardTypes = new Set<string>()
  let upserted = 0

  for (const agg of aggregates) {
    touchedCardTypes.add(agg.gpuCardTypeId)
    const status = deriveAggregateInventoryStatus(agg)
    const prev = existingByCardType.get(agg.gpuCardTypeId)

    if (prev) {
      await tx
        .update(supplierGpuInventory)
        .set({
          quantity: agg.quantity,
          onlineQuantity: agg.onlineQuantity,
          status,
          lastSyncedAt: syncedAt,
          updatedAt: syncedAt,
        })
        .where(eq(supplierGpuInventory.id, prev.id))
    } else {
      await tx.insert(supplierGpuInventory).values({
        id: crypto.randomUUID(),
        supplierId: params.supplierId,
        dataCenterId: params.dataCenterId,
        gpuCardTypeId: agg.gpuCardTypeId,
        quantity: agg.quantity,
        onlineQuantity: agg.onlineQuantity,
        status,
        isInternalTest: false,
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
    }
    upserted++
  }

  for (const row of existing) {
    if (touchedCardTypes.has(row.gpuCardTypeId)) continue
    await tx
      .update(supplierGpuInventory)
      .set({
        quantity: 0,
        onlineQuantity: 0,
        status: 'offline',
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
      .where(eq(supplierGpuInventory.id, row.id))
    upserted++
  }

  return { upserted }
}

/** 对多个机房依次刷新聚合库存 */
export async function refreshSupplierGpuInventoryForDataCenters(
  tx: DbTx,
  params: {
    supplierId: string
    dataCenterIds: string[]
    syncedAt?: Date
  },
): Promise<void> {
  const unique = [...new Set(params.dataCenterIds.filter(Boolean))]
  for (const dataCenterId of unique) {
    await refreshSupplierGpuInventoryForDataCenter(tx, {
      supplierId: params.supplierId,
      dataCenterId,
      syncedAt: params.syncedAt,
    })
  }
}
