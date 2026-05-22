import { db } from '@/lib/db'
import type {
  ContractPricingMode,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import { isSharePricingMode } from '@/lib/data/types'
import {
  normalizePlatformDateTime,
  parsePlatformDateTime,
} from '@/lib/platform-pricing/datetime'
import {
  mapSupplierPricingHistoryRow,
  mapSupplierPricingRecordRow,
} from '@/lib/server/mappers/supply'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import {
  dataCenter,
  gpuCardType,
  supplier,
  supplierPricingHistory,
  supplierPricingRecord,
  userStaff,
} from '@workspace/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function toMoney(value: number): string {
  return value.toFixed(4)
}

function toEffectiveDateTime(value: string | Date): string {
  if (value instanceof Date) {
    return normalizePlatformDateTime(value.toISOString())
  }
  return normalizePlatformDateTime(value)
}

function validatePricingPayload(input: {
  pricingMode: ContractPricingMode
  unitPricePerHour?: number
  revenueSharePercent?: number
  pricingTiers?: SupplierPricingRecord['pricingTiers']
}) {
  const isShare = isSharePricingMode(input.pricingMode)
  const isTiered =
    input.pricingMode === 'tiered_card_time' || input.pricingMode === 'tiered_revenue_share'

  if (isTiered) {
    const tiers = input.pricingTiers ?? []
    if (tiers.length < 1) {
      throw new Error('请至少配置一档阶梯')
    }
    return
  }

  if (isShare) {
    if (input.revenueSharePercent == null || input.revenueSharePercent <= 0) {
      throw new Error('请填写有效的分成比例')
    }
    return
  }

  if (input.unitPricePerHour == null || input.unitPricePerHour <= 0) {
    throw new Error('请填写有效的卡时单价')
  }
}

function assertEffectiveRange(effectiveFrom: string, effectiveTo?: string | null) {
  if (!effectiveTo) return
  if (parsePlatformDateTime(effectiveTo) <= parsePlatformDateTime(effectiveFrom)) {
    throw new Error('结束时间须晚于生效时间')
  }
}

async function fetchRecordById(recordId: string) {
  const rows = await db
    .select({
      record: supplierPricingRecord,
      supplierName: supplier.name,
      dataCenterName: dataCenter.name,
      cardTypeName: gpuCardType.name,
      updatedByName: userStaff.displayName,
    })
    .from(supplierPricingRecord)
    .innerJoin(supplier, eq(supplierPricingRecord.supplierId, supplier.id))
    .innerJoin(dataCenter, eq(supplierPricingRecord.dataCenterId, dataCenter.id))
    .innerJoin(gpuCardType, eq(supplierPricingRecord.gpuCardTypeId, gpuCardType.id))
    .leftJoin(userStaff, eq(supplierPricingRecord.updatedByStaffId, userStaff.id))
    .where(eq(supplierPricingRecord.id, recordId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return mapSupplierPricingRecordRow(
    row.record,
    {
      supplierName: row.supplierName,
      dataCenterName: row.dataCenterName,
      cardTypeName: row.cardTypeName,
    },
    row.updatedByName,
  )
}

export type UnitCostUpsertInput = {
  supplierId: string
  dataCenterId: string
  gpuCardTypeId: string
  pricingMode: ContractPricingMode
  unitPricePerHour?: number
  revenueSharePercent?: number
  pricingTiers?: SupplierPricingRecord['pricingTiers']
  effectiveFrom: string
  effectiveTo?: string | null
}

export type UnitCostUpdateInput = UnitCostUpsertInput & {
  recordId: string
  reason?: string
  changedByStaffId?: string | null
}

export const unitCostsDataAccess = {
  async listRecords(supplierId?: string): Promise<SupplierPricingRecord[]> {
    const base = db
      .select({
        record: supplierPricingRecord,
        supplierName: supplier.name,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
        updatedByName: userStaff.displayName,
      })
      .from(supplierPricingRecord)
      .innerJoin(supplier, eq(supplierPricingRecord.supplierId, supplier.id))
      .innerJoin(dataCenter, eq(supplierPricingRecord.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierPricingRecord.gpuCardTypeId, gpuCardType.id))
      .leftJoin(userStaff, eq(supplierPricingRecord.updatedByStaffId, userStaff.id))

    const rows = supplierId
      ? await base
          .where(eq(supplierPricingRecord.supplierId, supplierId))
          .orderBy(supplier.name, dataCenter.name, gpuCardType.name)
      : await base.orderBy(supplier.name, dataCenter.name, gpuCardType.name)

    return rows.map(({ record, supplierName, dataCenterName, cardTypeName, updatedByName }) =>
      mapSupplierPricingRecordRow(
        record,
        { supplierName, dataCenterName, cardTypeName },
        updatedByName,
      ),
    )
  },

  async listHistory(supplierId?: string): Promise<SupplierPricingHistory[]> {
    const base = db
      .select({
        history: supplierPricingHistory,
        supplierName: supplier.name,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
        changedByName: userStaff.displayName,
      })
      .from(supplierPricingHistory)
      .innerJoin(supplier, eq(supplierPricingHistory.supplierId, supplier.id))
      .innerJoin(dataCenter, eq(supplierPricingHistory.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierPricingHistory.gpuCardTypeId, gpuCardType.id))
      .leftJoin(userStaff, eq(supplierPricingHistory.changedByStaffId, userStaff.id))

    const rows = supplierId
      ? await base
          .where(eq(supplierPricingHistory.supplierId, supplierId))
          .orderBy(desc(supplierPricingHistory.changedAt))
      : await base.orderBy(desc(supplierPricingHistory.changedAt))

    return rows.map(({ history, supplierName, dataCenterName, cardTypeName, changedByName }) =>
      mapSupplierPricingHistoryRow(history, {
        supplierName,
        dataCenterName,
        cardTypeName,
        changedBy: changedByName ?? '—',
      }),
    )
  },

  async createRecord(
    input: UnitCostUpsertInput & { updatedByStaffId?: string | null },
  ): Promise<SupplierPricingRecord> {
    await suppliersDataAccess.assertSupplierExists(input.supplierId)

    const dc = await db.query.dataCenter.findFirst({
      where: and(
        eq(dataCenter.id, input.dataCenterId),
        eq(dataCenter.supplierId, input.supplierId),
      ),
      columns: { id: true },
    })
    if (!dc) {
      throw new Error('机房不存在或不属于该供应商')
    }

    const card = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, input.gpuCardTypeId),
      columns: { id: true, status: true },
    })
    if (!card) {
      throw new Error('GPU 卡型不存在')
    }
    if (card.status !== 'active') {
      throw new Error('该 GPU 卡型已禁用，无法配置成本')
    }

    const duplicate = await db.query.supplierPricingRecord.findFirst({
      where: and(
        eq(supplierPricingRecord.supplierId, input.supplierId),
        eq(supplierPricingRecord.dataCenterId, input.dataCenterId),
        eq(supplierPricingRecord.gpuCardTypeId, input.gpuCardTypeId),
      ),
      columns: { id: true },
    })
    if (duplicate) {
      throw new Error('该供应商机房卡型已有成本配置，请编辑现有记录')
    }

    validatePricingPayload(input)

    const effectiveFrom = toEffectiveDateTime(input.effectiveFrom)
    const effectiveTo = input.effectiveTo
      ? toEffectiveDateTime(input.effectiveTo)
      : null
    assertEffectiveRange(effectiveFrom, effectiveTo)

    const recordId = newId()
    const isShare = isSharePricingMode(input.pricingMode)

    await db.insert(supplierPricingRecord).values({
      id: recordId,
      supplierId: input.supplierId,
      dataCenterId: input.dataCenterId,
      gpuCardTypeId: input.gpuCardTypeId,
      pricingMode: input.pricingMode,
      configStatus: 'active',
      unitPricePerHour:
        !isShare && input.unitPricePerHour != null
          ? toMoney(input.unitPricePerHour)
          : null,
      revenueSharePercent:
        isShare && input.revenueSharePercent != null
          ? String(input.revenueSharePercent)
          : null,
      pricingTiers: input.pricingTiers ?? null,
      effectiveFrom,
      effectiveTo,
      updatedByStaffId: input.updatedByStaffId ?? null,
    })

    const created = await fetchRecordById(recordId)
    if (!created) {
      throw new Error('创建成本配置失败')
    }
    return created
  },

  async updateRecord(input: UnitCostUpdateInput): Promise<SupplierPricingRecord> {
    const existing = await db.query.supplierPricingRecord.findFirst({
      where: eq(supplierPricingRecord.id, input.recordId),
    })
    if (!existing) {
      throw new Error('成本配置不存在')
    }

    validatePricingPayload({
      pricingMode: input.pricingMode,
      unitPricePerHour: input.unitPricePerHour,
      revenueSharePercent: input.revenueSharePercent,
      pricingTiers: input.pricingTiers,
    })

    const effectiveFrom = toEffectiveDateTime(input.effectiveFrom)
    const effectiveTo = input.effectiveTo
      ? toEffectiveDateTime(input.effectiveTo)
      : null
    assertEffectiveRange(effectiveFrom, effectiveTo)

    const isShare = isSharePricingMode(input.pricingMode)
    const newUnitPrice =
      !isShare && input.unitPricePerHour != null ? input.unitPricePerHour : undefined
    const newShare =
      isShare && input.revenueSharePercent != null ? input.revenueSharePercent : undefined

    const prevUnit = existing.unitPricePerHour ? Number(existing.unitPricePerHour) : undefined
    const prevShare = existing.revenueSharePercent
      ? Number(existing.revenueSharePercent)
      : undefined

    const priceChanged =
      (newUnitPrice != null && newUnitPrice !== prevUnit) ||
      (newShare != null && newShare !== prevShare)

    await db.transaction(async (tx) => {
      if (priceChanged && input.changedByStaffId) {
        await tx.insert(supplierPricingHistory).values({
          id: newId(),
          pricingRecordId: input.recordId,
          supplierId: existing.supplierId,
          dataCenterId: existing.dataCenterId,
          gpuCardTypeId: existing.gpuCardTypeId,
          pricingMode: input.pricingMode,
          previousUnitPricePerHour: existing.unitPricePerHour,
          newUnitPricePerHour:
            newUnitPrice != null ? toMoney(newUnitPrice) : null,
          previousRevenueSharePercent: existing.revenueSharePercent,
          newRevenueSharePercent:
            newShare != null ? String(newShare) : null,
          changedAt: new Date(),
          changedByStaffId: input.changedByStaffId,
          reason: input.reason?.trim() || null,
        })
      }

      await tx
        .update(supplierPricingRecord)
        .set({
          pricingMode: input.pricingMode,
          configStatus: 'active',
          unitPricePerHour:
            newUnitPrice != null ? toMoney(newUnitPrice) : null,
          revenueSharePercent: newShare != null ? String(newShare) : null,
          pricingTiers: input.pricingTiers ?? null,
          effectiveFrom,
          effectiveTo,
          updatedByStaffId: input.changedByStaffId ?? existing.updatedByStaffId,
          updatedAt: sql`now()`,
        })
        .where(eq(supplierPricingRecord.id, input.recordId))
    })

    const updated = await fetchRecordById(input.recordId)
    if (!updated) {
      throw new Error('更新成本配置失败')
    }
    return updated
  },

  async getRecordById(recordId: string): Promise<SupplierPricingRecord | null> {
    return fetchRecordById(recordId)
  },
}
