import { db } from '@/lib/db'
import {
  billingPeriodCostBaremetalAgg,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  type CostBaremetalPackageBreakdownEntry,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { toHoursString } from '@/lib/finance/cost-row-utils'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import { computeBaremetalCardHours } from './baremetal-card-hours'
import {
  normalizeBaremetalRegion,
  parseDeviceModel,
  parsePurchaseQty,
} from './baremetal-order-parse'
import { financeLog } from './logger'
import { newId } from './operation-log'

type BaremetalAggAccumulator = {
  id: string
  billingPeriodId: string
  tenantPlatformId: string
  idcCode: string
  idcName: string | null
  cardType: string
  deviceQtyTotal: number
  cardCountPerDevice: number
  totalGpuCards: number
  packageQtyTotal: number
  billingUnit: string | null
  packageBreakdown: CostBaremetalPackageBreakdownEntry[]
  balanceCardHours: number
  balanceConsumption: number
  orderCount: number
  sourceOrderIds: string[]
}

function baremetalAggKey(tenantPlatformId: string, idcCode: string, cardType: string): string {
  return `${tenantPlatformId}::${idcCode}::${cardType}`
}

function parseNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

function newAccumulator(input: {
  periodId: string
  tenantPlatformId: string
  idcCode: string
  idcName: string | null
  cardType: string
  cardCountPerDevice: number
}): BaremetalAggAccumulator {
  return {
    id: newId(),
    billingPeriodId: input.periodId,
    tenantPlatformId: input.tenantPlatformId,
    idcCode: input.idcCode,
    idcName: input.idcName,
    cardType: input.cardType,
    deviceQtyTotal: 0,
    cardCountPerDevice: input.cardCountPerDevice,
    totalGpuCards: 0,
    packageQtyTotal: 0,
    billingUnit: null,
    packageBreakdown: [],
    balanceCardHours: 0,
    balanceConsumption: 0,
    orderCount: 0,
    sourceOrderIds: [],
  }
}

export async function aggregateBaremetalOrders(input: {
  billingPeriodId: string
  issues: string[]
}): Promise<Map<string, BaremetalAggAccumulator>> {
  const { billingPeriodId: periodId, issues } = input

  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const baremetalBatch = batches.find((b) => b.fileType === 'baremetal_order')
  if (!baremetalBatch) {
    financeLog('compute-cost-baremetal', 'no baremetal batch', { periodId })
    return new Map()
  }

  const rows = await db
    .select()
    .from(billingPeriodRawBaremetalOrder)
    .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id))

  const bucket = new Map<string, BaremetalAggAccumulator>()

  for (const row of rows) {
    const device = parseDeviceModel(row.deviceModel)
    const purchase = parsePurchaseQty(row.purchaseQtyText)
    if (!device || !purchase) {
      issues.push(
        `裸金属订单 ${row.orderId} 无法解析型号或购买数量（device_model=${row.deviceModel ?? ''}, purchase=${row.purchaseQtyText ?? ''}）`,
      )
      continue
    }

    const idcCode = normalizeBaremetalRegion(row.idcName)
    if (!idcCode) {
      issues.push(`裸金属订单 ${row.orderId} 缺少机房信息`)
      continue
    }

    const deviceQty = row.deviceQty ?? 1
    if (deviceQty <= 0) {
      issues.push(`裸金属订单 ${row.orderId} 设备数量无效`)
      continue
    }

    const cardHours = computeBaremetalCardHours({
      deviceQty,
      cardCount: device.cardCount,
      packageQty: purchase.qty,
      billingUnit: purchase.billingUnit,
    })

    const key = baremetalAggKey(row.tenantPlatformId, idcCode, device.cardCode)
    let acc = bucket.get(key)
    if (!acc) {
      acc = newAccumulator({
        periodId,
        tenantPlatformId: row.tenantPlatformId,
        idcCode,
        idcName: row.idcName,
        cardType: device.cardCode,
        cardCountPerDevice: device.cardCount,
      })
      bucket.set(key, acc)
    } else if (acc.cardCountPerDevice !== device.cardCount) {
      issues.push(
        `裸金属租户 ${row.tenantPlatformId} ${idcCode}×${device.cardCode} 单机卡数不一致，取首条 ${acc.cardCountPerDevice}`,
      )
    }

    acc.deviceQtyTotal += deviceQty
    acc.totalGpuCards += deviceQty * device.cardCount
    acc.packageQtyTotal += purchase.qty
    acc.balanceCardHours += cardHours
    acc.balanceConsumption += parseNum(row.finalAmount)
    acc.orderCount += 1
    acc.sourceOrderIds.push(row.orderId)

    if (acc.billingUnit == null) {
      acc.billingUnit = purchase.billingUnit
    } else if (acc.billingUnit !== purchase.billingUnit) {
      acc.billingUnit = 'mixed'
    }

    const breakdownEntry = acc.packageBreakdown.find(
      (e) => e.billing_unit === purchase.billingUnit,
    )
    if (breakdownEntry) {
      breakdownEntry.package_qty += purchase.qty
      breakdownEntry.device_qty += deviceQty
      breakdownEntry.card_hours += cardHours
    } else {
      acc.packageBreakdown.push({
        billing_unit: purchase.billingUnit,
        package_qty: purchase.qty,
        device_qty: deviceQty,
        card_hours: cardHours,
      })
    }
  }

  if (bucket.size > 0) {
    await db.insert(billingPeriodCostBaremetalAgg).values(
      [...bucket.values()].map((acc) => ({
        id: acc.id,
        billingPeriodId: acc.billingPeriodId,
        tenantPlatformId: acc.tenantPlatformId,
        idcCode: acc.idcCode,
        idcName: acc.idcName,
        cardType: acc.cardType,
        deviceQtyTotal: acc.deviceQtyTotal,
        cardCountPerDevice: acc.cardCountPerDevice,
        totalGpuCards: acc.totalGpuCards,
        packageQtyTotal: acc.packageQtyTotal.toFixed(4),
        billingUnit: acc.billingUnit,
        packageBreakdown: acc.packageBreakdown.length > 0 ? acc.packageBreakdown : null,
        balanceCardHours: toHoursString(acc.balanceCardHours),
        balanceConsumption: toMoneyString(acc.balanceConsumption),
        orderCount: acc.orderCount,
        sourceOrderIds: acc.sourceOrderIds,
      })),
    )
  }

  financeLog('compute-cost-baremetal', 'done', { periodId, aggCount: bucket.size })
  return bucket
}

export type { BaremetalAggAccumulator }
