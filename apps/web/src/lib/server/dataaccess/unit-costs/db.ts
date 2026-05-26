import { db } from '@/lib/db'
import type {
  ContractPricingMode,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import { isSharePricingMode } from '@/lib/data/types'
import {
  normalizeRatioBandTiersForCompare,
  validateRevenueShareRatioContractTiers,
} from '@/lib/supplier/revenue-share-ratio-tiers'
import {
  DEFAULT_CARDS_PER_MACHINE,
  normalizeSupplierBillingUnit,
  type SupplierBillingUnit,
} from '@/lib/supplier/monthly-rent-pricing'
import {
  normalizePlatformDateTime,
  parsePlatformDateTime,
} from '@/lib/platform-pricing/datetime'
import {
  mapSupplierPricingHistoryRow,
  mapSupplierPricingRecordRow,
} from '@/lib/server/mappers/supply'
import { unitCostsError, unitCostsLog } from '@/lib/server/dataaccess/unit-costs/logger'
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
  billingUnit?: SupplierBillingUnit
  unitPrice?: number
  unitPricePerHour?: number
  cardsPerMachine?: number
  revenueSharePercent?: number
  pricingTiers?: SupplierPricingRecord['pricingTiers']
}) {
  const isShare = isSharePricingMode(input.pricingMode)
  const isTiered =
    input.pricingMode === 'tiered_card_time' || input.pricingMode === 'tiered_revenue_share'
  const billingUnit = input.billingUnit ?? 'hour'

  if (input.pricingMode === 'tiered_revenue_share') {
    const tiers = input.pricingTiers ?? []
    const error = validateRevenueShareRatioContractTiers(tiers)
    if (error) {
      throw new Error(error)
    }
    return
  }

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

  if (billingUnit === 'month') {
    if (input.unitPrice == null || input.unitPrice <= 0) {
      throw new Error('请填写有效的月租金额')
    }
    const cards = input.cardsPerMachine ?? DEFAULT_CARDS_PER_MACHINE
    if (cards <= 0 || !Number.isInteger(cards)) {
      throw new Error('每台卡数须为正整数')
    }
    return
  }

  const hourly = input.unitPrice ?? input.unitPricePerHour
  if (hourly == null || hourly <= 0) {
    throw new Error('请填写有效的卡时单价')
  }
}

function pricingTiersChanged(
  previous: SupplierPricingRecord['pricingTiers'],
  next: SupplierPricingRecord['pricingTiers'],
  pricingMode: ContractPricingMode,
): boolean {
  if (pricingMode === 'tiered_revenue_share') {
    return (
      normalizeRatioBandTiersForCompare(previous) !== normalizeRatioBandTiersForCompare(next)
    )
  }
  return JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null)
}

function assertEffectiveRange(effectiveFrom: string, effectiveTo?: string | null) {
  if (!effectiveTo) return
  if (parsePlatformDateTime(effectiveTo) <= parsePlatformDateTime(effectiveFrom)) {
    throw new Error('结束时间须晚于生效时间')
  }
}

async function resolveValidStaffId(staffId?: string | null): Promise<string | null> {
  if (!staffId) return null
  const row = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { id: true },
  })
  return row?.id ?? null
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
  billingUnit?: SupplierBillingUnit
  unitPrice?: number
  unitPricePerHour?: number
  cardsPerMachine?: number
  revenueSharePercent?: number
  pricingTiers?: SupplierPricingRecord['pricingTiers']
  effectiveFrom: string
  effectiveTo?: string | null
}

function cardTimeStorage(input: {
  billingUnit: SupplierBillingUnit
  unitPrice?: number
  unitPricePerHour?: number
  cardsPerMachine?: number
}): {
  billingUnit: SupplierBillingUnit
  unitPrice: string | null
  unitPricePerHour: string | null
  cardsPerMachine: number | null
} {
  if (input.billingUnit === 'month') {
    if (input.unitPrice == null) {
      throw new Error('请填写有效的月租金额')
    }
    return {
      billingUnit: 'month',
      unitPrice: toMoney(input.unitPrice),
      unitPricePerHour: null,
      cardsPerMachine: input.cardsPerMachine ?? DEFAULT_CARDS_PER_MACHINE,
    }
  }
  const hourly = input.unitPrice ?? input.unitPricePerHour
  if (hourly == null) {
    throw new Error('请填写有效的卡时单价')
  }
  return {
    billingUnit: 'hour',
    unitPrice: toMoney(hourly),
    unitPricePerHour: toMoney(hourly),
    cardsPerMachine: null,
  }
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
    const isTieredShare = input.pricingMode === 'tiered_revenue_share'
    const isShare = isSharePricingMode(input.pricingMode) && !isTieredShare
    const isTiered = input.pricingMode === 'tiered_card_time' || isTieredShare
    const cardTime =
      !isShare && !isTiered
        ? cardTimeStorage({
            billingUnit: input.billingUnit ?? 'hour',
            unitPrice: input.unitPrice,
            unitPricePerHour: input.unitPricePerHour,
            cardsPerMachine: input.cardsPerMachine,
          })
        : null

    unitCostsLog('createRecord', 'creating pricing record', {
      supplierId: input.supplierId,
      dataCenterId: input.dataCenterId,
      gpuCardTypeId: input.gpuCardTypeId,
      pricingMode: input.pricingMode,
      billingUnit: cardTime?.billingUnit,
    })

    await db.insert(supplierPricingRecord).values({
      id: recordId,
      supplierId: input.supplierId,
      dataCenterId: input.dataCenterId,
      gpuCardTypeId: input.gpuCardTypeId,
      pricingMode: input.pricingMode,
      configStatus: 'active',
      billingUnit: cardTime?.billingUnit ?? 'hour',
      unitPrice: cardTime?.unitPrice ?? null,
      cardsPerMachine: cardTime?.cardsPerMachine ?? null,
      unitPricePerHour: cardTime?.unitPricePerHour ?? null,
      revenueSharePercent:
        isShare && input.revenueSharePercent != null
          ? String(input.revenueSharePercent)
          : null,
      pricingTiers: isTiered ? (input.pricingTiers ?? null) : null,
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

    if (existing.pricingMode !== input.pricingMode) {
      throw new Error('不可变更计价方式，请新建配置')
    }

    validatePricingPayload({
      pricingMode: input.pricingMode,
      billingUnit: input.billingUnit,
      unitPrice: input.unitPrice,
      unitPricePerHour: input.unitPricePerHour,
      cardsPerMachine: input.cardsPerMachine,
      revenueSharePercent: input.revenueSharePercent,
      pricingTiers: input.pricingTiers,
    })

    const effectiveFrom = toEffectiveDateTime(input.effectiveFrom)
    const effectiveTo = input.effectiveTo
      ? toEffectiveDateTime(input.effectiveTo)
      : null
    assertEffectiveRange(effectiveFrom, effectiveTo)

    const isTieredShare = input.pricingMode === 'tiered_revenue_share'
    const isShare = isSharePricingMode(input.pricingMode) && !isTieredShare
    const isTiered = input.pricingMode === 'tiered_card_time' || isTieredShare

    const cardTime =
      !isShare && !isTiered
        ? cardTimeStorage({
            billingUnit: input.billingUnit ?? normalizeSupplierBillingUnit(existing.billingUnit),
            unitPrice: input.unitPrice,
            unitPricePerHour: input.unitPricePerHour,
            cardsPerMachine: input.cardsPerMachine,
          })
        : null

    const newShare =
      isShare && input.revenueSharePercent != null ? input.revenueSharePercent : undefined
    const newTiers = isTiered ? (input.pricingTiers ?? null) : null

    const prevBillingUnit = normalizeSupplierBillingUnit(existing.billingUnit)
    const prevUnitPrice = existing.unitPrice ? Number(existing.unitPrice) : undefined
    const prevCards = existing.cardsPerMachine ?? DEFAULT_CARDS_PER_MACHINE
    const prevUnit = existing.unitPricePerHour ? Number(existing.unitPricePerHour) : undefined
    const prevShare = existing.revenueSharePercent
      ? Number(existing.revenueSharePercent)
      : undefined
    const prevTiers = (existing.pricingTiers as SupplierPricingRecord['pricingTiers']) ?? undefined

    const priceChanged =
      (cardTime != null &&
        (cardTime.billingUnit !== prevBillingUnit ||
          (cardTime.unitPrice != null && Number(cardTime.unitPrice) !== prevUnitPrice) ||
          (cardTime.billingUnit === 'month' &&
            (cardTime.cardsPerMachine ?? DEFAULT_CARDS_PER_MACHINE) !== prevCards))) ||
      (cardTime?.billingUnit === 'hour' &&
        cardTime.unitPrice != null &&
        Number(cardTime.unitPrice) !== prevUnit) ||
      (newShare != null && newShare !== prevShare) ||
      (isTiered &&
        pricingTiersChanged(prevTiers, newTiers ?? undefined, input.pricingMode))

    const effectiveChanged =
      toEffectiveDateTime(existing.effectiveFrom) !== effectiveFrom ||
      (existing.effectiveTo ? toEffectiveDateTime(existing.effectiveTo) : null) !== effectiveTo

    const changedByStaffId = await resolveValidStaffId(input.changedByStaffId)

    unitCostsLog('updateRecord', 'updating pricing record', {
      recordId: input.recordId,
      pricingMode: input.pricingMode,
      priceChanged,
      effectiveChanged,
      tierCount: newTiers?.length ?? 0,
    })

    try {
      await db.transaction(async (tx) => {
        if ((priceChanged || effectiveChanged) && changedByStaffId) {
          await tx.insert(supplierPricingHistory).values({
            id: newId(),
            pricingRecordId: input.recordId,
            supplierId: existing.supplierId,
            dataCenterId: existing.dataCenterId,
            gpuCardTypeId: existing.gpuCardTypeId,
            pricingMode: input.pricingMode,
            previousBillingUnit: existing.billingUnit,
            newBillingUnit: cardTime?.billingUnit ?? existing.billingUnit,
            previousUnitPrice: existing.unitPrice,
            newUnitPrice: cardTime?.unitPrice ?? null,
            previousCardsPerMachine: existing.cardsPerMachine,
            newCardsPerMachine: cardTime?.cardsPerMachine ?? null,
            previousUnitPricePerHour: existing.unitPricePerHour,
            newUnitPricePerHour: cardTime?.unitPricePerHour ?? null,
            previousRevenueSharePercent: existing.revenueSharePercent,
            newRevenueSharePercent:
              newShare != null ? String(newShare) : null,
            changedAt: new Date(),
            changedByStaffId,
            reason:
              input.reason?.trim() ||
              (isTieredShare && priceChanged ? '阶梯分成档位调整' : null),
          })
        }

        await tx
          .update(supplierPricingRecord)
          .set({
            pricingMode: input.pricingMode,
            configStatus: 'active',
            billingUnit: cardTime?.billingUnit ?? existing.billingUnit ?? 'hour',
            unitPrice: cardTime?.unitPrice ?? null,
            cardsPerMachine: cardTime?.cardsPerMachine ?? null,
            unitPricePerHour: cardTime?.unitPricePerHour ?? null,
            revenueSharePercent: newShare != null ? String(newShare) : null,
            pricingTiers: newTiers,
            effectiveFrom,
            effectiveTo,
            updatedByStaffId: changedByStaffId ?? existing.updatedByStaffId,
            updatedAt: sql`now()`,
          })
          .where(eq(supplierPricingRecord.id, input.recordId))
      })
    } catch (error) {
      unitCostsError('updateRecord', 'failed to update pricing record', error, {
        recordId: input.recordId,
      })
      throw new Error('更新成本配置失败，请稍后重试')
    }

    const updated = await fetchRecordById(input.recordId)
    if (!updated) {
      throw new Error('更新成本配置失败')
    }

    unitCostsLog('updateRecord', 'pricing record updated', {
      recordId: input.recordId,
      supplierId: updated.supplierId,
    })

    return updated
  },

  async getRecordById(recordId: string): Promise<SupplierPricingRecord | null> {
    return fetchRecordById(recordId)
  },
}
