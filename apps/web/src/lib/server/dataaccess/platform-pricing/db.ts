import { db } from '@/lib/db'
import type { GPUCardType } from '@/lib/data/types'
import { mapGpuCardTypeRow } from '@/lib/server/mappers/supply'
import { platformPricingLog } from '@/lib/server/dataaccess/platform-pricing/logger'
import type {
  PlatformBillingUnit,
  PlatformCardPriceHistory,
  PlatformCardPriceRecord,
  PlatformPriceStatus,
  PlatformProductLine,
} from '@/lib/types/platform-pricing'
import { platformProductLineNames } from '@/lib/types/platform-pricing'
import type { PlatformCardTypeListRow, PlatformPricingDetailPageData, PlatformPricingListPageData } from '@/lib/types/platform-pricing-views'
import {
  buildDetailPageDataForCard,
} from '@/lib/platform-pricing/transforms'
import {
  normalizePlatformDateTime,
  secondBeforePlatformDateTime,
} from '@/lib/platform-pricing/datetime'
import {
  gpuCardType,
  platformCardListPrice,
  platformCardPriceHistory,
  platformCardPriceRecord,
  supplierGpuInventory,
  userStaff,
} from '@workspace/db/schema'
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value)
}

function toEffectiveDateTime(value: string | Date): string {
  if (value instanceof Date) {
    return normalizePlatformDateTime(value.toISOString())
  }
  return normalizePlatformDateTime(value)
}

function formatPriceSummary(prices: number[]): string {
  if (prices.length === 0) return '未配置'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return `¥${min.toFixed(2)}/时`
  return `¥${min.toFixed(0)}–${max.toFixed(0)}/时`
}

export type PlatformPriceUpsertInput = {
  gpuCardTypeId: string
  productLine: PlatformProductLine
  billingUnit: PlatformBillingUnit
  sellPrice: number
  effectiveFrom: string
  status: PlatformPriceStatus
  remark?: string
  changedByStaffId?: string | null
}

export type PlatformPriceUpdateInput = PlatformPriceUpsertInput & {
  recordId: string
}

function mapHistoryRow(
  row: typeof platformCardPriceHistory.$inferSelect,
  cardTypeName: string,
  changedByName?: string | null,
): PlatformCardPriceHistory {
  return {
    id: row.id,
    priceRecordId: row.priceRecordId,
    gpuCardTypeId: row.gpuCardTypeId,
    cardTypeName,
    productLine: row.productLine as PlatformProductLine,
    billingUnit: row.billingUnit as PlatformBillingUnit,
    previousSellPrice:
      row.previousSellPrice != null ? toNumber(row.previousSellPrice) : undefined,
    newSellPrice: toNumber(row.newSellPrice),
    changedAt: row.changedAt.toISOString(),
    changedBy: changedByName ?? '—',
    reason: row.reason ?? undefined,
  }
}

function buildRecordsFromListPrices(
  listPrices: (typeof platformCardListPrice.$inferSelect)[],
  records: (typeof platformCardPriceRecord.$inferSelect)[],
  cardTypeName: string,
): PlatformCardPriceRecord[] {
  const recordByDimension = new Map(
    records.map((record) => [`${record.productLine}:${record.billingUnit}`, record]),
  )

  return listPrices.map((listPrice) => {
    const dimensionKey = `${listPrice.productLine}:${listPrice.billingUnit}`
    const currentRecord = recordByDimension.get(dimensionKey)
    const isCurrentListPrice = currentRecord?.platformCardListPriceId === listPrice.id

    return {
      id: isCurrentListPrice && currentRecord ? currentRecord.id : listPrice.id,
      gpuCardTypeId: listPrice.gpuCardTypeId,
      cardTypeName,
      periodId: `${listPrice.gpuCardTypeId}:${toEffectiveDateTime(listPrice.effectiveFrom)}`,
      productLine: listPrice.productLine as PlatformProductLine,
      billingUnit: listPrice.billingUnit as PlatformBillingUnit,
      sellPrice: toNumber(listPrice.sellPrice),
      currency: listPrice.currency,
      effectiveFrom: toEffectiveDateTime(listPrice.effectiveFrom),
      effectiveTo: listPrice.effectiveTo ? toEffectiveDateTime(listPrice.effectiveTo) : null,
      status: listPrice.status as PlatformPriceStatus,
      remark: listPrice.remark ?? undefined,
      updatedAt: listPrice.updatedAt.toISOString(),
    }
  })
}

async function insertPriceHistory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    priceRecordId: string
    gpuCardTypeId: string
    productLine: string
    billingUnit: string
    previousSellPrice: string | null
    newSellPrice: string
    reason?: string | null
    changedByStaffId?: string | null
  },
) {
  await tx.insert(platformCardPriceHistory).values({
    id: newId(),
    priceRecordId: input.priceRecordId,
    gpuCardTypeId: input.gpuCardTypeId,
    productLine: input.productLine,
    billingUnit: input.billingUnit,
    previousSellPrice: input.previousSellPrice,
    newSellPrice: input.newSellPrice,
    changedAt: new Date(),
    changedByStaffId: input.changedByStaffId ?? null,
    reason: input.reason?.trim() || null,
  })
}

function mapRecordRow(
  record: typeof platformCardPriceRecord.$inferSelect,
  listPrice: typeof platformCardListPrice.$inferSelect | null,
  cardTypeName: string,
): PlatformCardPriceRecord {
  const effectiveFrom = listPrice
    ? toEffectiveDateTime(listPrice.effectiveFrom)
    : toEffectiveDateTime(record.effectiveFrom)

  return {
    id: record.id,
    gpuCardTypeId: record.gpuCardTypeId,
    cardTypeName,
    periodId: `${record.gpuCardTypeId}:${effectiveFrom}`,
    productLine: record.productLine as PlatformProductLine,
    billingUnit: record.billingUnit as PlatformBillingUnit,
    sellPrice: toNumber(record.sellPrice),
    currency: listPrice?.currency ?? 'CNY',
    effectiveFrom,
    effectiveTo: listPrice?.effectiveTo ? toEffectiveDateTime(listPrice.effectiveTo) : null,
    status: (listPrice?.status ?? 'active') as PlatformPriceStatus,
    remark: listPrice?.remark ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
  }
}

function buildCardTypeListRow(
  card: GPUCardType,
  records: PlatformCardPriceRecord[],
  listPrices: (typeof platformCardListPrice.$inferSelect)[],
  datacenterCount: number,
): PlatformCardTypeListRow {
  const cardRecords = records.filter((r) => r.gpuCardTypeId === card.id)
  const cardListPrices = listPrices.filter(
    (row) => row.gpuCardTypeId === card.id && row.status !== 'archived',
  )
  const activeRecords = cardRecords.filter((r) => r.status === 'active')
  const hourPrices = activeRecords
    .filter((r) => r.billingUnit === 'hour' || r.productLine !== 'bare_metal')
    .map((r) => r.sellPrice)

  const configuredLines = new Set(
    activeRecords.map((r) => platformProductLineNames[r.productLine]),
  )

  return {
    cardTypeId: card.id,
    cardTypeName: card.name,
    manufacturer: card.manufacturer,
    memoryGB: card.memoryGB,
    platformPriceCount: cardListPrices.length,
    activePlatformPriceCount: activeRecords.length,
    priceSummary: formatPriceSummary(
      hourPrices.length > 0 ? hourPrices : cardRecords.map((r) => r.sellPrice),
    ),
    productLinesLabel:
      configuredLines.size > 0 ? [...configuredLines].join('、') : '未配置',
    datacenterCount,
  }
}

async function assertCardTypeExists(gpuCardTypeId: string) {
  const card = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.id, gpuCardTypeId),
    columns: { id: true, name: true, status: true },
  })
  if (!card) {
    throw new Error('GPU 卡型不存在')
  }
  if (card.status !== 'active') {
    throw new Error('该 GPU 卡型已禁用，无法配置平台价')
  }
  return card
}


export const platformPricingDbDataAccess = {
  async listRecordsForCardType(gpuCardTypeId: string): Promise<PlatformCardPriceRecord[]> {
    const cardRow = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, gpuCardTypeId),
      columns: { name: true },
    })
    if (!cardRow) {
      throw new Error('GPU 卡型不存在')
    }

    const listPrices = await db
      .select()
      .from(platformCardListPrice)
      .where(eq(platformCardListPrice.gpuCardTypeId, gpuCardTypeId))
      .orderBy(desc(platformCardListPrice.effectiveFrom))

    const records = await db
      .select()
      .from(platformCardPriceRecord)
      .where(eq(platformCardPriceRecord.gpuCardTypeId, gpuCardTypeId))

    return buildRecordsFromListPrices(listPrices, records, cardRow.name)
  },

  async getDetailPage(gpuCardTypeId: string): Promise<PlatformPricingDetailPageData | null> {
    const cardRow = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, gpuCardTypeId),
    })
    if (!cardRow) {
      return null
    }

    const card = mapGpuCardTypeRow(cardRow)
    const platformRecords = await this.listRecordsForCardType(gpuCardTypeId)

    const [historyRow] = await db
      .select({ total: count() })
      .from(platformCardPriceHistory)
      .where(eq(platformCardPriceHistory.gpuCardTypeId, gpuCardTypeId))

    platformPricingLog('getDetailPage', 'loaded', {
      gpuCardTypeId,
      recordVersions: platformRecords.length,
      historyCount: Number(historyRow?.total ?? 0),
    })

    return buildDetailPageDataForCard(
      card,
      platformRecords,
      [],
      Number(historyRow?.total ?? 0),
    )
  },

  async listHistory(gpuCardTypeId: string): Promise<PlatformCardPriceHistory[]> {
    const cardRow = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, gpuCardTypeId),
      columns: { name: true },
    })
    if (!cardRow) {
      throw new Error('GPU 卡型不存在')
    }

    const rows = await db
      .select({
        history: platformCardPriceHistory,
        changedByName: userStaff.displayName,
      })
      .from(platformCardPriceHistory)
      .leftJoin(userStaff, eq(platformCardPriceHistory.changedByStaffId, userStaff.id))
      .where(eq(platformCardPriceHistory.gpuCardTypeId, gpuCardTypeId))
      .orderBy(desc(platformCardPriceHistory.changedAt))

    return rows.map(({ history, changedByName }) =>
      mapHistoryRow(history, cardRow.name, changedByName),
    )
  },

  async listRecords(): Promise<PlatformCardPriceRecord[]> {
    const rows = await db
      .select({
        record: platformCardPriceRecord,
        listPrice: platformCardListPrice,
        cardTypeName: gpuCardType.name,
      })
      .from(platformCardPriceRecord)
      .innerJoin(gpuCardType, eq(platformCardPriceRecord.gpuCardTypeId, gpuCardType.id))
      .leftJoin(
        platformCardListPrice,
        eq(platformCardPriceRecord.platformCardListPriceId, platformCardListPrice.id),
      )
      .orderBy(gpuCardType.name, platformCardPriceRecord.productLine)

    return rows.map(({ record, listPrice, cardTypeName }) =>
      mapRecordRow(record, listPrice, cardTypeName),
    )
  },

  async getListPage(): Promise<PlatformPricingListPageData> {
    const cardRows = await db
      .select()
      .from(gpuCardType)
      .where(eq(gpuCardType.status, 'active'))
      .orderBy(gpuCardType.name)

    const recordRows = await db
      .select({
        record: platformCardPriceRecord,
        listPrice: platformCardListPrice,
        cardTypeName: gpuCardType.name,
      })
      .from(platformCardPriceRecord)
      .innerJoin(gpuCardType, eq(platformCardPriceRecord.gpuCardTypeId, gpuCardType.id))
      .leftJoin(
        platformCardListPrice,
        eq(platformCardPriceRecord.platformCardListPriceId, platformCardListPrice.id),
      )

    const listPriceRows = await db.select().from(platformCardListPrice)

    const dcCountRows = await db
      .select({
        gpuCardTypeId: supplierGpuInventory.gpuCardTypeId,
        total: count(sql`DISTINCT ${supplierGpuInventory.dataCenterId}`),
      })
      .from(supplierGpuInventory)
      .groupBy(supplierGpuInventory.gpuCardTypeId)

    const dcCountMap = new Map(
      dcCountRows.map((row) => [row.gpuCardTypeId, Number(row.total ?? 0)]),
    )

    const records = recordRows.map(({ record, listPrice, cardTypeName }) =>
      mapRecordRow(record, listPrice, cardTypeName),
    )

    const cards = cardRows.map(mapGpuCardTypeRow)
    const rows = cards.map((card) =>
      buildCardTypeListRow(
        card,
        records,
        listPriceRows,
        dcCountMap.get(card.id) ?? 0,
      ),
    )

    platformPricingLog('listPage', 'loaded', {
      cardTypeCount: cards.length,
      recordCount: records.length,
    })

    return {
      stats: {
        cardTypeCount: cards.length,
        activePlatformPriceCount: records.filter((r) => r.status === 'active').length,
        datacenterCardPairCount: dcCountRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        sellPriceEntryCount: 0,
      },
      rows,
    }
  },

  async createPrice(input: PlatformPriceUpsertInput): Promise<PlatformCardPriceRecord> {
    const card = await assertCardTypeExists(input.gpuCardTypeId)

    const duplicate = await db.query.platformCardPriceRecord.findFirst({
      where: and(
        eq(platformCardPriceRecord.gpuCardTypeId, input.gpuCardTypeId),
        eq(platformCardPriceRecord.productLine, input.productLine),
        eq(platformCardPriceRecord.billingUnit, input.billingUnit),
      ),
      columns: { id: true },
    })
    if (duplicate) {
      throw new Error('该产品线与租期已有平台价，请编辑现有记录')
    }

    const listPriceId = newId()
    const recordId = newId()
    const sellPrice = input.sellPrice.toFixed(4)

    await db.transaction(async (tx) => {
      await tx.insert(platformCardListPrice).values({
        id: listPriceId,
        gpuCardTypeId: input.gpuCardTypeId,
        productLine: input.productLine,
        billingUnit: input.billingUnit,
        sellPrice,
        currency: 'CNY',
        effectiveFrom: normalizePlatformDateTime(input.effectiveFrom),
        effectiveTo: null,
        status: input.status,
        remark: input.remark?.trim() || null,
      })

      await tx.insert(platformCardPriceRecord).values({
        id: recordId,
        gpuCardTypeId: input.gpuCardTypeId,
        productLine: input.productLine,
        billingUnit: input.billingUnit,
        sellPrice,
        platformCardListPriceId: listPriceId,
        effectiveFrom: normalizePlatformDateTime(input.effectiveFrom),
        updatedByStaffId: input.changedByStaffId ?? null,
      })

      await insertPriceHistory(tx, {
        priceRecordId: recordId,
        gpuCardTypeId: input.gpuCardTypeId,
        productLine: input.productLine,
        billingUnit: input.billingUnit,
        previousSellPrice: null,
        newSellPrice: sellPrice,
        reason: input.remark,
        changedByStaffId: input.changedByStaffId,
      })
    })

    platformPricingLog('createPrice', 'success', {
      recordId,
      gpuCardTypeId: input.gpuCardTypeId,
      productLine: input.productLine,
      billingUnit: input.billingUnit,
    })

    const record = await db.query.platformCardPriceRecord.findFirst({
      where: eq(platformCardPriceRecord.id, recordId),
    })
    const listPrice = await db.query.platformCardListPrice.findFirst({
      where: eq(platformCardListPrice.id, listPriceId),
    })
    if (!record) {
      throw new Error('创建平台价后读取失败')
    }

    return mapRecordRow(record, listPrice ?? null, card.name)
  },

  async updatePrice(input: PlatformPriceUpdateInput): Promise<PlatformCardPriceRecord> {
    const card = await assertCardTypeExists(input.gpuCardTypeId)

    const existingRecord = await db.query.platformCardPriceRecord.findFirst({
      where: eq(platformCardPriceRecord.id, input.recordId),
    })
    if (!existingRecord) {
      throw new Error('平台价记录不存在')
    }

    if (
      existingRecord.gpuCardTypeId !== input.gpuCardTypeId ||
      existingRecord.productLine !== input.productLine ||
      existingRecord.billingUnit !== input.billingUnit
    ) {
      throw new Error('平台价维度不可变更')
    }

    const listPriceId = newId()
    const sellPrice = input.sellPrice.toFixed(4)
    const previousSellPrice = existingRecord.sellPrice
    const closeDate = secondBeforePlatformDateTime(input.effectiveFrom)

    await db.transaction(async (tx) => {
      if (existingRecord.platformCardListPriceId) {
        await tx
          .update(platformCardListPrice)
          .set({ effectiveTo: closeDate })
          .where(
            and(
              eq(platformCardListPrice.id, existingRecord.platformCardListPriceId),
              isNull(platformCardListPrice.effectiveTo),
            ),
          )
      }

      await tx
        .update(platformCardListPrice)
        .set({ effectiveTo: closeDate })
        .where(
          and(
            eq(platformCardListPrice.gpuCardTypeId, input.gpuCardTypeId),
            eq(platformCardListPrice.productLine, input.productLine),
            eq(platformCardListPrice.billingUnit, input.billingUnit),
            isNull(platformCardListPrice.effectiveTo),
            eq(platformCardListPrice.status, 'active'),
          ),
        )

      await tx.insert(platformCardListPrice).values({
        id: listPriceId,
        gpuCardTypeId: input.gpuCardTypeId,
        productLine: input.productLine,
        billingUnit: input.billingUnit,
        sellPrice,
        currency: 'CNY',
        effectiveFrom: normalizePlatformDateTime(input.effectiveFrom),
        effectiveTo: null,
        status: input.status,
        remark: input.remark?.trim() || null,
        updatedByStaffId: input.changedByStaffId ?? null,
      })

      await tx
        .update(platformCardPriceRecord)
        .set({
          sellPrice,
          platformCardListPriceId: listPriceId,
          effectiveFrom: normalizePlatformDateTime(input.effectiveFrom),
          updatedByStaffId: input.changedByStaffId ?? null,
        })
        .where(eq(platformCardPriceRecord.id, input.recordId))

      await insertPriceHistory(tx, {
        priceRecordId: input.recordId,
        gpuCardTypeId: input.gpuCardTypeId,
        productLine: input.productLine,
        billingUnit: input.billingUnit,
        previousSellPrice,
        newSellPrice: sellPrice,
        reason: input.remark,
        changedByStaffId: input.changedByStaffId,
      })
    })

    platformPricingLog('updatePrice', 'success', { recordId: input.recordId })

    const record = await db.query.platformCardPriceRecord.findFirst({
      where: eq(platformCardPriceRecord.id, input.recordId),
    })
    const listPrice = await db.query.platformCardListPrice.findFirst({
      where: eq(platformCardListPrice.id, listPriceId),
    })
    if (!record) {
      throw new Error('更新平台价后读取失败')
    }

    return mapRecordRow(record, listPrice ?? null, card.name)
  },
}
