import { db } from '@/lib/db'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { resolvePlatformListPriceAt } from '@/lib/server/dataaccess/finance/platform-list-price'
import type {
  MerchantPurchasePrice,
  MerchantRegionPricingCell,
  MerchantRegionPricingForm,
} from '@/lib/types/merchant'
import type { PlatformBillingUnit, PlatformProductLine } from '@/lib/types/platform-pricing'
import {
  dataCenter,
  gpuCardType,
  merchant,
  merchantPurchasePrice,
  merchantPurchasePriceRecord,
  userStaff,
} from '@workspace/db/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'

const REGION_PRICING_PRODUCT_LINES: PlatformProductLine[] = [
  'elastic_service',
  'cloud_vm',
  'job',
  'spot',
]

const DEFAULT_BILLING_UNIT: PlatformBillingUnit = 'hour'

function newId() {
  return crypto.randomUUID()
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value)
}

function toDateString(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function priceKey(
  gpuCardTypeId: string,
  productLine: PlatformProductLine,
  billingUnit: PlatformBillingUnit = DEFAULT_BILLING_UNIT,
): string {
  return `${gpuCardTypeId}:${productLine}:${billingUnit}`
}

async function resolveStaff(user: {
  id: string
  email?: string | null
  name?: string | null
}) {
  const staffId = await staffDataAccess.resolveStaffIdForAuthUser(user)
  if (!staffId) throw new Error('当前账号未关联员工信息')
  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { id: true, displayName: true },
  })
  if (!staff) throw new Error('员工信息不存在')
  return { staffId, displayName: staff.displayName }
}

async function assertMerchantAndDataCenter(merchantId: string, dataCenterId: string) {
  const [merchantRow] = await db
    .select({ id: merchant.id })
    .from(merchant)
    .where(eq(merchant.id, merchantId))
    .limit(1)
  if (!merchantRow) throw new Error('商户不存在')

  const [dcRow] = await db
    .select({ id: dataCenter.id })
    .from(dataCenter)
    .where(eq(dataCenter.id, dataCenterId))
    .limit(1)
  if (!dcRow) throw new Error('机房不存在')
}

export type MerchantRegionPricingUpsertItem = {
  gpuCardTypeId: string
  productLine: PlatformProductLine
  billingUnit?: PlatformBillingUnit
  purchasePrice: number
}

export const merchantPricingDataAccess = {
  async getRegionForm(input: {
    merchantId: string
    dataCenterId: string
    gpuCardTypeIds: string[]
    effectiveFrom: string
  }): Promise<MerchantRegionPricingForm> {
    await assertMerchantAndDataCenter(input.merchantId, input.dataCenterId)

    const cardTypeIds = [...new Set(input.gpuCardTypeIds.filter(Boolean))]
    if (cardTypeIds.length === 0) {
      return { effectiveFrom: input.effectiveFrom, cells: [] }
    }

    const cardRows = await db
      .select({ id: gpuCardType.id, name: gpuCardType.name })
      .from(gpuCardType)
      .where(inArray(gpuCardType.id, cardTypeIds))
      .orderBy(asc(gpuCardType.name))

    const cardNameById = new Map(cardRows.map((row) => [row.id, row.name]))

    const recordRows = await db
      .select()
      .from(merchantPurchasePriceRecord)
      .where(
        and(
          eq(merchantPurchasePriceRecord.merchantId, input.merchantId),
          eq(merchantPurchasePriceRecord.dataCenterId, input.dataCenterId),
          inArray(merchantPurchasePriceRecord.gpuCardTypeId, cardTypeIds),
        ),
      )

    const recordByKey = new Map(
      recordRows.map((row) => [
        priceKey(row.gpuCardTypeId, row.productLine as PlatformProductLine, row.billingUnit as PlatformBillingUnit),
        row,
      ]),
    )

    const effectiveFrom =
      recordRows.length > 0
        ? recordRows.reduce(
            (latest, row) =>
              toDateString(row.effectiveFrom) > latest ? toDateString(row.effectiveFrom) : latest,
            input.effectiveFrom,
          )
        : input.effectiveFrom

    const cells: MerchantRegionPricingCell[] = []

    for (const cardTypeId of cardTypeIds) {
      const cardTypeName = cardNameById.get(cardTypeId)
      if (!cardTypeName) continue

      for (const productLine of REGION_PRICING_PRODUCT_LINES) {
        const key = priceKey(cardTypeId, productLine)
        const record = recordByKey.get(key)
        const l1 = await resolvePlatformListPriceAt({
          gpuCardTypeId: cardTypeId,
          asOfDate: effectiveFrom,
          productLine,
          billingUnit: DEFAULT_BILLING_UNIT,
        })

        cells.push({
          gpuCardTypeId: cardTypeId,
          cardTypeName,
          productLine,
          billingUnit: DEFAULT_BILLING_UNIT,
          purchasePrice: record ? toNumber(record.purchasePrice) : null,
          platformListPrice: l1?.listPricePerHour ?? null,
          source: record ? (record.source as MerchantPurchasePrice['source']) : null,
        })
      }
    }

    return { effectiveFrom, cells }
  },

  async batchUpsertForRegion(
    input: {
      merchantId: string
      dataCenterId: string
      effectiveFrom: string
      items: MerchantRegionPricingUpsertItem[]
    },
    user: { id: string; email?: string | null; name?: string | null },
  ): Promise<void> {
    await assertMerchantAndDataCenter(input.merchantId, input.dataCenterId)
    if (input.items.length === 0) throw new Error('请至少填写一条进货价')

    const { staffId } = await resolveStaff(user)
    const effectiveFrom = input.effectiveFrom.trim()
    if (!effectiveFrom) throw new Error('请指定生效开始时间')

    const existingRecords = await db
      .select()
      .from(merchantPurchasePriceRecord)
      .where(
        and(
          eq(merchantPurchasePriceRecord.merchantId, input.merchantId),
          eq(merchantPurchasePriceRecord.dataCenterId, input.dataCenterId),
        ),
      )

    const existingRecordByKey = new Map(
      existingRecords.map((row) => [
        priceKey(row.gpuCardTypeId, row.productLine as PlatformProductLine, row.billingUnit as PlatformBillingUnit),
        row,
      ]),
    )

    const activePrices = await db
      .select()
      .from(merchantPurchasePrice)
      .where(
        and(
          eq(merchantPurchasePrice.merchantId, input.merchantId),
          eq(merchantPurchasePrice.dataCenterId, input.dataCenterId),
          eq(merchantPurchasePrice.status, 'active'),
        ),
      )

    const activePriceByKey = new Map(
      activePrices.map((row) => [
        priceKey(row.gpuCardTypeId, row.productLine as PlatformProductLine, row.billingUnit as PlatformBillingUnit),
        row,
      ]),
    )

    await db.transaction(async (tx) => {
      for (const item of input.items) {
        const billingUnit = item.billingUnit ?? DEFAULT_BILLING_UNIT
        const key = priceKey(item.gpuCardTypeId, item.productLine, billingUnit)
        const purchasePrice = item.purchasePrice.toFixed(4)

        const l1 = await resolvePlatformListPriceAt({
          gpuCardTypeId: item.gpuCardTypeId,
          asOfDate: effectiveFrom,
          productLine: item.productLine,
          billingUnit,
        })

        const source: MerchantPurchasePrice['source'] =
          l1 && Math.abs(item.purchasePrice - l1.listPricePerHour) < 0.0001
            ? 'inherit_l1'
            : 'manual'

        const existingRecord = existingRecordByKey.get(key)
        const existingActive = activePriceByKey.get(key)

        const unchanged =
          existingRecord &&
          toNumber(existingRecord.purchasePrice) === item.purchasePrice &&
          toDateString(existingRecord.effectiveFrom) === effectiveFrom &&
          existingRecord.source === source

        if (unchanged) continue

        if (existingActive) {
          const prevEffectiveFrom = toDateString(existingActive.effectiveFrom)
          if (prevEffectiveFrom !== effectiveFrom) {
            await tx
              .update(merchantPurchasePrice)
              .set({
                effectiveTo: addDays(effectiveFrom, -1),
                status: 'archived',
                updatedAt: new Date(),
              })
              .where(eq(merchantPurchasePrice.id, existingActive.id))
          } else {
            await tx
              .update(merchantPurchasePrice)
              .set({
                purchasePrice,
                source,
                platformListPriceId: l1?.platformCardListPriceId ?? null,
                updatedByStaffId: staffId,
                updatedAt: new Date(),
              })
              .where(eq(merchantPurchasePrice.id, existingActive.id))
          }
        }

        if (!existingActive || toDateString(existingActive.effectiveFrom) !== effectiveFrom) {
          await tx.insert(merchantPurchasePrice).values({
            id: newId(),
            merchantId: input.merchantId,
            dataCenterId: input.dataCenterId,
            gpuCardTypeId: item.gpuCardTypeId,
            productLine: item.productLine,
            billingUnit,
            purchasePrice,
            currency: 'CNY',
            source,
            platformListPriceId: l1?.platformCardListPriceId ?? null,
            effectiveFrom,
            effectiveTo: null,
            status: 'active',
            updatedByStaffId: staffId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        if (existingRecord) {
          await tx
            .update(merchantPurchasePriceRecord)
            .set({
              purchasePrice,
              source,
              platformListPriceId: l1?.platformCardListPriceId ?? null,
              effectiveFrom,
              updatedByStaffId: staffId,
              updatedAt: new Date(),
            })
            .where(eq(merchantPurchasePriceRecord.id, existingRecord.id))
        } else {
          await tx.insert(merchantPurchasePriceRecord).values({
            id: newId(),
            merchantId: input.merchantId,
            dataCenterId: input.dataCenterId,
            gpuCardTypeId: item.gpuCardTypeId,
            productLine: item.productLine,
            billingUnit,
            purchasePrice,
            platformListPriceId: l1?.platformCardListPriceId ?? null,
            source,
            effectiveFrom,
            updatedByStaffId: staffId,
            updatedAt: new Date(),
          })
        }
      }
    })
  },

  async listByMerchantId(merchantId: string): Promise<MerchantPurchasePrice[]> {
    const rows = await db
      .select({
        record: merchantPurchasePriceRecord,
        dataCenterName: dataCenter.name,
        cardTypeName: gpuCardType.name,
      })
      .from(merchantPurchasePriceRecord)
      .innerJoin(dataCenter, eq(merchantPurchasePriceRecord.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(merchantPurchasePriceRecord.gpuCardTypeId, gpuCardType.id))
      .where(eq(merchantPurchasePriceRecord.merchantId, merchantId))
      .orderBy(asc(dataCenter.name), asc(gpuCardType.name))

    const result: MerchantPurchasePrice[] = []
    for (const row of rows) {
      const l1 = await resolvePlatformListPriceAt({
        gpuCardTypeId: row.record.gpuCardTypeId,
        asOfDate: toDateString(row.record.effectiveFrom),
        productLine: row.record.productLine as PlatformProductLine,
        billingUnit: row.record.billingUnit as PlatformBillingUnit,
      })

      result.push({
        id: row.record.id,
        merchantId: row.record.merchantId,
        dataCenterId: row.record.dataCenterId,
        dataCenterName: row.dataCenterName,
        gpuCardTypeId: row.record.gpuCardTypeId,
        cardTypeName: row.cardTypeName,
        productLine: row.record.productLine as PlatformProductLine,
        billingUnit: row.record.billingUnit as PlatformBillingUnit,
        purchasePrice: toNumber(row.record.purchasePrice),
        platformListPrice: l1?.listPricePerHour,
        source: row.record.source as MerchantPurchasePrice['source'],
        status: 'active',
        effectiveFrom: toDateString(row.record.effectiveFrom),
      })
    }
    return result
  },
}
