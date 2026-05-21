import { db } from '@/lib/db'
import type {
  DataCenter,
  DataCenterDevice,
  GPUCardType,
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
  mapSupplierBillDetailRow,
  mapSupplierBillRow,
  mapSupplierContractRow,
  mapSupplierPricingHistoryRow,
  mapSupplierPricingRecordRow,
  mapSupplierRow,
} from '@/lib/server/mappers/supply'
import { toNumber } from '@/lib/server/mappers/crm'
import {
  dataCenter,
  gpuCardType,
  supplier,
  supplierBill,
  supplierBillDetail,
  supplierContract,
  supplierDevice,
  supplierGpuInventory,
  supplierPricingHistory,
  supplierPricingRecord,
  userStaff,
} from '@workspace/db/schema'
import { count, eq, inArray, sql, sum } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export const suppliersDataAccess = {
  async list(): Promise<Supplier[]> {
    const rows = await db
      .select({
        row: supplier,
        businessManagerName: userStaff.displayName,
      })
      .from(supplier)
      .leftJoin(userStaff, eq(supplier.businessManagerStaffId, userStaff.id))

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

    const invCounts = await db
      .select({
        dataCenterId: supplierGpuInventory.dataCenterId,
        total: sum(supplierGpuInventory.quantity),
        online: sum(supplierGpuInventory.onlineQuantity),
      })
      .from(supplierGpuInventory)
      .where(eq(supplierGpuInventory.supplierId, supplierId))
      .groupBy(supplierGpuInventory.dataCenterId)

    const countMap = new Map(
      invCounts.map((r) => [
        r.dataCenterId,
        { total: Number(r.total ?? 0), online: Number(r.online ?? 0) },
      ]),
    )

    return dcRows.map((row) =>
      mapDataCenterRow(row, supplierRow.name, countMap.get(row.id)),
    )
  },

  async listGpuInventoryBySupplier(supplierId: string): Promise<DataCenterDevice[]> {
    const rows = await db
      .select({
        inventory: supplierGpuInventory,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
      })
      .from(supplierGpuInventory)
      .innerJoin(dataCenter, eq(supplierGpuInventory.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id))
      .where(eq(supplierGpuInventory.supplierId, supplierId))
      .orderBy(dataCenter.name, gpuCardType.name)

    return rows.map(({ inventory, dataCenterName, cardTypeName }) =>
      mapGpuInventoryRow(inventory, { dataCenterName, cardTypeName }),
    )
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
}

export { newId as newSupplierId }
