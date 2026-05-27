import { mockDataCenterDevices, mockDataCenters, mockSuppliers } from '@/lib/data/mock-data'
import type { DataCenterDevice } from '@/lib/data/types'
import type {
  FaultIncident,
  InternalTestHold,
  OnboardingBatch,
  ResourcePoolBinding,
  SupplierDevice,
} from '@/lib/types/supplier-domain'
import { resolveDomainSupplierId } from '@/lib/supplier/supplier-id-bridge'
import { metricGpuCount } from '@/lib/supplier/gpu-card-type-metrics'

export type OverviewFilters = {
  region: string
  supplierId: string
  cardType: string
  poolCode: string
}

export type OverviewKpis = {
  totalGpu: number
  onlineGpu: number
  onboardingGpu: number
  maintenanceGpu: number
  internalTestGpu: number
  sellableGpu: number
  faultOpenCount: number
  activeTestHolds: number
  activeBatches: number
}

export type InventoryOverviewRow = {
  id: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  region: string
  cardTypeName: string
  quantity: number
  onlineQuantity: number
  onboardingQuantity: number
  maintenanceQuantity: number
  internalTestGpu: number
  sellableQuantity: number
  offlineQuantity: number
  bareMetalQuantity: number
  elasticServiceQuantity: number
  status: DataCenterDevice['status']
  poolCodes: string[]
}

export type SupplierOverviewRow = {
  supplierId: string
  supplierName: string
  regionCount: number
  totalGpu: number
  onlineGpu: number
  onboardingGpu: number
  sellableGpu: number
  offlineGpu: number
  internalTestGpu: number
  bareMetalQuantity: number
  elasticServiceQuantity: number
  maintenanceQuantity: number
  openFaults: number
  activeBatches: number
}

export type LifecycleFunnelStage = {
  stage: string
  gpuCount: number
  deviceCount: number
  warn?: boolean
}

export type OnboardingBatchSummary = {
  id: string
  batchCode: string
  batchKind: OnboardingBatch['batch_kind']
  supplierName: string
  dataCenterName: string
  importStatus: string
  batchStatus: string
  committedDeviceCount: number
  parsedSuccessCount: number
  plannedReadyAt: string | null
}

export type FaultSlaSummary = {
  openCount: number
  p1Count: number
  p2Count: number
  avgResolutionHours: number | null
  recentOpen: FaultIncident[]
}

const ONBOARDING_LIFECYCLES = new Set(['待接入', '接入中'])

function parseGpuScopeCount(scope: string, fallback = 4): number {
  const match = scope.match(/gpu\s*(\d+)\s*-\s*gpu\s*(\d+)/i)
  if (match) {
    const start = Number(match[1])
    const end = Number(match[2])
    return Math.max(0, end - start + 1)
  }
  const single = scope.match(/gpu\s*(\d+)/i)
  if (single) return 1
  return fallback
}

function isHoldActive(hold: InternalTestHold, at = Date.now()): boolean {
  const from = new Date(hold.hold_from).getTime()
  const until = hold.hold_until ? new Date(hold.hold_until).getTime() : null
  if (at < from) return false
  if (until != null && at > until) return false
  return true
}

import {
  metricGpuCount,
  resolveDeviceGpuCount,
  resolveGpuCardTypeRole,
} from '@/lib/supplier/gpu-card-type-metrics'

function deviceGpuCount(device: SupplierDevice): number {
  return metricGpuCount({
    gpuCount: Number(device.gpu_count),
    cardTypeName: device.card_type,
  })
}

function regionForInventoryRow(row: DataCenterDevice): string {
  const dc = mockDataCenters.find((d) => d.id === row.dataCenterId)
  if (dc?.location) return dc.location
  if (row.dataCenterName.includes('北京')) return '北京'
  if (row.dataCenterName.includes('上海')) return '上海'
  if (row.dataCenterName.includes('深圳') || row.dataCenterName.includes('广州')) return '华南'
  if (row.dataCenterName.includes('内蒙古')) return '内蒙古'
  return '其他'
}

function normalizeCardType(name: string): string {
  return name?.toLowerCase().replace(/\s+/g, ' ').trim() ?? ''
}

function inventoryMatchesFilters(
  row: DataCenterDevice,
  filters: OverviewFilters,
  poolBindings: ResourcePoolBinding[],
  physicalDevices: SupplierDevice[],
): boolean {
  if (filters.supplierId !== 'all' && row.supplierId !== filters.supplierId) return false
  if (filters.region !== 'all' && regionForInventoryRow(row) !== filters.region) return false
  if (
    filters.cardType !== 'all' &&
    normalizeCardType(row.cardTypeName) !== normalizeCardType(filters.cardType)
  ) {
    return false
  }
  if (filters.poolCode === 'all') return true

  const domainSupplierId = resolveDomainSupplierId(row.supplierId)
  const relatedDevices = physicalDevices.filter((d) => d.supplier_id === domainSupplierId)
  const deviceIds = new Set(relatedDevices.map((d) => d.id))
  const pools = poolBindings
    .filter((b) => deviceIds.has(b.device_id))
    .map((b) => b.pool_code)
    .filter(Boolean)
  return pools.includes(filters.poolCode)
}

function internalTestGpuForInventory(
  row: DataCenterDevice,
  holds: InternalTestHold[],
): number {
  if (row.isInternalTest) {
    if (row.internalTestScope) return parseGpuScopeCount(row.internalTestScope, row.onlineQuantity)
    return Math.min(row.onlineQuantity, 8)
  }

  const domainSupplierId = resolveDomainSupplierId(row.supplierId)
  const cardKey = normalizeCardType(row.cardTypeName)
  let total = 0
  for (const hold of holds) {
    if (!isHoldActive(hold)) continue
    if (hold.supplier_id !== domainSupplierId) continue
    if (normalizeCardType(hold.card_type) !== cardKey) continue
    total += Math.max(0, hold.unit_count) * 8
  }
  return total
}

function faultDownGpuForInventory(
  row: DataCenterDevice,
  faults: FaultIncident[],
  physicalDevices: SupplierDevice[],
): number {
  if (row.status === 'maintenance') return row.quantity - row.onlineQuantity

  const domainSupplierId = resolveDomainSupplierId(row.supplierId)
  const openFaults = faults.filter(
    (f) => f.supplier_id === domainSupplierId && f.incident_status !== '已关闭',
  )
  let total = 0
  for (const fault of openFaults) {
    if (!fault.device_id) continue
    const device = physicalDevices.find((d) => d.id === fault.device_id)
    if (!device) continue
    if (normalizeCardType(device.card_type) !== normalizeCardType(row.cardTypeName)) continue
    if (device.lifecycle_status === '在线') {
      total += deviceGpuCount(device)
    }
  }
  return total
}

function onboardingGpuFromPhysical(
  physicalDevices: SupplierDevice[],
  filters: OverviewFilters,
): number {
  return physicalDevices
    .filter((d) => {
      if (!ONBOARDING_LIFECYCLES.has(d.lifecycle_status)) return false
      const mockSupplier = mockSuppliers.find(
        (s) => resolveDomainSupplierId(s.id) === d.supplier_id,
      )
      if (filters.supplierId !== 'all' && mockSupplier?.id !== filters.supplierId) return false
      if (filters.region !== 'all' && d.idc_region !== filters.region) return false
      if (
        filters.cardType !== 'all' &&
        normalizeCardType(d.card_type) !== normalizeCardType(filters.cardType)
      ) {
        return false
      }
      return true
    })
    .reduce((sum, d) => sum + deviceGpuCount(d), 0)
}

export function getOverviewFilterOptions(
  poolBindings: ResourcePoolBinding[],
  physicalDevices: SupplierDevice[],
) {
  const regions = new Set<string>()
  for (const dc of mockDataCenters) {
    if (dc.location) regions.add(dc.location)
  }
  for (const d of physicalDevices) {
    if (d.idc_region) regions.add(d.idc_region)
  }

  const cardTypes = new Set<string>()
  for (const row of mockDataCenterDevices) {
    cardTypes.add(row.cardTypeName)
  }
  for (const d of physicalDevices) {
    cardTypes.add(d.card_type)
  }

  const poolCodes = new Set<string>()
  for (const b of poolBindings) {
    if (b.pool_code) poolCodes.add(b.pool_code)
  }

  return {
    regions: Array.from(regions).sort(),
    suppliers: mockSuppliers.filter((s) => s.status === 'cooperating'),
    cardTypes: Array.from(cardTypes).sort(),
    poolCodes: Array.from(poolCodes).sort(),
  }
}

export function buildInventoryOverviewRows(
  filters: OverviewFilters,
  holds: InternalTestHold[],
  faults: FaultIncident[],
  poolBindings: ResourcePoolBinding[],
  physicalDevices: SupplierDevice[],
): InventoryOverviewRow[] {
  return mockDataCenterDevices
    .filter((row) => inventoryMatchesFilters(row, filters, poolBindings, physicalDevices))
    .map((row) => {
      const supplier = mockSuppliers.find((s) => s.id === row.supplierId)
      const internalTestGpu = internalTestGpuForInventory(row, holds)
      const faultDownGpu = faultDownGpuForInventory(row, faults, physicalDevices)
      const maintenanceQuantity =
        row.status === 'maintenance' ? row.quantity : Math.max(0, row.quantity - row.onlineQuantity)
      const sellableQuantity = Math.max(0, row.onlineQuantity - internalTestGpu - faultDownGpu)

      const domainSupplierId = resolveDomainSupplierId(row.supplierId)
      const poolCodes = poolBindings
        .filter((b) => {
          const device = physicalDevices.find((d) => d.id === b.device_id)
          return device?.supplier_id === domainSupplierId
        })
        .map((b) => b.pool_code)
        .filter((c): c is string => Boolean(c))

      return {
        id: row.id,
        supplierId: row.supplierId,
        supplierName: supplier?.shortName ?? supplier?.name ?? row.supplierId,
        dataCenterId: row.dataCenterId,
        dataCenterName: row.dataCenterName,
        region: regionForInventoryRow(row),
        cardTypeName: row.cardTypeName,
        quantity: row.quantity,
        onlineQuantity: row.onlineQuantity,
        onboardingQuantity: 0,
        maintenanceQuantity,
        internalTestGpu,
        sellableQuantity,
        offlineQuantity: 0,
        bareMetalQuantity: 0,
        elasticServiceQuantity: 0,
        status: row.status,
        poolCodes: Array.from(new Set(poolCodes)),
      }
    })
}

export function computeOverviewKpis(
  inventoryRows: InventoryOverviewRow[],
  filters: OverviewFilters,
  holds: InternalTestHold[],
  faults: FaultIncident[],
  batches: OnboardingBatch[],
  physicalDevices: SupplierDevice[],
): OverviewKpis {
  const totalGpu =
    inventoryRows.reduce((s, r) => s + r.quantity, 0) +
    onboardingGpuFromPhysical(physicalDevices, filters)
  const onlineGpu = inventoryRows.reduce((s, r) => s + r.onlineQuantity, 0)
  const onboardingGpu = onboardingGpuFromPhysical(physicalDevices, filters)
  const maintenanceGpu = inventoryRows.reduce((s, r) => s + r.maintenanceQuantity, 0)
  const internalTestGpu = inventoryRows.reduce((s, r) => s + r.internalTestGpu, 0)
  const sellableGpu = inventoryRows.reduce((s, r) => s + r.sellableQuantity, 0)

  const domainSupplierFilter =
    filters.supplierId !== 'all' ? resolveDomainSupplierId(filters.supplierId) : null

  const openFaults = faults.filter((f) => {
    if (f.incident_status === '已关闭') return false
    if (domainSupplierFilter && f.supplier_id !== domainSupplierFilter) return false
    return true
  })

  const activeTestHolds = holds.filter((h) => {
    if (!isHoldActive(h)) return false
    if (domainSupplierFilter && h.supplier_id !== domainSupplierFilter) return false
    return true
  })

  const activeBatches = batches.filter((b) => {
    if (['已完成', '已取消'].includes(b.batch_status)) return false
    if (domainSupplierFilter && b.supplier_id !== domainSupplierFilter) return false
    return true
  })

  return {
    totalGpu,
    onlineGpu,
    onboardingGpu,
    maintenanceGpu,
    internalTestGpu,
    sellableGpu,
    faultOpenCount: openFaults.length,
    activeTestHolds: activeTestHolds.length,
    activeBatches: activeBatches.length,
  }
}

export function buildSupplierOverviewRows(
  inventoryRows: InventoryOverviewRow[],
  faults: FaultIncident[],
  batches: OnboardingBatch[],
): SupplierOverviewRow[] {
  const bySupplier = new Map<string, SupplierOverviewRow>()

  for (const row of inventoryRows) {
    const existing = bySupplier.get(row.supplierId) ?? {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      regionCount: 0,
      totalGpu: 0,
      onlineGpu: 0,
      onboardingGpu: 0,
      sellableGpu: 0,
      offlineGpu: 0,
      internalTestGpu: 0,
      bareMetalQuantity: 0,
      elasticServiceQuantity: 0,
      maintenanceQuantity: 0,
      openFaults: 0,
      activeBatches: 0,
    }
    existing.totalGpu += row.quantity
    existing.onlineGpu += row.onlineQuantity
    existing.sellableGpu += row.sellableQuantity
    existing.offlineGpu += row.offlineQuantity
    existing.internalTestGpu += row.internalTestGpu
    existing.bareMetalQuantity += row.bareMetalQuantity
    existing.elasticServiceQuantity += row.elasticServiceQuantity
    existing.maintenanceQuantity += row.maintenanceQuantity
    bySupplier.set(row.supplierId, existing)
  }

  const regionsBySupplier = new Map<string, Set<string>>()
  for (const row of inventoryRows) {
    const set = regionsBySupplier.get(row.supplierId) ?? new Set<string>()
    set.add(row.region)
    regionsBySupplier.set(row.supplierId, set)
  }

  for (const [supplierId, row] of bySupplier) {
    row.regionCount = regionsBySupplier.get(supplierId)?.size ?? 0
    const domainId = resolveDomainSupplierId(supplierId)
    row.openFaults = faults.filter(
      (f) => f.supplier_id === domainId && f.incident_status !== '已关闭',
    ).length
    row.activeBatches = batches.filter(
      (b) => b.supplier_id === domainId && !['已完成', '已取消'].includes(b.batch_status),
    ).length
  }

  return Array.from(bySupplier.values()).sort((a, b) => b.sellableGpu - a.sellableGpu)
}

export function buildLifecycleFunnel(physicalDevices: SupplierDevice[]): LifecycleFunnelStage[] {
  const stages: Record<string, { gpu: number; devices: number }> = {
    待接入: { gpu: 0, devices: 0 },
    接入中: { gpu: 0, devices: 0 },
    在线: { gpu: 0, devices: 0 },
    维护中: { gpu: 0, devices: 0 },
    离线: { gpu: 0, devices: 0 },
    下线中: { gpu: 0, devices: 0 },
  }

  for (const device of physicalDevices) {
    const key = device.lifecycle_status in stages ? device.lifecycle_status : '离线'
    const bucket = stages[key]!
    bucket.gpu += deviceGpuCount(device)
    bucket.devices += 1
  }

  const order = ['待接入', '接入中', '在线', '维护中', '离线', '下线中']
  return order.map((stage) => ({
    stage,
    gpuCount: stages[stage]?.gpu ?? 0,
    deviceCount: stages[stage]?.devices ?? 0,
    warn: stage === '接入中' && (stages[stage]?.devices ?? 0) > 0,
  }))
}

export function buildOnboardingBatchSummaries(
  batches: OnboardingBatch[],
  filters: OverviewFilters,
): OnboardingBatchSummary[] {
  return batches
    .filter((b) => {
      if (['已完成', '已取消'].includes(b.batch_status)) return false
      if (filters.supplierId !== 'all') {
        const domainId = resolveDomainSupplierId(filters.supplierId)
        if (b.supplier_id !== domainId) return false
      }
      if (filters.region !== 'all' && b.idc_region !== filters.region) return false
      return true
    })
    .map((b) => ({
      id: b.id,
      batchCode: b.batch_code,
      batchKind: b.batch_kind,
      supplierName: b.supplier_short_name ?? b.supplier_name,
      dataCenterName: b.data_center_name,
      importStatus: b.import_status,
      batchStatus: b.batch_status,
      committedDeviceCount: b.committed_device_count,
      parsedSuccessCount: b.parsed_success_count,
      plannedReadyAt: b.planned_ready_at,
    }))
    .sort((a, b) => (b.plannedReadyAt ?? '').localeCompare(a.plannedReadyAt ?? ''))
}

export function buildFaultSlaSummary(
  faults: FaultIncident[],
  filters: OverviewFilters,
): FaultSlaSummary {
  const domainSupplierFilter =
    filters.supplierId !== 'all' ? resolveDomainSupplierId(filters.supplierId) : null

  const scoped = faults.filter((f) => {
    if (domainSupplierFilter && f.supplier_id !== domainSupplierFilter) return false
    return true
  })

  const open = scoped.filter((f) => f.incident_status !== '已关闭')
  const closed = scoped.filter((f) => f.closed_at && f.opened_at)

  let totalHours = 0
  for (const f of closed) {
    const ms = new Date(f.closed_at!).getTime() - new Date(f.opened_at).getTime()
    totalHours += ms / (1000 * 60 * 60)
  }

  return {
    openCount: open.length,
    p1Count: open.filter((f) => f.severity === 'P1').length,
    p2Count: open.filter((f) => f.severity === 'P2').length,
    avgResolutionHours: closed.length > 0 ? totalHours / closed.length : null,
    recentOpen: open
      .slice()
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at))
      .slice(0, 5),
  }
}
