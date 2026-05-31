import { db } from '@/lib/db'
import {
  aggregatePipelinePending,
  aggregatePipelinePendingByDataCenter,
  batchMatchesCardFilter,
  batchMatchesRegionFilter,
  BARE_METAL_DIRECT_OPS,
  BARE_METAL_PROXY_OPS,
  buildLifecycleFunnel,
  CLOSED_FAULT_STATUSES,
  computePendingAccessDataCenterIds,
  GATEWAY_ONBOARDING_OPS,
  isHoldActive,
  kpiFromDevices,
  LIFECYCLE_ORDER,
  NON_SCHEDULABLE_OPS,
  normalizeCardKey,
  normalizeLifecycleStage,
  OFFLINE_DELIVERY_OPS,
  isOtherDeptOpsStatus,
  parseGpuScopeCount,
  mergeKpiMetric,
  type PipelineBatchInput,
  regionFromDc,
  RESERVED_IDLE_OPS,
  TERMINAL_BATCH_STATUSES,
  toPipelineBatchInput,
  type OverviewDeviceRow,
} from '@/lib/server/aggregation/overview-aggregation'
import {
  aggregateRetirePipelinePending,
  buildResourceCompositionFromDevices,
} from '@/lib/server/aggregation/resource-composition-aggregation'
import { resolveGpuTargetGpu } from '@/lib/server/dataaccess/dashboard/gpu-target'
import {
  isDualPool,
  poolKindForFilterPoolCode,
  resolveDevicePoolMemberships,
  type ResourcePoolBindingLike,
} from '@/lib/supplier/device-pool-membership'
import {
  inventoryGpuQuantity,
  metricGpuCount,
  resolveGpuCardTypeRole,
} from '@/lib/supplier/gpu-card-type-metrics'
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
  internalTestHoldDeviceLink,
  onboardingBatch,
  onboardingBatchDeviceLink,
  resourcePoolBinding,
  supplier,
  supplierDevice,
  supplierGpuInventory,
} from '@workspace/db/schema'
import { and, desc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'

type DeviceRow = OverviewDeviceRow

function bindingsForDevice(
  deviceId: string,
  poolBindingRows: Array<{ deviceId: string; poolCode: string | null; workloadProfile: string }>,
): ResourcePoolBindingLike[] {
  return poolBindingRows
    .filter((b) => b.deviceId === deviceId)
    .map((b) => ({ poolCode: b.poolCode, workloadProfile: b.workloadProfile }))
}

function deviceMatchesPoolFilter(
  device: DeviceRow,
  poolCode: string,
  poolBindingRows: Array<{ deviceId: string; poolCode: string | null; workloadProfile: string }>,
): boolean {
  const kind = poolKindForFilterPoolCode(poolCode, poolBindingRows)
  if (!kind) return false

  const memberships = resolveDevicePoolMemberships(device.opsStatus)
  return memberships.has(kind)
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
  cardTypeRole: import('@/lib/supplier/gpu-card-type-metrics').GpuCardTypeRole
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
          cardTypeCode: gpuCardType.code,
          cardTypeDeviceRole: gpuCardType.deviceRole,
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
        cardTypeRole: resolveGpuCardTypeRole({
          name: r.cardTypeName,
          code: r.cardTypeCode,
          deviceRole: r.cardTypeDeviceRole,
        }),
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
          cardTypeCode: gpuCardType.code,
          cardTypeDeviceRole: gpuCardType.deviceRole,
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

      const poolFilterCode = filters.poolCode !== 'all' ? filters.poolCode : undefined

      const filteredDevices: DeviceRow[] = deviceRows
        .filter((d) => {
          const region = d.idcRegion ?? '其他'
          const cardKey = normalizeCardKey(d.cardTypeName)
          if (!matchesFilters(filters, { supplierId: d.supplierId, region, cardTypeKey: cardKey })) {
            return false
          }
          if (poolFilterCode && !deviceMatchesPoolFilter(d, poolFilterCode, poolBindingRows)) {
            return false
          }
          return true
        })
        .map((d) => ({
          id: d.id,
          supplierId: d.supplierId,
          dataCenterId: d.dataCenterId,
          gpuCount: d.gpuCount,
          lifecycleStatus: d.lifecycleStatus,
          opsStatus: d.opsStatus,
          inMaintenance: d.inMaintenance,
          idcRegion: d.idcRegion,
          cardTypeName: d.cardTypeName,
          cardTypeCode: d.cardTypeCode,
          cardTypeRole: resolveGpuCardTypeRole({
            name: d.cardTypeName,
            code: d.cardTypeCode,
            deviceRole: d.cardTypeDeviceRole,
          }),
        }))

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

      const holdDeviceLinkRows = await db
        .select({
          deviceId: internalTestHoldDeviceLink.supplierDeviceId,
          holdFrom: internalTestHold.holdFrom,
          holdUntil: internalTestHold.holdUntil,
        })
        .from(internalTestHoldDeviceLink)
        .innerJoin(internalTestHold, eq(internalTestHoldDeviceLink.holdId, internalTestHold.id))

      const internalHoldDeviceIds = new Set<string>()
      for (const h of holds) {
        if (!isHoldActive(h.holdFrom, h.holdUntil)) continue
        if (h.deviceId) internalHoldDeviceIds.add(h.deviceId)
      }
      for (const link of holdDeviceLinkRows) {
        if (!isHoldActive(link.holdFrom, link.holdUntil)) continue
        internalHoldDeviceIds.add(link.deviceId)
      }

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
            notInArray(faultIncident.incidentStatus, [...CLOSED_FAULT_STATUSES]),
          ),
        )

      const batchConditions = [
        inArray(onboardingBatch.batchKind, ['online', 'order_access']),
        notInArray(onboardingBatch.batchStatus, [...TERMINAL_BATCH_STATUSES]),
      ]
      if (filters.supplierId !== 'all') {
        batchConditions.push(eq(onboardingBatch.supplierId, filters.supplierId))
      }

      const activeBatchesRaw = await db
        .select({
          id: onboardingBatch.id,
          batchCode: onboardingBatch.batchCode,
          batchKind: onboardingBatch.batchKind,
          supplierId: onboardingBatch.supplierId,
          supplierShortName: onboardingBatch.supplierShortName,
          supplierName: onboardingBatch.supplierName,
          dataCenterId: onboardingBatch.dataCenterId,
          dataCenterName: onboardingBatch.dataCenterName,
          importStatus: onboardingBatch.importStatus,
          batchStatus: onboardingBatch.batchStatus,
          onlineReason: onboardingBatch.onlineReason,
          plannedDeviceCount: onboardingBatch.plannedDeviceCount,
          plannedLinesJson: onboardingBatch.plannedLinesJson,
          touchedDeviceCount: onboardingBatch.touchedDeviceCount,
          onlineDeviceCount: onboardingBatch.onlineDeviceCount,
          plannedReadyAt: onboardingBatch.plannedReadyAt,
          workOrderNo: onboardingBatch.workOrderNo,
          idcRegion: onboardingBatch.idcRegion,
        })
        .from(onboardingBatch)
        .where(and(...batchConditions))
        .orderBy(desc(onboardingBatch.plannedReadyAt))
        .limit(20)

      const activeBatches = activeBatchesRaw.filter((b) =>
        batchMatchesRegionFilter(b.idcRegion, b.dataCenterName, filters.region),
      )

      const touchedGpuByBatchId = new Map<string, number>()
      if (activeBatches.length > 0) {
        const batchIds = activeBatches.map((b) => b.id)
        const linkGpuRows = await db
          .select({
            batchId: onboardingBatchDeviceLink.businessOnboardingBatchId,
            gpuCount: supplierDevice.gpuCount,
            cardTypeName: gpuCardType.name,
            cardTypeCode: gpuCardType.code,
            cardTypeDeviceRole: gpuCardType.deviceRole,
          })
          .from(onboardingBatchDeviceLink)
          .innerJoin(
            supplierDevice,
            eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id),
          )
          .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
          .where(inArray(onboardingBatchDeviceLink.businessOnboardingBatchId, batchIds))

        for (const row of linkGpuRows) {
          if (!row.batchId) continue
          const gpu = metricGpuCount({
            gpuCount: row.gpuCount,
            cardTypeName: row.cardTypeName,
            cardTypeCode: row.cardTypeCode,
            cardTypeRole: resolveGpuCardTypeRole({
              name: row.cardTypeName,
              code: row.cardTypeCode,
              deviceRole: row.cardTypeDeviceRole,
            }),
          })
          touchedGpuByBatchId.set(
            row.batchId,
            (touchedGpuByBatchId.get(row.batchId) ?? 0) + gpu,
          )
        }
      }

      const cardFilterKey =
        filters.cardType !== 'all' ? normalizeCardKey(filters.cardType) : null
      const pipelineBatchInputs: PipelineBatchInput[] = activeBatches
        .map((batch) =>
          toPipelineBatchInput(batch, touchedGpuByBatchId.get(batch.id) ?? 0),
        )
        .filter((batch) =>
          cardFilterKey ? batchMatchesCardFilter(batch, cardFilterKey) : true,
        )
      const pipelinePending = aggregatePipelinePending(pipelineBatchInputs)
      const pipelinePendingByDataCenter = Object.fromEntries(
        aggregatePipelinePendingByDataCenter(pipelineBatchInputs),
      )

      const retireBatchConditions = [
        eq(onboardingBatch.batchKind, 'device_retire'),
        notInArray(onboardingBatch.batchStatus, [...TERMINAL_BATCH_STATUSES]),
      ]
      if (filters.supplierId !== 'all') {
        retireBatchConditions.push(eq(onboardingBatch.supplierId, filters.supplierId))
      }

      const activeRetireBatchesRaw = await db
        .select({
          id: onboardingBatch.id,
          dataCenterId: onboardingBatch.dataCenterId,
          dataCenterName: onboardingBatch.dataCenterName,
          batchKind: onboardingBatch.batchKind,
          onlineReason: onboardingBatch.onlineReason,
          plannedDeviceCount: onboardingBatch.plannedDeviceCount,
          plannedGpuCount: onboardingBatch.plannedGpuCount,
          plannedLinesJson: onboardingBatch.plannedLinesJson,
          touchedDeviceCount: onboardingBatch.touchedDeviceCount,
          idcRegion: onboardingBatch.idcRegion,
        })
        .from(onboardingBatch)
        .where(and(...retireBatchConditions))

      const activeRetireBatches = activeRetireBatchesRaw.filter((b) =>
        batchMatchesRegionFilter(b.idcRegion, b.dataCenterName, filters.region),
      )

      const retireTouchedGpuByBatchId = new Map<string, number>()
      if (activeRetireBatches.length > 0) {
        const retireBatchIds = activeRetireBatches.map((b) => b.id)
        const retireLinkGpuRows = await db
          .select({
            batchId: onboardingBatchDeviceLink.businessOnboardingBatchId,
            gpuCount: supplierDevice.gpuCount,
            cardTypeName: gpuCardType.name,
            cardTypeCode: gpuCardType.code,
            cardTypeDeviceRole: gpuCardType.deviceRole,
          })
          .from(onboardingBatchDeviceLink)
          .innerJoin(
            supplierDevice,
            eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id),
          )
          .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
          .where(inArray(onboardingBatchDeviceLink.businessOnboardingBatchId, retireBatchIds))

        for (const row of retireLinkGpuRows) {
          if (!row.batchId) continue
          const gpu = metricGpuCount({
            gpuCount: row.gpuCount,
            cardTypeName: row.cardTypeName,
            cardTypeCode: row.cardTypeCode,
            cardTypeRole: resolveGpuCardTypeRole({
              name: row.cardTypeName,
              code: row.cardTypeCode,
              deviceRole: row.cardTypeDeviceRole,
            }),
          })
          retireTouchedGpuByBatchId.set(
            row.batchId,
            (retireTouchedGpuByBatchId.get(row.batchId) ?? 0) + gpu,
          )
        }
      }

      const retirePipelineBatchInputs: PipelineBatchInput[] = activeRetireBatches
        .map((batch) =>
          toPipelineBatchInput(batch, retireTouchedGpuByBatchId.get(batch.id) ?? 0),
        )
        .filter((batch) =>
          cardFilterKey ? batchMatchesCardFilter(batch, cardFilterKey) : true,
        )
      const retirePipelinePending = aggregateRetirePipelinePending(retirePipelineBatchInputs)

      const pendingAccessDataCenterIds = computePendingAccessDataCenterIds(
        filteredDevices,
        pipelineBatchInputs,
      )

      const inventoryDtoRows = filteredInventory.map((row) => {
        const isInfra = row.cardTypeRole === 'infra'
        const internalTestGpu = isInfra
          ? 0
          : row.isInternalTest
            ? row.internalTestScope
              ? parseGpuScopeCount(row.internalTestScope, row.onlineQuantity)
              : Math.min(row.onlineQuantity, 8)
            : 0

        let holdTestGpu = 0
        if (!isInfra) {
          for (const hold of holds) {
            if (!isHoldActive(hold.holdFrom, hold.holdUntil)) continue
            if (hold.inventoryId === row.id) {
              holdTestGpu += parseGpuScopeCount(hold.scope, 8)
            }
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
              faultDownGpu += metricGpuCount(dev)
            }
          }
        }

        const maintenanceQuantity =
          row.status === 'maintenance'
            ? row.quantity
            : Math.max(0, row.quantity - row.onlineQuantity)

        let bareMetalPoolGpu = 0
        let elasticServiceGpu = 0
        let dualPoolGpu = 0
        const poolCodes = new Set<string>()

        for (const d of filteredDevices) {
          if (d.supplierId !== row.supplierId || d.dataCenterId !== row.dataCenterId) continue
          if (normalizeCardKey(d.cardTypeName) !== row.cardTypeKey) continue
          const bindings = bindingsForDevice(d.id, poolBindingRows)
          for (const bind of bindings) {
            if (bind.poolCode) poolCodes.add(bind.poolCode)
          }
          const memberships = resolveDevicePoolMemberships(d.opsStatus)
          const deviceGpu = metricGpuCount(d)
          if (memberships.has('bare_metal')) bareMetalPoolGpu += deviceGpu
          if (memberships.has('elastic_service')) elasticServiceGpu += deviceGpu
          if (isDualPool(memberships)) dualPoolGpu += deviceGpu
        }

        const sellableQuantity = isInfra
          ? 0
          : Math.max(0, row.onlineQuantity - totalInternalTest - faultDownGpu)

        return {
          id: row.id,
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          dataCenterId: row.dataCenterId,
          dataCenterName: row.dataCenterName,
          region: row.region,
          cardTypeName: row.cardTypeName,
          cardTypeRole: row.cardTypeRole,
          quantity: row.quantity,
          onlineQuantity: row.onlineQuantity,
          maintenanceQuantity,
          internalTestGpu: totalInternalTest,
          faultDownGpu,
          sellableQuantity,
          offlineQuantity: Math.max(0, row.quantity - row.onlineQuantity),
          bareMetalPoolGpu,
          elasticServiceGpu,
          dualPoolGpu,
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
        dualPoolGpu: number
        pendingAccessGpu: number
        onboardingGpu: number
        retiringGpu: number
        offlineDeliveryGpu: number
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
          dualPoolGpu: 0,
          pendingAccessGpu: 0,
          onboardingGpu: 0,
          retiringGpu: 0,
          offlineDeliveryGpu: 0,
        }
        supplierAgg.set(supplierId, row)
        return row
      }

      for (const inv of inventoryDtoRows) {
        const row = ensureSupplierRow(inv.supplierId, inv.supplierName)
        row.regions.add(inv.region)
        row.totalGpu += inventoryGpuQuantity(inv.cardTypeRole, inv.quantity)
        row.onlineGpu += inventoryGpuQuantity(inv.cardTypeRole, inv.onlineQuantity)
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

        const gpu = metricGpuCount(d)

        if (d.lifecycleStatus === '待接入') row.pendingAccessGpu += gpu
        if (d.lifecycleStatus === '接入中') row.onboardingGpu += gpu
        if (d.lifecycleStatus === '下线中') row.retiringGpu += gpu
        if (
          OFFLINE_DELIVERY_OPS.includes(d.opsStatus as (typeof OFFLINE_DELIVERY_OPS)[number])
        ) {
          row.offlineDeliveryGpu += gpu
        }
        if (d.lifecycleStatus === '维护中' || d.inMaintenance) {
          row.maintenanceGpu += gpu
        }

        const bindings = bindingsForDevice(d.id, poolBindingRows)
        const memberships = resolveDevicePoolMemberships(d.opsStatus)
        if (memberships.has('bare_metal')) row.bareMetalPoolGpu += gpu
        if (memberships.has('elastic_service')) row.elasticServiceGpu += gpu
        if (isDualPool(memberships)) row.dualPoolGpu += gpu
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
          pendingAccessGpu: row.pendingAccessGpu,
          onboardingGpu: row.onboardingGpu,
          retiringGpu: row.retiringGpu,
          internalTestGpu: row.internalTestGpu,
          offlineDeliveryGpu: row.offlineDeliveryGpu,
          bareMetalPoolGpu: row.bareMetalPoolGpu,
          elasticServiceGpu: row.elasticServiceGpu,
          dualPoolGpu: row.dualPoolGpu,
        }))
        .sort((a, b) => b.sellableGpu - a.sellableGpu)

      const lifecycleFunnel = buildLifecycleFunnel(filteredDevices, pipelinePending)

      const opsGroups: Record<string, { gpu: number; devices: number }> = {
        '裸金属池 · 直连上架中': { gpu: 0, devices: 0 },
        '裸金属池 · 代理上架中': { gpu: 0, devices: 0 },
        线下交付: { gpu: 0, devices: 0 },
        网关上架: { gpu: 0, devices: 0 },
        其他: { gpu: 0, devices: 0 },
      }

      for (const d of filteredDevices) {
        if (d.lifecycleStatus === '下线中') continue
        let group = '其他'
        if (
          BARE_METAL_DIRECT_OPS.includes(d.opsStatus as (typeof BARE_METAL_DIRECT_OPS)[number])
        ) {
          group = '裸金属池 · 直连上架中'
        } else if (
          BARE_METAL_PROXY_OPS.includes(d.opsStatus as (typeof BARE_METAL_PROXY_OPS)[number])
        ) {
          group = '裸金属池 · 代理上架中'
        } else if (
          OFFLINE_DELIVERY_OPS.includes(d.opsStatus as (typeof OFFLINE_DELIVERY_OPS)[number])
        ) {
          group = '线下交付'
        } else if (
          GATEWAY_ONBOARDING_OPS.includes(d.opsStatus as (typeof GATEWAY_ONBOARDING_OPS)[number])
        ) {
          group = '网关上架'
        }
        const bucket = opsGroups[group]!
        bucket.gpu += metricGpuCount(d)
        bucket.devices += 1
      }

      const opsPipeline = Object.entries(opsGroups).map(([group, v]) => ({
        group,
        gpuCount: v.gpu,
        deviceCount: v.devices,
      }))

      const totalGpu = inventoryDtoRows.reduce(
        (s, r) => s + inventoryGpuQuantity(r.cardTypeRole, r.quantity),
        0,
      )
      const sellableGpuRaw = inventoryDtoRows.reduce((s, r) => s + r.sellableQuantity, 0)
      const inventoryInternalTestGpu = inventoryDtoRows.reduce((s, r) => s + r.internalTestGpu, 0)
      const faultDownGpu = inventoryDtoRows.reduce((s, r) => s + r.faultDownGpu, 0)

      let otherDeptGpu = 0
      for (const d of filteredDevices) {
        if (isOtherDeptOpsStatus(d.opsStatus)) {
          otherDeptGpu += metricGpuCount(d)
        }
      }

      const internalTestGpu = inventoryInternalTestGpu + otherDeptGpu
      const sellableGpu = Math.max(0, sellableGpuRaw - otherDeptGpu)
      const sellableRate =
        kpiFromDevices(filteredDevices, (d) => d.lifecycleStatus === '在线').gpuCount > 0
          ? Math.round(
              (sellableGpu /
                kpiFromDevices(filteredDevices, (d) => d.lifecycleStatus === '在线').gpuCount) *
                100,
            )
          : 0

      const kpis = {
        total: {
          deviceCount: filteredDevices.length,
          gpuCount: totalGpu,
        },
        online: kpiFromDevices(filteredDevices, (d) => d.lifecycleStatus === '在线'),
        pendingAccess: mergeKpiMetric(
          kpiFromDevices(filteredDevices, (d) => d.lifecycleStatus === '待接入'),
          pipelinePending,
        ),
        onboarding: kpiFromDevices(filteredDevices, (d) => d.lifecycleStatus === '接入中'),
        maintenance: kpiFromDevices(
          filteredDevices,
          (d) => d.lifecycleStatus === '维护中' || d.inMaintenance,
        ),
        sellable: {
          deviceCount: filteredDevices.filter(
            (d) =>
              d.lifecycleStatus === '在线' &&
              !d.inMaintenance &&
              !NON_SCHEDULABLE_OPS.includes(d.opsStatus as (typeof NON_SCHEDULABLE_OPS)[number]) &&
              !isOtherDeptOpsStatus(d.opsStatus),
          ).length,
          gpuCount: sellableGpu,
        },
        retiring: kpiFromDevices(
          filteredDevices,
          (d) => d.lifecycleStatus === '下线中' && d.opsStatus !== '已退订',
        ),
        nonSchedulable: kpiFromDevices(filteredDevices, (d) =>
          NON_SCHEDULABLE_OPS.includes(d.opsStatus as (typeof NON_SCHEDULABLE_OPS)[number]),
        ),
        inMaintenance: kpiFromDevices(filteredDevices, (d) => d.inMaintenance),
        reservedIdle: kpiFromDevices(filteredDevices, (d) =>
          RESERVED_IDLE_OPS.includes(d.opsStatus as (typeof RESERVED_IDLE_OPS)[number]),
        ),
        internalTestGpu,
        faultDownGpu,
        faultOpenCount: openFaultsFiltered.length,
        activeTestHolds: holds.filter((h) => isHoldActive(h.holdFrom, h.holdUntil)).length,
        activeBatches: activeBatches.length,
        sellableRate,
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

      const gpuTargetGpu = await resolveGpuTargetGpu(filters, new Date())

      const resourceComposition = buildResourceCompositionFromDevices({
        devices: filteredDevices,
        internalHoldDeviceIds,
        pendingAccessPipeline: pipelinePending,
        retiringPipeline: retirePipelinePending,
      })

      const result: OverviewStatsResult = {
        kpis,
        lifecycleFunnel,
        opsPipeline,
        supplierRows,
        inventoryRows: inventoryDtoRows,
        batchSummaries,
        faultSla,
        pendingAccessDataCenterIds,
        pipelinePendingByDataCenter,
        gpuTargetGpu,
        resourceComposition,
      }

      supplierLog('overview', 'getStats done', {
        inventoryRows: inventoryDtoRows.length,
        supplierRows: supplierRows.length,
        totalGpu: kpis.total.gpuCount,
        gpuTargetGpu,
      })

      return result
    } catch (e) {
      supplierError('overview', 'getStats failed', e, filters)
      throw e
    }
  },
}
