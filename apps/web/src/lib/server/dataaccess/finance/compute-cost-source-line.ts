import { db } from '@/lib/db'
import { toHoursString } from '@/lib/finance/cost-row-utils'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import {
  billingPeriodCostSourceLine,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawTenantBill,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { computeBaremetalCardHours } from './baremetal-card-hours'
import { parseDeviceModel, parsePurchaseQty } from './baremetal-order-parse'
import {
  loadCostMasterDataContext,
  resolveDataCenterByName,
  resolveDataCenterByContainerRegion,
  resolveGpuCardType,
  type CostMasterDataContext,
} from './cost-master-data'
import {
  loadResolvedPricingMap,
  pricingRefKey,
  pricingRefsFromResolved,
  sourceLineHasPricingConfig,
} from './cost-pricing-resolve'
import type { ResolvedUnitCost } from './tenant-bill-pricing'
import {
  resolveCostTenantBindings,
  splitTenantBindingToStaff,
  type CostTenantProjectBinding,
} from './cost-tenant-resolve'
import { asOfFromOrderedAt } from './platform-list-price'
import type { ComputeCostMode } from './compute-cost-mode'
import { financeLog } from './logger'
import { newId } from './operation-log'
import { listTenantBillWindows } from './tenant-bill-windows'

function parseNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

type SourceLineInsert = typeof billingPeriodCostSourceLine.$inferInsert

function scaleMetrics(input: {
  totalConsumption: number
  voucherConsumption: number
  balanceConsumption: number
  totalCardHours: number
  voucherCardHours: number
  balanceCardHours: number
  ratio: number
}) {
  const { ratio } = input
  return {
    totalConsumption: input.totalConsumption * ratio,
    voucherConsumption: input.voucherConsumption * ratio,
    balanceConsumption: input.balanceConsumption * ratio,
    totalCardHours: input.totalCardHours * ratio,
    voucherCardHours: input.voucherCardHours * ratio,
    balanceCardHours: input.balanceCardHours * ratio,
  }
}

function buildFlexSourceLines(input: {
  periodId: string
  windowId: string
  windowEnd: string
  rows: (typeof billingPeriodRawTenantBill.$inferSelect)[]
  bindingsByTenant: Map<string, CostTenantProjectBinding>
  masterCtx: CostMasterDataContext
  pricingMap: Map<string, ResolvedUnitCost>
  issues: string[]
}): SourceLineInsert[] {
  const lines: SourceLineInsert[] = []

  for (const row of input.rows) {
    const binding = input.bindingsByTenant.get(row.tenantPlatformId)
    if (!binding) continue
    const staffSplits = splitTenantBindingToStaff(binding, input.issues)
    if (staffSplits.length === 0) continue

    const dc = resolveDataCenterByContainerRegion(input.masterCtx, row.regionCode)
    const card = resolveGpuCardType(input.masterCtx, row.gpuModel)
    if (!dc) {
      input.issues.push(`tenant_bill ${row.id} 区域 ${row.regionCode} 无法匹配机房`)
      continue
    }
    if (!card) {
      input.issues.push(`tenant_bill ${row.id} 卡型 ${row.gpuModel} 无法匹配`)
      continue
    }

    const baseMetrics = {
      totalConsumption: parseNum(row.totalConsumption),
      voucherConsumption: parseNum(row.voucherConsumption),
      balanceConsumption: parseNum(row.balanceConsumption),
      totalCardHours: parseNum(row.totalCardHours),
      voucherCardHours: parseNum(row.voucherCardHours),
      balanceCardHours: parseNum(row.balanceCardHours),
    }

    for (const split of staffSplits) {
      const metrics = scaleMetrics({ ...baseMetrics, ratio: split.ratio })
      const pricing = input.pricingMap.get(
        pricingRefKey(dc.id, card.id, input.windowEnd),
      )
      const pricingRefs = pricingRefsFromResolved(pricing)
      lines.push({
        id: newId(),
        billingPeriodId: input.periodId,
        kind: 'flex',
        sourceRawId: row.id,
        tenantId: split.tenantId,
        tenantPlatformId: row.tenantPlatformId,
        projectId: split.projectId,
        staffId: split.staffId,
        staffName: split.staffName,
        dataCenterId: dc.id,
        dataCenterName: dc.name,
        gpuCardTypeId: card.id,
        gpuCardTypeName: card.name,
        totalConsumption: toMoneyString(metrics.totalConsumption),
        voucherConsumption: toMoneyString(metrics.voucherConsumption),
        balanceConsumption: toMoneyString(metrics.balanceConsumption),
        totalCardHours: toHoursString(metrics.totalCardHours),
        voucherCardHours: toHoursString(metrics.voucherCardHours),
        balanceCardHours: toHoursString(metrics.balanceCardHours),
        ...pricingRefs,
        windowId: input.windowId,
        sourceMeta: {
          region_code: row.regionCode,
          gpu_model: row.gpuModel,
          window_id: input.windowId,
        },
      })
    }
  }

  return lines
}

function buildBaremetalSourceLines(input: {
  periodId: string
  rows: (typeof billingPeriodRawBaremetalOrder.$inferSelect)[]
  bindingsByTenant: Map<string, CostTenantProjectBinding>
  masterCtx: CostMasterDataContext
  pricingMap: Map<string, ResolvedUnitCost>
  issues: string[]
}): SourceLineInsert[] {
  const lines: SourceLineInsert[] = []

  for (const row of input.rows) {
    const binding = input.bindingsByTenant.get(row.tenantPlatformId)
    if (!binding) continue
    const staffSplits = splitTenantBindingToStaff(binding, input.issues)
    if (staffSplits.length === 0) continue

    const device = parseDeviceModel(row.deviceModel)
    const purchase = parsePurchaseQty(row.purchaseQtyText)
    if (!device || !purchase) {
      input.issues.push(
        `裸金属订单 ${row.orderId} 无法解析型号或购买数量（device_model=${row.deviceModel ?? ''}, purchase=${row.purchaseQtyText ?? ''}）`,
      )
      continue
    }

    const dc = resolveDataCenterByName(input.masterCtx, row.idcName ?? '')
    const card = resolveGpuCardType(input.masterCtx, device.cardCode)
    if (!dc) {
      input.issues.push(`裸金属订单 ${row.orderId} 机房 ${row.idcName ?? ''} 无法匹配`)
      continue
    }
    if (!card) {
      input.issues.push(`裸金属订单 ${row.orderId} 卡型 ${device.cardCode} 无法匹配`)
      continue
    }

    const deviceQty = row.deviceQty ?? 1
    if (deviceQty <= 0) {
      input.issues.push(`裸金属订单 ${row.orderId} 设备数量无效`)
      continue
    }

    const cardHours = computeBaremetalCardHours({
      deviceQty,
      cardCount: device.cardCount,
      packageQty: purchase.qty,
      billingUnit: purchase.billingUnit,
    })
    const finalAmount = parseNum(row.finalAmount)
    const baseMetrics = {
      totalConsumption: finalAmount,
      voucherConsumption: 0,
      balanceConsumption: finalAmount,
      totalCardHours: cardHours,
      voucherCardHours: 0,
      balanceCardHours: cardHours,
    }

    for (const split of staffSplits) {
      const metrics = scaleMetrics({ ...baseMetrics, ratio: split.ratio })
      const pricingAsOf = asOfFromOrderedAt(row.orderedAt)
      const pricing = input.pricingMap.get(
        pricingRefKey(dc.id, card.id, pricingAsOf),
      )
      const pricingRefs = pricingRefsFromResolved(pricing)
      lines.push({
        id: newId(),
        billingPeriodId: input.periodId,
        kind: 'baremetal',
        sourceRawId: row.id,
        tenantId: split.tenantId,
        tenantPlatformId: row.tenantPlatformId,
        projectId: split.projectId,
        staffId: split.staffId,
        staffName: split.staffName,
        dataCenterId: dc.id,
        dataCenterName: dc.name,
        gpuCardTypeId: card.id,
        gpuCardTypeName: card.name,
        totalConsumption: toMoneyString(metrics.totalConsumption),
        voucherConsumption: toMoneyString(metrics.voucherConsumption),
        balanceConsumption: toMoneyString(metrics.balanceConsumption),
        totalCardHours: toHoursString(metrics.totalCardHours),
        voucherCardHours: toHoursString(metrics.voucherCardHours),
        balanceCardHours: toHoursString(metrics.balanceCardHours),
        ...pricingRefs,
        windowId: null,
        sourceMeta: {
          order_id: row.orderId,
          device_model: row.deviceModel,
          device_qty: deviceQty,
          purchase_qty_text: row.purchaseQtyText,
          idc_name: row.idcName,
          card_count_per_device: device.cardCount,
          pricing_as_of: pricingAsOf,
          ordered_at: row.orderedAt.toISOString(),
        },
      })
    }
  }

  return lines
}

export async function persistCostSourceLines(input: {
  billingPeriodId: string
  tenantPlatformIds: string[]
  periodEnd: string
  issues: string[]
  mode?: ComputeCostMode
}): Promise<number> {
  const { billingPeriodId: periodId, issues, mode = 'create' } = input
  financeLog('compute-cost-source-line', 'start', { periodId })

  const masterCtx = await loadCostMasterDataContext()
  const bindings = await resolveCostTenantBindings({
    billingPeriodId: periodId,
    tenantPlatformIds: input.tenantPlatformIds,
    periodEnd: input.periodEnd,
  })
  const bindingsByTenant = new Map(bindings.map((b) => [b.tenantPlatformId, b]))

  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const tenantBillBatches = batches.filter((b) => b.fileType === 'tenant_bill')
  const baremetalBatch = batches.find((b) => b.fileType === 'baremetal_order')
  const windows = await listTenantBillWindows(periodId)

  const unitCostPairs: { dataCenterId: string; gpuCardTypeId: string; asOfDate: string }[] =
    []

  for (const window of windows) {
    const batch = tenantBillBatches.find((b) => b.windowId === window.id)
    if (!batch) continue
    const rows = await db
      .select()
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
    const flexAsOf = mode === 'regenerate' ? input.periodEnd : window.windowEnd
    for (const row of rows) {
      const dc = resolveDataCenterByContainerRegion(masterCtx, row.regionCode)
      const card = resolveGpuCardType(masterCtx, row.gpuModel)
      if (dc && card) {
        unitCostPairs.push({
          dataCenterId: dc.id,
          gpuCardTypeId: card.id,
          asOfDate: flexAsOf,
        })
      }
    }
  }

  if (baremetalBatch) {
    const baremetalRows = await db
      .select()
      .from(billingPeriodRawBaremetalOrder)
      .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id))
    for (const row of baremetalRows) {
      const device = parseDeviceModel(row.deviceModel)
      if (!device) continue
      const dc = resolveDataCenterByName(masterCtx, row.idcName ?? '')
      const card = resolveGpuCardType(masterCtx, device.cardCode)
      if (dc && card) {
        unitCostPairs.push({
          dataCenterId: dc.id,
          gpuCardTypeId: card.id,
          asOfDate: asOfFromOrderedAt(row.orderedAt),
        })
      }
    }
  }

  const { map: pricingMap } = await loadResolvedPricingMap({ pairs: unitCostPairs })
  const lines: SourceLineInsert[] = []

  for (const window of windows) {
    const batch = tenantBillBatches.find((b) => b.windowId === window.id)
    if (!batch) continue
    const rows = await db
      .select()
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
    lines.push(
      ...buildFlexSourceLines({
        periodId,
        windowId: window.id,
        windowEnd: mode === 'regenerate' ? input.periodEnd : window.windowEnd,
        rows,
        bindingsByTenant,
        masterCtx,
        pricingMap,
        issues,
      }),
    )
  }

  if (baremetalBatch) {
    const baremetalRows = await db
      .select()
      .from(billingPeriodRawBaremetalOrder)
      .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id))
    lines.push(
      ...buildBaremetalSourceLines({
        periodId,
        rows: baremetalRows,
        bindingsByTenant,
        masterCtx,
        pricingMap,
        issues,
      }),
    )
  }

  for (const line of lines) {
    if (!sourceLineHasPricingConfig(line) && line.staffId) {
      issues.push(
        `缺成本配置 staff=${line.staffId} dc=${line.dataCenterId} card=${line.gpuCardTypeId}`,
      )
    }
  }

  const validLines = lines.filter(
    (l) =>
      l.staffId &&
      l.dataCenterId &&
      l.gpuCardTypeId &&
      sourceLineHasPricingConfig(l),
  )
  if (validLines.length > 0) {
    await db.insert(billingPeriodCostSourceLine).values(validLines)
  }

  financeLog('compute-cost-source-line', 'done', { periodId, count: validLines.length })
  return validLines.length
}
