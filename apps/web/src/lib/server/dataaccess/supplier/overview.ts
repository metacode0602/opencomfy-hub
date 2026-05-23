import { db } from '@/lib/db'
import type {
  OverviewFilterOptionsResult,
  OverviewFiltersInput,
  OverviewStatsResult,
} from '@/lib/types/supplier-overview-api'
import { supplierLog, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import {
  dataCenter,
  faultIncident,
  gpuCardType,
  internalTestHold,
  onboardingBatch,
  resourcePoolBinding,
  supplier,
  supplierDevice,
  supplierGpuInventory,
} from '@workspace/db/schema'
import { and, desc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'

const CLOSED_FAULT_STATUSES = ['已关闭', 'closed']
const TERMINAL_BATCH_STATUSES = ['已完成', '已取消']
const ONBOARDING_LIFECYCLES = ['待接入', '接入中'] as const
const LIFECYCLE_ORDER = ['待接入', '接入中', '在线', '维护中', '离线', '下线中'] as const

const BARE_METAL_ONBOARDING_OPS = ['网关直连裸金属上架中', '网关代理裸金属上架中'] as const
const OFFLINE_DELIVERY_OPS = ['线下裸金属交付中'] as const
const GATEWAY_ONBOARDING_OPS = ['网关节点上架中'] as const
const NOT_SELLABLE_OPS = ['不可调度节点运行中'] as const
const OTHER_DEPT_OPS = ['其他部门使用中'] as const
const RETIRED_OPS = ['已退订'] as const

function normalizeCardKey(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function regionFromDc(location: string | null, dcName: string): string {
  if (location?.trim()) return location.trim()
  if (dcName.includes('北京')) return '北京'
  if (dcName.includes('上海')) return '上海'
  if (dcName.includes('深圳') || dcName.includes('广州')) return '华南'
  if (dcName.includes('内蒙古')) return '内蒙古'
  return '其他'
}

function parseGpuScopeCount(scope: string | null, fallback = 4): number {
  if (!scope) return fallback
  const range = scope.match(/gpu\s*(\d+)\s*-\s*gpu\s*(\d+)/i)
  if (range) {
    const start = Number(range[1])
    const end = Number(range[2])
    return Math.max(0, end - start + 1)
  }
  const single = scope.match(/gpu\s*(\d+)/i)
  if (single) return 1
  return fallback
}

function isHoldActive(holdFrom: Date, holdUntil: Date | null, at = Date.now()): boolean {
  const from = holdFrom.getTime()
  const until = holdUntil?.getTime() ?? null
  if (at < from) return false
  if (until != null && at > until) return false
  return true
}

function isElasticPool(poolCode: string | null, workloadProfile: string): boolean {
  const code = (poolCode ?? '').toLowerCase()
  const profile = workloadProfile.toLowerCase()
  return code === 'platform' || profile === 'elastic_service'
}

function isBareMetalPool(poolCode: string | null, workloadProfile: string): boolean {
  const code = (poolCode ?? '').toLowerCase()
  const profile = workloadProfile.toLowerCase()
  return profile === 'bare_metal' || code.includes('bare')
}

type InventoryRow = {
  id: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  region: string
  cardTypeName: string
  cardTypeKey: string
  quantity: number
  onlineQuantity: number
  status: string
  isInternalTest: boolean
  internalTestScope: string | null
}

function matchesFilters(
  filters: OverviewFiltersInput,
  row: {
    supplierId: string
    region: string
    cardTypeKey: string
    deviceIdsInPool?: Set<string>
  },
  deviceId?: string,
): boolean {
  if (filters.supplierId !== 'all' && row.supplierId !== filters.supplierId) return false
  if (filters.region !== 'all' && row.region !== filters.region) return false
  if (filters.cardType !== 'all' && row.cardTypeKey !== normalizeCardKey(filters.cardType)) {
    return false
  }
  if (filters.poolCode !== 'all') {
    if (!deviceId || !row.deviceIdsInPool?.has(deviceId)) return false
  }
  return true
}

export const supplierOverviewDataAccess = {
  async getFilterOptions(): Promise<OverviewFilterOptionsResult> {
    supplierLog('overview', 'getFilterOptions start')

    try {
      const [supplierRows, invRows, poolRows] = await Promise.all([
        db
          .select({
            id: supplier.id,
            name: supplier.name,
            shortName: supplier.shortName,
          })
          .from(supplier)
          .where(eq(supplier.status, 'cooperating'))
          .orderBy(supplier.shortName),
        db
          .select({
            region: dataCenter.location,
            dcName: dataCenter.name,
            cardName: gpuCardType.name,
          })
          .from(supplierGpuInventory)
          .innerJoin(dataCenter, eq(supplierGpuInventory.dataCenterId, dataCenter.id))
          .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id)),
        db
          .select({ poolCode: resourcePoolBinding.poolCode })
          .from(resourcePoolBinding)
          .where(sql`${resourcePoolBinding.poolCode} is not null`),
      ])

      const regions = new Set<string>()
      const cardTypes = new Set<string>()
      for (const r of invRows) {
        regions.add(regionFromDc(r.region, r.dcName))
        if (r.cardName) cardTypes.add(r.cardName)
      }

      const poolCodes = new Set<string>()
      for (const p of poolRows) {
        if (p.poolCode) poolCodes.add(p.poolCode)
      }

      const result = {
        regions: Array.from(regions).sort(),
        suppliers: supplierRows.map((s) => ({
          id: s.id,
          name: s.name,
          shortName: s.shortName,
        })),
        cardTypes: Array.from(cardTypes).sort(),
        poolCodes: Array.from(poolCodes).sort(),
      }

      supplierLog('overview', 'getFilterOptions done', {
        suppliers: result.suppliers.length,
        regions: result.regions.length,
      })
      return result
    } catch (e) {
      supplierError('overview', 'getFilterOptions failed', e)
      throw e
    }
  },

  async getStats(filters: OverviewFiltersInput): Promise<OverviewStatsResult> {
    supplierLog('overview', 'getStats start', filters)

    try {
      const inventoryBase = await db
        .select({
          id: supplierGpuInventory.id,
          supplierId: supplierGpuInventory.supplierId,
          supplierName: supplier.shortName,
          supplierFullName: supplier.name,
          dataCenterId: supplierGpuInventory.dataCenterId,
          dataCenterName: dataCenter.name,
          region: dataCenter.location,
          cardTypeName: gpuCardType.name,
          quantity: supplierGpuInventory.quantity,
          onlineQuantity: supplierGpuInventory.onlineQuantity,
          status: supplierGpuInventory.status,
          isInternalTest: supplierGpuInventory.isInternalTest,
          internalTestScope: supplierGpuInventory.internalTestScope,
        })
        .from(supplierGpuInventory)
        .innerJoin(supplier, eq(supplierGpuInventory.supplierId, supplier.id))
        .innerJoin(dataCenter, eq(supplierGpuInventory.dataCenterId, dataCenter.id))
        .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id))

      const inventoryRows: InventoryRow[] = inventoryBase.map((r) => ({
        id: r.id,
        supplierId: r.supplierId,
        supplierName: r.supplierName ?? r.supplierFullName,
        dataCenterId: r.dataCenterId,
        dataCenterName: r.dataCenterName,
        region: regionFromDc(r.region, r.dataCenterName),
        cardTypeName: r.cardTypeName,
        cardTypeKey: normalizeCardKey(r.cardTypeName),
        quantity: r.quantity,
        onlineQuantity: r.onlineQuantity,
        status: r.status,
        isInternalTest: r.isInternalTest,
        internalTestScope: r.internalTestScope,
      }))

      const filteredInventory = inventoryRows.filter((row) =>
        matchesFilters(filters, {
          supplierId: row.supplierId,
          region: row.region,
          cardTypeKey: row.cardTypeKey,
        }),
      )

      const deviceRows = await db
        .select({
          id: supplierDevice.id,
          supplierId: supplierDevice.supplierId,
          dataCenterId: supplierDevice.dataCenterId,
          gpuCount: supplierDevice.gpuCount,
          lifecycleStatus: supplierDevice.lifecycleStatus,
          opsStatus: supplierDevice.opsStatus,
          inMaintenance: supplierDevice.inMaintenance,
          idcRegion: supplierDevice.idcRegion,
          cardTypeName: gpuCardType.name,
        })
        .from(supplierDevice)
        .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))

      const poolBindingRows = await db
        .select({
          deviceId: resourcePoolBinding.supplierDeviceId,
          poolCode: resourcePoolBinding.poolCode,
          workloadProfile: resourcePoolBinding.workloadProfile,
        })
        .from(resourcePoolBinding)

      const devicesByPool = new Map<string, Set<string>>()
      for (const b of poolBindingRows) {
        if (!b.poolCode) continue
        const set = devicesByPool.get(b.poolCode) ?? new Set<string>()
        set.add(b.deviceId)
        devicesByPool.set(b.poolCode, set)
      }

      const poolFilterDeviceIds =
        filters.poolCode !== 'all' ? devicesByPool.get(filters.poolCode) : undefined

      const filteredDevices = deviceRows.filter((d) => {
        const region = d.idcRegion ?? '其他'
        const cardKey = normalizeCardKey(d.cardTypeName)
        if (!matchesFilters(filters, { supplierId: d.supplierId, region, cardTypeKey: cardKey })) {
          return false
        }
        if (poolFilterDeviceIds && !poolFilterDeviceIds.has(d.id)) return false
        return true
      })

      const deviceById = new Map(filteredDevices.map((d) => [d.id, d]))

      const holds = await db
        .select({
          deviceId: internalTestHold.supplierDeviceId,
          inventoryId: internalTestHold.supplierGpuInventoryId,
          scope: internalTestHold.scope,
          holdFrom: internalTestHold.holdFrom,
          holdUntil: internalTestHold.holdUntil,
        })
        .from(internalTestHold)

      const openFaults = await db
        .select({
          id: faultIncident.id,
          supplierId: faultIncident.supplierId,
          supplierDeviceId: faultIncident.supplierDeviceId,
          severity: faultIncident.severity,
          faultType: faultIncident.faultType,
          incidentStatus: faultIncident.incidentStatus,
          openedAt: faultIncident.openedAt,
          closedAt: faultIncident.closedAt,
        })
        .from(faultIncident)
        .where(
          or(
            isNull(faultIncident.closedAt),
            notInArray(faultIncident.incidentStatus, CLOSED_FAULT_STATUSES),
          ),
        )

      const batchConditions = [
        inArray(onboardingBatch.batchKind, ['online', 'order_access']),
        notInArray(onboardingBatch.batchStatus, TERMINAL_BATCH_STATUSES),
      ]
      if (filters.supplierId !== 'all') {
        batchConditions.push(eq(onboardingBatch.supplierId, filters.supplierId))
      }
      if (filters.region !== 'all') {
        batchConditions.push(eq(onboardingBatch.idcRegion, filters.region))
      }

      const activeBatches = await db
        .select({
          id: onboardingBatch.id,
          batchCode: onboardingBatch.batchCode,
          batchKind: onboardingBatch.batchKind,
          supplierId: onboardingBatch.supplierId,
          supplierShortName: onboardingBatch.supplierShortName,
          supplierName: onboardingBatch.supplierName,
          dataCenterName: onboardingBatch.dataCenterName,
          importStatus: onboardingBatch.importStatus,
          batchStatus: onboardingBatch.batchStatus,
          plannedDeviceCount: onboardingBatch.plannedDeviceCount,
          touchedDeviceCount: onboardingBatch.touchedDeviceCount,
          onlineDeviceCount: onboardingBatch.onlineDeviceCount,
          plannedReadyAt: onboardingBatch.plannedReadyAt,
          workOrderNo: onboardingBatch.workOrderNo,
        })
        .from(onboardingBatch)
        .where(and(...batchConditions))
        .orderBy(desc(onboardingBatch.plannedReadyAt))
        .limit(20)

      const inventoryDtoRows = filteredInventory.map((row) => {
        const internalTestGpu = row.isInternalTest
          ? row.internalTestScope
            ? parseGpuScopeCount(row.internalTestScope, row.onlineQuantity)
            : Math.min(row.onlineQuantity, 8)
          : 0

        let holdTestGpu = 0
        for (const hold of holds) {
          if (!isHoldActive(hold.holdFrom, hold.holdUntil)) continue
          if (hold.inventoryId === row.id) {
            holdTestGpu += parseGpuScopeCount(hold.scope, 8)
          }
        }

        const totalInternalTest = internalTestGpu + holdTestGpu

        let faultDownGpu = 0
        if (row.status === 'maintenance') {
          faultDownGpu = Math.max(0, row.quantity - row.onlineQuantity)
        } else {
          for (const fault of openFaults) {
            if (fault.supplierId !== row.supplierId) continue
            if (!fault.supplierDeviceId) continue
            const dev = deviceById.get(fault.supplierDeviceId)
            if (!dev) continue
            if (normalizeCardKey(dev.cardTypeName) !== row.cardTypeKey) continue
            if (dev.dataCenterId !== row.dataCenterId) continue
            if (dev.lifecycleStatus === '在线') {
              faultDownGpu += dev.gpuCount
            }
          }
        }

        const maintenanceQuantity =
          row.status === 'maintenance'
            ? row.quantity
            : Math.max(0, row.quantity - row.onlineQuantity)

        let bareMetalQuantity = 0
        let elasticServiceQuantity = 0
        const poolCodes = new Set<string>()

        for (const d of filteredDevices) {
          if (d.supplierId !== row.supplierId || d.dataCenterId !== row.dataCenterId) continue
          if (normalizeCardKey(d.cardTypeName) !== row.cardTypeKey) continue
          for (const bind of poolBindingRows) {
            if (bind.deviceId !== d.id) continue
            if (bind.poolCode) poolCodes.add(bind.poolCode)
            if (isElasticPool(bind.poolCode, bind.workloadProfile)) {
              elasticServiceQuantity += d.gpuCount
            } else if (isBareMetalPool(bind.poolCode, bind.workloadProfile)) {
              bareMetalQuantity += d.gpuCount
            }
          }
        }

        const sellableQuantity = Math.max(
          0,
          row.onlineQuantity - totalInternalTest - faultDownGpu,
        )

        return {
          id: row.id,
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          dataCenterId: row.dataCenterId,
          dataCenterName: row.dataCenterName,
          region: row.region,
          cardTypeName: row.cardTypeName,
          quantity: row.quantity,
          onlineQuantity: row.onlineQuantity,
          maintenanceQuantity,
          internalTestGpu: totalInternalTest,
          sellableQuantity,
          offlineQuantity: Math.max(0, row.quantity - row.onlineQuantity),
          bareMetalQuantity,
          elasticServiceQuantity,
          status: row.status,
          poolCodes: Array.from(poolCodes),
        }
      })

      type SupplierAggRow = {
        supplierId: string
        supplierName: string
        regions: Set<string>
        totalGpu: number
        onlineGpu: number
        sellableGpu: number
        maintenanceGpu: number
        internalTestGpu: number
        bareMetalPoolGpu: number
        elasticServiceGpu: number
        pendingOnboardingGpu: number
        pendingRetireGpu: number
        offlineDeliveryGpu: number
        bareMetalOnboardingGpu: number
      }

      const supplierAgg = new Map<string, SupplierAggRow>()

      const ensureSupplierRow = (supplierId: string, supplierName: string): SupplierAggRow => {
        const existing = supplierAgg.get(supplierId)
        if (existing) return existing
        const row: SupplierAggRow = {
          supplierId,
          supplierName,
          regions: new Set<string>(),
          totalGpu: 0,
          onlineGpu: 0,
          sellableGpu: 0,
          maintenanceGpu: 0,
          internalTestGpu: 0,
          bareMetalPoolGpu: 0,
          elasticServiceGpu: 0,
          pendingOnboardingGpu: 0,
          pendingRetireGpu: 0,
          offlineDeliveryGpu: 0,
          bareMetalOnboardingGpu: 0,
        }
        supplierAgg.set(supplierId, row)
        return row
      }

      for (const inv of inventoryDtoRows) {
        const row = ensureSupplierRow(inv.supplierId, inv.supplierName)
        row.regions.add(inv.region)
        row.totalGpu += inv.quantity
        row.onlineGpu += inv.onlineQuantity
        row.sellableGpu += inv.sellableQuantity
        row.maintenanceGpu += inv.maintenanceQuantity
        row.internalTestGpu += inv.internalTestGpu
      }

      for (const d of filteredDevices) {
        const supplierName =
          inventoryDtoRows.find((r) => r.supplierId === d.supplierId)?.supplierName ??
          d.supplierId
        const row = ensureSupplierRow(d.supplierId, supplierName)
        if (d.idcRegion) row.regions.add(d.idcRegion)

        const gpu = d.gpuCount
        const isOnboardingLifecycle = ONBOARDING_LIFECYCLES.includes(
          d.lifecycleStatus as (typeof ONBOARDING_LIFECYCLES)[number],
        )
        if (
          isOnboardingLifecycle ||
          d.opsStatus === '预留闲置中' ||
          BARE_METAL_ONBOARDING_OPS.includes(
            d.opsStatus as (typeof BARE_METAL_ONBOARDING_OPS)[number],
          )
        ) {
          row.pendingOnboardingGpu += gpu
        }
        if (d.lifecycleStatus === '下线中' || RETIRED_OPS.includes(d.opsStatus as '已退订')) {
          row.pendingRetireGpu += gpu
        }
        if (
          OFFLINE_DELIVERY_OPS.includes(d.opsStatus as (typeof OFFLINE_DELIVERY_OPS)[number])
        ) {
          row.offlineDeliveryGpu += gpu
        }
        if (
          BARE_METAL_ONBOARDING_OPS.includes(
            d.opsStatus as (typeof BARE_METAL_ONBOARDING_OPS)[number],
          )
        ) {
          row.bareMetalOnboardingGpu += gpu
        }
        if (d.lifecycleStatus === '维护中' || d.inMaintenance) {
          row.maintenanceGpu += gpu
        }

        let countedElastic = false
        let countedBareMetal = false
        for (const bind of poolBindingRows) {
          if (bind.deviceId !== d.id) continue
          if (!countedElastic && isElasticPool(bind.poolCode, bind.workloadProfile)) {
            row.elasticServiceGpu += gpu
            countedElastic = true
          }
          if (!countedBareMetal && isBareMetalPool(bind.poolCode, bind.workloadProfile)) {
            row.bareMetalPoolGpu += gpu
            countedBareMetal = true
          }
        }
      }

      const openFaultsFiltered = openFaults.filter((f) => {
        if (filters.supplierId !== 'all' && f.supplierId !== filters.supplierId) return false
        return true
      })

      const faultCountBySupplier = new Map<string, number>()
      for (const f of openFaultsFiltered) {
        faultCountBySupplier.set(f.supplierId, (faultCountBySupplier.get(f.supplierId) ?? 0) + 1)
      }

      const batchCountBySupplier = new Map<string, number>()
      for (const b of activeBatches) {
        batchCountBySupplier.set(
          b.supplierId,
          (batchCountBySupplier.get(b.supplierId) ?? 0) + 1,
        )
      }

      const supplierRows = Array.from(supplierAgg.values())
        .map((row) => ({
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          regionCount: row.regions.size,
          totalGpu: row.totalGpu,
          onlineGpu: row.onlineGpu,
          sellableGpu: row.sellableGpu,
          activeBatches: batchCountBySupplier.get(row.supplierId) ?? 0,
          openFaults: faultCountBySupplier.get(row.supplierId) ?? 0,
          maintenanceGpu: row.maintenanceGpu,
          pendingOnboardingGpu: row.pendingOnboardingGpu,
          pendingRetireGpu: row.pendingRetireGpu,
          internalTestGpu: row.internalTestGpu,
          offlineDeliveryGpu: row.offlineDeliveryGpu,
          bareMetalOnboardingGpu: row.bareMetalOnboardingGpu,
          elasticServiceGpu: row.elasticServiceGpu,
          bareMetalPoolGpu: row.bareMetalPoolGpu,
        }))
        .sort((a, b) => b.sellableGpu - a.sellableGpu)

      const lifecycleBuckets: Record<string, { gpu: number; devices: number }> = {}
      for (const stage of LIFECYCLE_ORDER) {
        lifecycleBuckets[stage] = { gpu: 0, devices: 0 }
      }
      for (const d of filteredDevices) {
        const key =
          d.lifecycleStatus in lifecycleBuckets ? d.lifecycleStatus : '离线'
        const bucket = lifecycleBuckets[key]!
        bucket.gpu += d.gpuCount
        bucket.devices += 1
      }

      const lifecycleFunnel = LIFECYCLE_ORDER.map((stage) => ({
        stage,
        gpuCount: lifecycleBuckets[stage]?.gpu ?? 0,
        deviceCount: lifecycleBuckets[stage]?.devices ?? 0,
        warn: stage === '接入中' && (lifecycleBuckets[stage]?.devices ?? 0) > 0,
      }))

      const opsGroups: Record<string, { gpu: number; devices: number }> = {
        裸金属上架中: { gpu: 0, devices: 0 },
        线下交付: { gpu: 0, devices: 0 },
        网关上架: { gpu: 0, devices: 0 },
        其他: { gpu: 0, devices: 0 },
      }

      for (const d of filteredDevices) {
        if (RETIRED_OPS.includes(d.opsStatus as '已退订')) continue
        let group = '其他'
        if (
          BARE_METAL_ONBOARDING_OPS.includes(
            d.opsStatus as (typeof BARE_METAL_ONBOARDING_OPS)[number],
          )
        ) {
          group = '裸金属上架中'
        } else if (
          OFFLINE_DELIVERY_OPS.includes(d.opsStatus as (typeof OFFLINE_DELIVERY_OPS)[number])
        ) {
          group = '线下交付'
        } else if (
          GATEWAY_ONBOARDING_OPS.includes(
            d.opsStatus as (typeof GATEWAY_ONBOARDING_OPS)[number],
          )
        ) {
          group = '网关上架'
        }
        const bucket = opsGroups[group]!
        bucket.gpu += d.gpuCount
        bucket.devices += 1
      }

      const opsPipeline = Object.entries(opsGroups).map(([group, v]) => ({
        group,
        gpuCount: v.gpu,
        deviceCount: v.devices,
      }))

      const onboardingGpuFromDevices = filteredDevices
        .filter(
          (d) =>
            ONBOARDING_LIFECYCLES.includes(
              d.lifecycleStatus as (typeof ONBOARDING_LIFECYCLES)[number],
            ) ||
            BARE_METAL_ONBOARDING_OPS.includes(
              d.opsStatus as (typeof BARE_METAL_ONBOARDING_OPS)[number],
            ) ||
            OFFLINE_DELIVERY_OPS.includes(
              d.opsStatus as (typeof OFFLINE_DELIVERY_OPS)[number],
            ) ||
            GATEWAY_ONBOARDING_OPS.includes(
              d.opsStatus as (typeof GATEWAY_ONBOARDING_OPS)[number],
            ),
        )
        .reduce((s, d) => s + d.gpuCount, 0)

      const totalGpu = inventoryDtoRows.reduce((s, r) => s + r.quantity, 0)
      const onlineGpu = inventoryDtoRows.reduce((s, r) => s + r.onlineQuantity, 0)
      const maintenanceGpu = inventoryDtoRows.reduce((s, r) => s + r.maintenanceQuantity, 0)
      const internalTestGpu = inventoryDtoRows.reduce((s, r) => s + r.internalTestGpu, 0)
      const sellableGpu = inventoryDtoRows.reduce((s, r) => s + r.sellableQuantity, 0)

      let otherDeptGpu = 0
      for (const d of filteredDevices) {
        if (OTHER_DEPT_OPS.includes(d.opsStatus as (typeof OTHER_DEPT_OPS)[number])) {
          otherDeptGpu += d.gpuCount
        }
      }

      const kpis = {
        totalGpu,
        onlineGpu,
        onboardingGpu: onboardingGpuFromDevices,
        maintenanceGpu,
        internalTestGpu,
        sellableGpu: Math.max(0, sellableGpu - otherDeptGpu),
        faultOpenCount: openFaultsFiltered.length,
        activeTestHolds: holds.filter((h) => isHoldActive(h.holdFrom, h.holdUntil)).length,
        activeBatches: activeBatches.length,
      }

      const closedFaults = await db
        .select({
          openedAt: faultIncident.openedAt,
          closedAt: faultIncident.closedAt,
        })
        .from(faultIncident)
        .where(
          and(
            sql`${faultIncident.closedAt} is not null`,
            filters.supplierId !== 'all'
              ? eq(faultIncident.supplierId, filters.supplierId)
              : sql`true`,
          ),
        )
        .limit(200)

      let totalHours = 0
      let closedCount = 0
      for (const f of closedFaults) {
        if (!f.closedAt) continue
        const ms = f.closedAt.getTime() - f.openedAt.getTime()
        totalHours += ms / (1000 * 60 * 60)
        closedCount += 1
      }

      const faultSla = {
        openCount: openFaultsFiltered.length,
        p1Count: openFaultsFiltered.filter((f) => f.severity === 'P1').length,
        p2Count: openFaultsFiltered.filter((f) => f.severity === 'P2').length,
        avgResolutionHours: closedCount > 0 ? totalHours / closedCount : null,
        recentOpen: openFaultsFiltered
          .slice()
          .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
          .slice(0, 5)
          .map((f) => ({
            id: f.id,
            supplierId: f.supplierId,
            severity: f.severity,
            faultType: f.faultType,
            incidentStatus: f.incidentStatus,
            openedAt: f.openedAt.toISOString(),
          })),
      }

      const batchSummaries = activeBatches.map((b) => ({
        id: b.id,
        batchCode: b.batchCode,
        batchKind: b.batchKind,
        supplierName: b.supplierShortName ?? b.supplierName,
        dataCenterName: b.dataCenterName,
        importStatus: b.importStatus,
        batchStatus: b.batchStatus,
        plannedDeviceCount: b.plannedDeviceCount,
        touchedDeviceCount: b.touchedDeviceCount ?? 0,
        onlineDeviceCount: b.onlineDeviceCount ?? 0,
        plannedReadyAt: b.plannedReadyAt?.toISOString() ?? null,
        workOrderNo: b.workOrderNo,
      }))

      const result: OverviewStatsResult = {
        kpis,
        lifecycleFunnel,
        opsPipeline,
        supplierRows,
        inventoryRows: inventoryDtoRows,
        batchSummaries,
        faultSla,
      }

      supplierLog('overview', 'getStats done', {
        inventoryRows: inventoryDtoRows.length,
        supplierRows: supplierRows.length,
        totalGpu: kpis.totalGpu,
      })

      return result
    } catch (e) {
      supplierError('overview', 'getStats failed', e, filters)
      throw e
    }
  },
}
