import { db } from '@/lib/db'
import type {
  CooperationMode,
  DataCenter,
  DataCenterDetail,
  DataCenterDevice,
  DataCenterStats,
  GPUCardType,
  GpuInventoryDetail,
  Supplier,
  SupplierBill,
  SupplierContract,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import {
  mapDataCenterRow,
  mapGpuCardTypeRow,
  mapGpuInventoryRow,
  mapPhysicalDeviceListRows,
  mapSupplierBillDetailRow,
  mapSupplierBillRow,
  mapSupplierContractRow,
  mapSupplierPricingHistoryRow,
  mapSupplierPricingRecordRow,
  mapSupplierRow,
} from '@/lib/server/mappers/supply'
import { toNumber } from '@/lib/server/mappers/crm'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import {
  dataCenter,
  gpuCardType,
  supplier,
  supplierBill,
  supplierBillDetail,
  computeNode,
  supplierContract,
  supplierDevice,
  supplierGpuInventory,
  supplierPricingHistory,
  supplierPricingRecord,
  userStaff,
} from '@workspace/db/schema'
import { inventoryGpuQuantity, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import { normalizeDeviceOpsStatus } from '@/lib/supplier/device-import-utils'
import { and, count, eq, gt, inArray, ne, sql, sum } from 'drizzle-orm'
import { DEVICE_OPS_STATUS_SEEDS } from '@workspace/db/schema'
import type { OpsStatusBreakdownItem, PhysicalDeviceRoleStats } from '@/lib/data/types'

function emptyPhysicalDeviceRoleStats(): PhysicalDeviceRoleStats {
  return { total: 0, online: 0, maintenance: 0 }
}

type DataCenterInventoryCounts = { total: number; online: number; cpu: number }

function emptyDataCenterInventoryCounts(): DataCenterInventoryCounts {
  return { total: 0, online: 0, cpu: 0 }
}

function aggregateInventoryCountsByDataCenter(
  rows: Array<{
    dataCenterId: string
    quantity: number | null
    onlineQuantity: number | null
    cardTypeName: string
    cardTypeCode: string | null
    cardTypeDeviceRole: string | null
  }>,
): Map<string, DataCenterInventoryCounts> {
  const countMap = new Map<string, DataCenterInventoryCounts>()

  for (const row of rows) {
    const quantity = Number(row.quantity ?? 0)
    const onlineQuantity = Number(row.onlineQuantity ?? 0)
    const isCpuDevice =
      resolveGpuCardTypeRole({
        name: row.cardTypeName,
        code: row.cardTypeCode,
        deviceRole: row.cardTypeDeviceRole,
      }) === 'infra'

    const bucket = countMap.get(row.dataCenterId) ?? emptyDataCenterInventoryCounts()
    if (isCpuDevice) {
      bucket.cpu += quantity
    } else {
      bucket.total += quantity
      bucket.online += onlineQuantity
    }
    countMap.set(row.dataCenterId, bucket)
  }

  return countMap
}

async function fetchInventoryCountsByDataCenter(params: {
  supplierId?: string
  supplierIds?: string[]
  dataCenterId?: string
}): Promise<Map<string, DataCenterInventoryCounts>> {
  const conditions = []
  if (params.dataCenterId) {
    conditions.push(eq(supplierGpuInventory.dataCenterId, params.dataCenterId))
  }
  if (params.supplierId) {
    conditions.push(eq(supplierGpuInventory.supplierId, params.supplierId))
  }
  if (params.supplierIds?.length) {
    conditions.push(inArray(supplierGpuInventory.supplierId, params.supplierIds))
  }

  const invRows = await db
    .select({
      dataCenterId: supplierGpuInventory.dataCenterId,
      quantity: supplierGpuInventory.quantity,
      onlineQuantity: supplierGpuInventory.onlineQuantity,
      cardTypeName: gpuCardType.name,
      cardTypeCode: gpuCardType.code,
      cardTypeDeviceRole: gpuCardType.deviceRole,
    })
    .from(supplierGpuInventory)
    .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return aggregateInventoryCountsByDataCenter(invRows)
}

const KNOWN_DEVICE_OPS_STATUSES = DEVICE_OPS_STATUS_SEEDS.map((s) => s.stateCode)

function buildOpsStatusBreakdown(
  deviceRows: Array<{ opsStatus: string | null }>,
): OpsStatusBreakdownItem[] {
  const counts = new Map<string, number>()
  for (const row of deviceRows) {
    const normalized = normalizeDeviceOpsStatus(row.opsStatus ?? '预留闲置中')
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  const breakdown: OpsStatusBreakdownItem[] = KNOWN_DEVICE_OPS_STATUSES.map((opsStatus) => ({
    opsStatus,
    count: counts.get(opsStatus) ?? 0,
  }))

  let otherCount = 0
  for (const [opsStatus, count] of counts) {
    if (!KNOWN_DEVICE_OPS_STATUSES.includes(opsStatus)) {
      otherCount += count
    }
  }
  if (otherCount > 0) {
    breakdown.push({ opsStatus: '其他', count: otherCount })
  }

  return breakdown
}

function buildPhysicalDeviceStats(
  deviceRows: Array<{
    lifecycleStatus: string | null
    inMaintenance: boolean | null
    opsStatus: string | null
    cardTypeName: string
    cardTypeCode: string | null
    cardTypeDeviceRole: string | null
  }>,
) {
  const gpu = emptyPhysicalDeviceRoleStats()
  const cpu = emptyPhysicalDeviceRoleStats()

  for (const row of deviceRows) {
    const isCpuDevice =
      resolveGpuCardTypeRole({
        name: row.cardTypeName,
        code: row.cardTypeCode,
        deviceRole: row.cardTypeDeviceRole,
      }) === 'infra'
    const bucket = isCpuDevice ? cpu : gpu
    bucket.total += 1
    if (row.lifecycleStatus === '在线') bucket.online += 1
    if (row.lifecycleStatus === '维护中' || row.inMaintenance) bucket.maintenance += 1
  }

  return {
    total: deviceRows.length,
    online: deviceRows.filter((d) => d.lifecycleStatus === '在线').length,
    maintenance: deviceRows.filter(
      (d) => d.lifecycleStatus === '维护中' || d.inMaintenance,
    ).length,
    gpu,
    cpu,
    opsStatusBreakdown: buildOpsStatusBreakdown(deviceRows),
  }
}

function newId() {
  return crypto.randomUUID()
}

function deriveManualSupplierCode(id: string, shortName: string, existingCodes: Set<string>): string {
  const slug = shortName
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .slice(0, 12)
    .toUpperCase()
  const base = slug ? `SUP-${slug}` : `SUP-CRM-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  let code = base
  let n = 2
  while (existingCodes.has(code)) {
    code = `${base}-${n}`
    n++
  }
  return code
}

export const suppliersDataAccess = {
  async list(input?: { externalTenantId?: string }): Promise<Supplier[]> {
    const baseQuery = db
      .select({
        row: supplier,
        businessManagerName: userStaff.displayName,
      })
      .from(supplier)
      .leftJoin(userStaff, eq(supplier.businessManagerStaffId, userStaff.id))

    const rows = input?.externalTenantId
      ? await baseQuery.where(eq(supplier.externalTenantId, input.externalTenantId))
      : await baseQuery

    const dcCounts = await db
      .select({ supplierId: dataCenter.supplierId, value: count() })
      .from(dataCenter)
      .groupBy(dataCenter.supplierId)

    const deviceCounts = await db
      .select({ supplierId: supplierDevice.supplierId, value: count() })
      .from(supplierDevice)
      .groupBy(supplierDevice.supplierId)

    const dcMap = new Map(dcCounts.map((r) => [r.supplierId, Number(r.value)]))
    const devMap = new Map(deviceCounts.map((r) => [r.supplierId, Number(r.value)]))

    return rows.map(({ row, businessManagerName }) =>
      mapSupplierRow(row, businessManagerName, {
        dataCenterCount: dcMap.get(row.id) ?? 0,
        totalDeviceCount: devMap.get(row.id) ?? 0,
      }),
    )
  },

  async getById(id: string): Promise<Supplier | null> {
    const [hit] = await db
      .select({
        row: supplier,
        businessManagerName: userStaff.displayName,
      })
      .from(supplier)
      .leftJoin(userStaff, eq(supplier.businessManagerStaffId, userStaff.id))
      .where(eq(supplier.id, id))
      .limit(1)

    if (!hit) return null

    const [dcRow] = await db
      .select({ value: count() })
      .from(dataCenter)
      .where(eq(dataCenter.supplierId, id))

    const [devRow] = await db
      .select({ supplierId: supplierGpuInventory.supplierId, value: sum(supplierGpuInventory.quantity) })
      .from(supplierGpuInventory)
      .where(eq(supplierGpuInventory.supplierId, id))
      .groupBy(supplierGpuInventory.supplierId)

    const [latestBill] = await db
      .select({ finalAmount: supplierBill.finalAmount })
      .from(supplierBill)
      .where(eq(supplierBill.supplierId, id))
      .orderBy(sql`${supplierBill.billMonth} DESC`)
      .limit(1)

    const mapped = mapSupplierRow(hit.row, hit.businessManagerName, {
      dataCenterCount: Number(dcRow?.value ?? 0),
      totalDeviceCount: Number(devRow?.value ?? 0),
    })
    if (latestBill?.finalAmount != null) {
      mapped.monthlySettlement = toNumber(latestBill.finalAmount)
    }
    return mapped
  },

  async listDataCentersBySupplier(supplierId: string): Promise<DataCenter[]> {
    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, supplierId),
      columns: { id: true, name: true },
    })
    if (!supplierRow) return []

    const dcRows = await db
      .select()
      .from(dataCenter)
      .where(eq(dataCenter.supplierId, supplierId))
      .orderBy(sql`${dataCenter.createdAt} DESC`)

    const invCounts = await fetchInventoryCountsByDataCenter({ supplierId })

    return dcRows.map((row) =>
      mapDataCenterRow(row, supplierRow.name, invCounts.get(row.id)),
    )
  },

  async listDataCentersBySupplierIds(supplierIds: string[]): Promise<DataCenter[]> {
    if (supplierIds.length === 0) return []

    const supplierRows = await db
      .select({ id: supplier.id, name: supplier.name })
      .from(supplier)
      .where(inArray(supplier.id, supplierIds))
    const nameMap = new Map(supplierRows.map((r) => [r.id, r.name]))

    const dcRows = await db
      .select()
      .from(dataCenter)
      .where(inArray(dataCenter.supplierId, supplierIds))
      .orderBy(sql`${dataCenter.createdAt} DESC`)

    const invCounts = await fetchInventoryCountsByDataCenter({ supplierIds })

    return dcRows.map((row) =>
      mapDataCenterRow(row, nameMap.get(row.supplierId) ?? '', invCounts.get(row.id)),
    )
  },

  async listAllDataCenters(params?: { supplierId?: string }): Promise<DataCenter[]> {
    if (params?.supplierId) {
      return this.listDataCentersBySupplier(params.supplierId)
    }

    const supplierRows = await db
      .select({ id: supplier.id, name: supplier.name })
      .from(supplier)
    if (supplierRows.length === 0) return []

    return this.listDataCentersBySupplierIds(supplierRows.map((r) => r.id))
  },

  async getDataCenterStats(params?: { supplierId?: string }): Promise<DataCenterStats> {
    const dcConditions = params?.supplierId
      ? eq(dataCenter.supplierId, params.supplierId)
      : undefined

    const dcRows = await db
      .select({ status: dataCenter.status })
      .from(dataCenter)
      .where(dcConditions)

    const invCounts = await fetchInventoryCountsByDataCenter(
      params?.supplierId ? { supplierId: params.supplierId } : {},
    )
    let totalGpu = 0
    let onlineGpu = 0
    for (const counts of invCounts.values()) {
      totalGpu += counts.total
      onlineGpu += counts.online
    }

    return {
      total: dcRows.length,
      online: dcRows.filter((r) => r.status === 'online').length,
      offline: dcRows.filter((r) => r.status === 'offline').length,
      maintenance: dcRows.filter((r) => r.status === 'maintenance').length,
      totalGpu,
      onlineGpu,
    }
  },

  async getDataCenterDetail(dataCenterId: string): Promise<DataCenterDetail | null> {
    const [hit] = await db
      .select({
        dataCenter: dataCenter,
        supplierName: supplier.name,
      })
      .from(dataCenter)
      .innerJoin(supplier, eq(dataCenter.supplierId, supplier.id))
      .where(eq(dataCenter.id, dataCenterId))
      .limit(1)

    if (!hit) return null

    const invCounts = await fetchInventoryCountsByDataCenter({ dataCenterId })
    const inventoryCounts = invCounts.get(dataCenterId) ?? emptyDataCenterInventoryCounts()

    const mappedDataCenter = mapDataCenterRow(hit.dataCenter, hit.supplierName, inventoryCounts)

    const gpuInventory = (await this.listGpuInventory({ supplierId: hit.dataCenter.supplierId }))
      .filter((row) => row.dataCenterId === dataCenterId)

    const deviceRows = await db
      .select({
        lifecycleStatus: supplierDevice.lifecycleStatus,
        inMaintenance: supplierDevice.inMaintenance,
        opsStatus: supplierDevice.opsStatus,
        cardTypeName: gpuCardType.name,
        cardTypeCode: gpuCardType.code,
        cardTypeDeviceRole: gpuCardType.deviceRole,
      })
      .from(supplierDevice)
      .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .where(eq(supplierDevice.dataCenterId, dataCenterId))

    const physicalDeviceStats = buildPhysicalDeviceStats(deviceRows)

    const inventoryStats = {
      cardTypeCount: gpuInventory.length,
      totalGpu: gpuInventory.reduce(
        (sum, row) => sum + inventoryGpuQuantity(row.cardTypeRole ?? 'compute', row.quantity),
        0,
      ),
      onlineGpu: gpuInventory.reduce(
        (sum, row) => sum + inventoryGpuQuantity(row.cardTypeRole ?? 'compute', row.onlineQuantity),
        0,
      ),
    }

    return {
      dataCenter: mappedDataCenter,
      gpuInventory,
      physicalDeviceStats,
      inventoryStats,
    }
  },

  async listGpuInventory(params?: { supplierId?: string }): Promise<DataCenterDevice[]> {
    const conditions = [gt(supplierGpuInventory.quantity, 0)]
    if (params?.supplierId) {
      conditions.push(eq(supplierGpuInventory.supplierId, params.supplierId))
    }

    const rows = await db
      .select({
        inventory: supplierGpuInventory,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
        cardTypeCode: gpuCardType.code,
        cardTypeDeviceRole: gpuCardType.deviceRole,
        supplierShortName: supplier.shortName,
      })
      .from(supplierGpuInventory)
      .innerJoin(dataCenter, eq(supplierGpuInventory.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id))
      .innerJoin(supplier, eq(supplierGpuInventory.supplierId, supplier.id))
      .where(and(...conditions))
      .orderBy(supplier.shortName, dataCenter.name, gpuCardType.name)

    return rows.map(({ inventory, dataCenterName, cardTypeName, cardTypeCode, cardTypeDeviceRole, supplierShortName }) =>
      mapGpuInventoryRow(inventory, {
        dataCenterName,
        cardTypeName,
        cardTypeCode,
        cardTypeDeviceRole,
        supplierShortName,
      }),
    )
  },

  /** @deprecated 使用 listGpuInventory({ supplierId }) */
  async listGpuInventoryBySupplier(supplierId: string): Promise<DataCenterDevice[]> {
    return this.listGpuInventory({ supplierId })
  },

  async getGpuInventoryDetail(inventoryId: string): Promise<GpuInventoryDetail | null> {
    const [hit] = await db
      .select({
        inventory: supplierGpuInventory,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
        cardTypeCode: gpuCardType.code,
        cardTypeDeviceRole: gpuCardType.deviceRole,
        supplierShortName: supplier.shortName,
      })
      .from(supplierGpuInventory)
      .innerJoin(dataCenter, eq(supplierGpuInventory.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id))
      .innerJoin(supplier, eq(supplierGpuInventory.supplierId, supplier.id))
      .where(eq(supplierGpuInventory.id, inventoryId))
      .limit(1)

    if (!hit) return null

    const inventory = mapGpuInventoryRow(hit.inventory, {
      dataCenterName: hit.dataCenterName,
      cardTypeName: hit.cardTypeName,
      cardTypeCode: hit.cardTypeCode,
      cardTypeDeviceRole: hit.cardTypeDeviceRole,
      supplierShortName: hit.supplierShortName,
    })

    const deviceRows = await db
      .select({
        device: supplierDevice,
        supplierShortName: supplier.shortName,
        cardTypeName: gpuCardType.name,
        cardTypeCode: gpuCardType.code,
        cardTypeDeviceRole: gpuCardType.deviceRole,
        clusterName: computeNode.clusterName,
        nodeRole: computeNode.nodeRole,
        expectedService: computeNode.expectedService,
      })
      .from(supplierDevice)
      .innerJoin(supplier, eq(supplierDevice.supplierId, supplier.id))
      .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .leftJoin(computeNode, eq(computeNode.supplierDeviceId, supplierDevice.id))
      .where(
        and(
          eq(supplierDevice.supplierId, inventory.supplierId),
          eq(supplierDevice.dataCenterId, inventory.dataCenterId),
          eq(supplierDevice.gpuCardTypeId, inventory.cardTypeId),
          ne(supplierDevice.lifecycleStatus, '退订'),
        ),
      )
      .orderBy(sql`${supplierDevice.updatedAt} DESC`)

    const physicalDevices = mapPhysicalDeviceListRows(deviceRows)

    const physicalDeviceStats = buildPhysicalDeviceStats(
      deviceRows.map(({ device, cardTypeName, cardTypeCode, cardTypeDeviceRole }) => ({
        lifecycleStatus: device.lifecycleStatus,
        inMaintenance: device.inMaintenance,
        opsStatus: device.opsStatus,
        cardTypeName,
        cardTypeCode,
        cardTypeDeviceRole,
      })),
    )

    return {
      inventory,
      physicalDevices,
      physicalDeviceStats,
    }
  },

  async listContractsBySupplier(supplierId: string): Promise<SupplierContract[]> {
    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, supplierId),
      columns: { id: true, name: true },
    })
    if (!supplierRow) return []

    const contractRows = await db
      .select()
      .from(supplierContract)
      .where(eq(supplierContract.supplierId, supplierId))
      .orderBy(sql`${supplierContract.createdAt} DESC`)

    return contractRows.map((row) => mapSupplierContractRow(row, supplierRow.name))
  },

  async listAllContracts(): Promise<SupplierContract[]> {
    const rows = await db
      .select({
        contract: supplierContract,
        supplierShortName: supplier.shortName,
      })
      .from(supplierContract)
      .innerJoin(supplier, eq(supplierContract.supplierId, supplier.id))
      .orderBy(sql`${supplierContract.createdAt} DESC`)

    return rows.map(({ contract, supplierShortName }) =>
      mapSupplierContractRow(contract, supplierShortName),
    )
  },

  async listBillsBySupplier(supplierId: string): Promise<SupplierBill[]> {
    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, supplierId),
      columns: { id: true, name: true },
    })
    if (!supplierRow) return []

    const billRows = await db
      .select()
      .from(supplierBill)
      .where(eq(supplierBill.supplierId, supplierId))
      .orderBy(sql`${supplierBill.billMonth} DESC`)

    if (billRows.length === 0) return []

    const billIds = billRows.map((b) => b.id)
    const detailRows = await db
      .select({
        detail: supplierBillDetail,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
      })
      .from(supplierBillDetail)
      .innerJoin(dataCenter, eq(supplierBillDetail.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierBillDetail.gpuCardTypeId, gpuCardType.id))
      .where(inArray(supplierBillDetail.billId, billIds))

    const detailsByBill = new Map<string, SupplierBill['details']>()
    for (const { detail, dataCenterName, cardTypeName } of detailRows) {
      const list = detailsByBill.get(detail.billId) ?? []
      list.push(mapSupplierBillDetailRow(detail, { dataCenterName, cardTypeName }))
      detailsByBill.set(detail.billId, list)
    }

    return billRows.map((row) =>
      mapSupplierBillRow(row, supplierRow.name, detailsByBill.get(row.id) ?? []),
    )
  },

  async listPricingRecordsBySupplier(supplierId: string): Promise<SupplierPricingRecord[]> {
    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, supplierId),
      columns: { id: true, name: true },
    })
    if (!supplierRow) return []

    const rows = await db
      .select({
        record: supplierPricingRecord,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
        updatedByName: userStaff.displayName,
      })
      .from(supplierPricingRecord)
      .innerJoin(dataCenter, eq(supplierPricingRecord.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierPricingRecord.gpuCardTypeId, gpuCardType.id))
      .leftJoin(userStaff, eq(supplierPricingRecord.updatedByStaffId, userStaff.id))
      .where(eq(supplierPricingRecord.supplierId, supplierId))
      .orderBy(dataCenter.name, gpuCardType.name)

    return rows.map(({ record, dataCenterName, cardTypeName, updatedByName }) =>
      mapSupplierPricingRecordRow(
        record,
        { supplierName: supplierRow.name, dataCenterName, cardTypeName },
        updatedByName,
      ),
    )
  },

  async listPricingHistoryBySupplier(supplierId: string): Promise<SupplierPricingHistory[]> {
    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, supplierId),
      columns: { id: true, name: true },
    })
    if (!supplierRow) return []

    const rows = await db
      .select({
        history: supplierPricingHistory,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
        changedByName: userStaff.displayName,
      })
      .from(supplierPricingHistory)
      .innerJoin(dataCenter, eq(supplierPricingHistory.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierPricingHistory.gpuCardTypeId, gpuCardType.id))
      .innerJoin(userStaff, eq(supplierPricingHistory.changedByStaffId, userStaff.id))
      .where(eq(supplierPricingHistory.supplierId, supplierId))
      .orderBy(sql`${supplierPricingHistory.changedAt} DESC`)

    return rows.map(({ history, dataCenterName, cardTypeName, changedByName }) =>
      mapSupplierPricingHistoryRow(history, {
        supplierName: supplierRow.name,
        dataCenterName,
        cardTypeName,
        changedBy: changedByName ?? '—',
      }),
    )
  },

  async listActiveGpuCardTypes(): Promise<GPUCardType[]> {
    const rows = await db
      .select()
      .from(gpuCardType)
      .where(eq(gpuCardType.status, 'active'))
      .orderBy(gpuCardType.name)

    return rows.map(mapGpuCardTypeRow)
  },

  async assertSupplierExists(supplierId: string): Promise<{ id: string; name: string }> {
    const row = await db.query.supplier.findFirst({
      where: eq(supplier.id, supplierId),
      columns: { id: true, name: true },
    })
    if (!row) {
      throw new Error('供应商不存在')
    }
    return row
  },

  async create(input: {
    name: string
    shortName: string
    status: Supplier['status']
    cooperationMode: CooperationMode
    revenueShareRatio?: number
    businessManagerStaffId: string
    contactPerson: string
    contactPhone: string
    contactEmail: string
    address: string
    bankAccount?: string
    bankName?: string
  }): Promise<Supplier> {
    const staff = await staffDataAccess.getById(input.businessManagerStaffId)
    if (!staff || staff.status !== 'active') {
      throw new Error('默认商务经理无效或已停用')
    }

    const id = newId()
    const existingCodes = new Set(
      (await db.select({ code: supplier.code }).from(supplier)).map((row) => row.code),
    )
    const code = deriveManualSupplierCode(id, input.shortName, existingCodes)

    await db.insert(supplier).values({
      id,
      code,
      externalTenantId: `crm-manual-${id}`,
      name: input.name,
      shortName: input.shortName,
      status: input.status,
      defaultCooperationMode: input.cooperationMode,
      defaultRevenueSharePercent:
        input.cooperationMode === 'revenue_share' && input.revenueShareRatio != null
          ? String(input.revenueShareRatio)
          : null,
      businessManagerStaffId: input.businessManagerStaffId,
      contactPerson: input.contactPerson,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      address: input.address,
      bankAccount: input.bankAccount ?? null,
      bankName: input.bankName ?? null,
      source: 'manual',
    })

    const created = await this.getById(id)
    if (!created) {
      throw new Error('创建供应商失败')
    }
    return created
  },

  async update(input: {
    id: string
    name: string
    shortName: string
    status: Supplier['status']
    cooperationMode: CooperationMode
    revenueShareRatio?: number
    businessManagerStaffId: string
    contactPerson: string
    contactPhone: string
    contactEmail: string
    address: string
    bankAccount?: string
    bankName?: string
  }): Promise<Supplier> {
    await this.assertSupplierExists(input.id)

    await db
      .update(supplier)
      .set({
        name: input.name,
        shortName: input.shortName,
        status: input.status,
        defaultCooperationMode: input.cooperationMode,
        defaultRevenueSharePercent:
          input.cooperationMode === 'revenue_share' && input.revenueShareRatio != null
            ? String(input.revenueShareRatio)
            : null,
        businessManagerStaffId: input.businessManagerStaffId,
        contactPerson: input.contactPerson,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        address: input.address,
        bankAccount: input.bankAccount ?? null,
        bankName: input.bankName ?? null,
      })
      .where(eq(supplier.id, input.id))

    const updated = await this.getById(input.id)
    if (!updated) {
      throw new Error('供应商不存在')
    }
    return updated
  },
}

export { newId as newSupplierId }
