import type {
  ContractPricingMode,
  CooperationMode,
  DataCenter,
  DataCenterDevice,
  DeviceCooperationType,
  GPUCardType,
  PhysicalComputeNode,
  PhysicalDevice,
  PhysicalDeviceFlowRecord,
  Supplier,
  SupplierBill,
  SupplierBillDetail,
  SupplierContract,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import type {
  DataCenterRow,
  SupplierContractRow,
  SupplierDeviceRow,
  SupplierGpuInventoryRow,
  SupplierRow,
} from '@workspace/db/schema'
import type {
  computeNode,
  entityStateTransitionLog,
  gpuCardType,
  supplierActivity,
  supplierBill,
  supplierBillDetail,
  supplierDeviceChangeLog,
  supplierPricingHistory,
  supplierPricingRecord,
} from '@workspace/db/schema'

type ComputeNodeRow = typeof computeNode.$inferSelect
type EntityStateTransitionLogRow = typeof entityStateTransitionLog.$inferSelect
type SupplierActivityRow = typeof supplierActivity.$inferSelect
type SupplierDeviceChangeLogRow = typeof supplierDeviceChangeLog.$inferSelect

type SupplierBillRow = typeof supplierBill.$inferSelect
type SupplierBillDetailRow = typeof supplierBillDetail.$inferSelect
type SupplierPricingRecordRow = typeof supplierPricingRecord.$inferSelect
type SupplierPricingHistoryRow = typeof supplierPricingHistory.$inferSelect
import { normalizePlatformDateTime } from '@/lib/platform-pricing/datetime'
import { toIsoDate, toNumber } from '@/lib/server/mappers/crm'

function toPricingDateTime(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) {
    return normalizePlatformDateTime(value.toISOString())
  }
  return normalizePlatformDateTime(String(value))
}

function pricingModeToCooperationMode(mode: string): CooperationMode {
  return mode === 'revenue_share' || mode === 'tiered_revenue_share' ? 'revenue_share' : 'card_time'
}

export function mapSupplierRow(
  row: SupplierRow,
  businessManagerName: string | null,
  aggregates?: { dataCenterCount: number; totalDeviceCount: number },
): Supplier {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    shortName: row.shortName,
    status: row.status as Supplier['status'],
    cooperationMode: (row.defaultCooperationMode ?? 'card_time') as CooperationMode,
    revenueShareRatio: row.defaultRevenueSharePercent
      ? toNumber(row.defaultRevenueSharePercent)
      : undefined,
    businessManager: businessManagerName ?? '—',
    contactPerson: row.contactPerson ?? '',
    contactPhone: row.contactPhone ?? '',
    contactEmail: row.contactEmail ?? '',
    address: row.address ?? '',
    bankAccount: row.bankAccount ?? undefined,
    bankName: row.bankName ?? undefined,
    externalOnboardingId: row.externalOnboardingId ?? undefined,
    externalTenantId: row.externalTenantId || undefined,
    platformTenantId: row.platformTenantId ?? undefined,
    onboardingType: (row.onboardingType as Supplier['onboardingType']) ?? undefined,
    identityNo: row.identityNo ?? undefined,
    businessScope: row.businessScope ?? undefined,
    businessLicenseUri: row.businessLicenseUri ?? undefined,
    idCardFrontUri: row.idCardFrontUri ?? undefined,
    idCardBackUri: row.idCardBackUri ?? undefined,
    bankBranchName: row.bankBranchName ?? undefined,
    bankBranchAddress: row.bankBranchAddress ?? undefined,
    adminPhone: row.adminPhone ?? undefined,
    adminEmail: row.adminEmail ?? undefined,
    deviceInfoRaw: row.deviceInfoRaw ?? undefined,
    auditStatus: row.auditStatus ?? undefined,
    auditConfirmed: row.auditConfirmed,
    auditRemark: row.auditRemark ?? undefined,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    dataCenterCount: aggregates?.dataCenterCount ?? 0,
    totalDeviceCount: aggregates?.totalDeviceCount ?? 0,
    monthlySettlement: 0,
  }
}

export function mapDataCenterRow(
  row: DataCenterRow,
  supplierName: string,
  deviceCounts?: { total: number; online: number },
): DataCenter {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName,
    name: row.name,
    code: row.code,
    location: row.location ?? '',
    address: row.address ?? '',
    status: row.status as DataCenter['status'],
    networkFee: toNumber(row.networkFeeMonthly),
    managementNodeFee: toNumber(row.mgmtNodeFeeMonthly),
    totalDeviceCount: deviceCounts?.total ?? 0,
    onlineDeviceCount: deviceCounts?.online ?? 0,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    externalOnboardingId: row.externalOnboardingId ?? undefined,
    platformTenantId: row.platformTenantId ?? undefined,
    regionTags: row.regionTags ?? [],
    containerInstanceRegion: row.containerInstanceRegion ?? undefined,
    bareMetalRegion: row.bareMetalRegion ?? undefined,
    description: row.description ?? undefined,
    scale: row.scale ?? undefined,
    publicIpCount: row.publicIpCount ?? undefined,
    internalNetworkCidr: row.internalNetworkCidr ?? undefined,
    auditStatus: row.auditStatus ?? undefined,
    auditRemark: row.auditRemark ?? undefined,
    sourceDeleted: row.sourceDeleted,
  }
}

export function mapGpuInventoryRow(
  row: SupplierGpuInventoryRow,
  names: { dataCenterName: string; cardTypeName: string; supplierShortName?: string },
): DataCenterDevice {
  return {
    id: row.id,
    dataCenterId: row.dataCenterId,
    dataCenterName: names.dataCenterName,
    supplierId: row.supplierId,
    supplierShortName: names.supplierShortName,
    cardTypeId: row.gpuCardTypeId,
    cardTypeName: names.cardTypeName,
    quantity: row.quantity,
    onlineQuantity: row.onlineQuantity,
    cardTimeCostPerHour: row.cardTimeCostPerHour ? toNumber(row.cardTimeCostPerHour) : undefined,
    revenueShareCostPerHour: row.revenueShareCostPerHour
      ? toNumber(row.revenueShareCostPerHour)
      : undefined,
    status: row.status as DataCenterDevice['status'],
    isInternalTest: row.isInternalTest,
    internalTestScope: row.internalTestScope ?? undefined,
    internalTestUntil: row.internalTestUntil?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapSupplierContractRow(
  row: SupplierContractRow,
  supplierName: string,
): SupplierContract {
  return {
    id: row.id,
    contractNo: row.contractNo,
    supplierId: row.supplierId,
    supplierName,
    type: row.type as SupplierContract['type'],
    status: row.status as SupplierContract['status'],
    cooperationMode: row.cooperationMode as CooperationMode,
    pricingMode: row.pricingMode as ContractPricingMode,
    unitPricePerHour: row.unitPricePerHour ? toNumber(row.unitPricePerHour) : undefined,
    revenueShareRatio: row.revenueSharePercent ? toNumber(row.revenueSharePercent) : undefined,
    minCommitHours: row.minCommitHours ? toNumber(row.minCommitHours) : undefined,
    settlementCycle: (row.settlementCycle as SupplierContract['settlementCycle']) ?? undefined,
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    terms: row.terms ?? '',
    signedAt: row.signedAt?.toISOString(),
    signerName: row.signerName ?? undefined,
    contractFileUrl: row.contractFileUri ?? undefined,
    createdAt: toIsoDate(row.createdAt),
  }
}

export function mapSupplierBillDetailRow(
  row: SupplierBillDetailRow,
  names: { dataCenterName: string; cardTypeName: string },
): SupplierBillDetail {
  return {
    dataCenterId: row.dataCenterId,
    dataCenterName: names.dataCenterName,
    cardTypeName: names.cardTypeName,
    usageHours: toNumber(row.usageHours),
    unitCost: toNumber(row.unitCost),
    amount: toNumber(row.amount),
    tenantConsumption: row.tenantConsumption ? toNumber(row.tenantConsumption) : undefined,
  }
}

export function mapSupplierBillRow(
  row: SupplierBillRow,
  supplierName: string,
  details: SupplierBillDetail[],
): SupplierBill {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName,
    month: row.billMonth,
    cooperationMode: row.cooperationMode as CooperationMode,
    status: row.status as SupplierBill['status'],
    totalUsageHours: toNumber(row.totalUsageHours),
    totalAmount: toNumber(row.totalAmount),
    networkFee: toNumber(row.networkFee),
    managementFee: toNumber(row.managementFee),
    finalAmount: toNumber(row.finalAmount),
    details,
    dueDate: toIsoDate(row.dueDate),
    paidAt: row.paidAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export function mapSupplierPricingRecordRow(
  row: SupplierPricingRecordRow,
  names: { supplierName: string; dataCenterName: string; cardTypeName: string },
  updatedBy?: string | null,
): SupplierPricingRecord {
  const pricingMode = row.pricingMode as ContractPricingMode
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName: names.supplierName,
    dataCenterId: row.dataCenterId,
    dataCenterName: names.dataCenterName,
    cardTypeId: row.gpuCardTypeId,
    cardTypeName: names.cardTypeName,
    configStatus: (row.configStatus ?? 'active') as SupplierPricingRecord['configStatus'],
    cooperationMode: pricingModeToCooperationMode(pricingMode),
    pricingMode,
    unitPricePerHour: row.unitPricePerHour ? toNumber(row.unitPricePerHour) : undefined,
    revenueSharePercent: row.revenueSharePercent ? toNumber(row.revenueSharePercent) : undefined,
    pricingTiers: (row.pricingTiers as SupplierPricingRecord['pricingTiers']) ?? undefined,
    effectiveFrom: toPricingDateTime(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toPricingDateTime(row.effectiveTo) : null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: updatedBy ?? undefined,
  }
}

export function mapSupplierPricingHistoryRow(
  row: SupplierPricingHistoryRow,
  names: {
    supplierName: string
    dataCenterName: string
    cardTypeName: string
    changedBy: string
  },
): SupplierPricingHistory {
  return {
    id: row.id,
    pricingRecordId: row.pricingRecordId,
    supplierId: row.supplierId,
    supplierName: names.supplierName,
    dataCenterId: row.dataCenterId,
    dataCenterName: names.dataCenterName,
    cardTypeId: row.gpuCardTypeId,
    cardTypeName: names.cardTypeName,
    cooperationMode: pricingModeToCooperationMode(row.pricingMode),
    previousUnitPricePerHour: row.previousUnitPricePerHour
      ? toNumber(row.previousUnitPricePerHour)
      : undefined,
    newUnitPricePerHour: row.newUnitPricePerHour ? toNumber(row.newUnitPricePerHour) : undefined,
    previousRevenueSharePercent: row.previousRevenueSharePercent
      ? toNumber(row.previousRevenueSharePercent)
      : undefined,
    newRevenueSharePercent: row.newRevenueSharePercent
      ? toNumber(row.newRevenueSharePercent)
      : undefined,
    changedAt: row.changedAt.toISOString(),
    changedBy: names.changedBy,
    reason: row.reason ?? undefined,
  }
}

type GpuCardTypeRow = typeof gpuCardType.$inferSelect

export function mapGpuCardTypeRow(row: GpuCardTypeRow): GPUCardType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    manufacturer: row.manufacturer as GPUCardType['manufacturer'],
    memoryGB: row.memoryGb ?? 0,
    tdpWatts: row.tdpWatts ?? undefined,
    computeCapability: row.computeCapability ?? undefined,
    status: row.status as GPUCardType['status'],
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  }
}

export function mapComputeNodeRow(row: ComputeNodeRow): PhysicalComputeNode {
  return {
    id: row.id,
    nodeRole: row.nodeRole,
    mgmtIp: row.mgmtIp,
    clusterId: row.clusterId,
    clusterName: row.clusterName,
    nodeName: row.nodeName,
    expectedService: row.expectedService,
    lifecycleStatus: row.lifecycleStatus,
  }
}

export function mapStateTransitionFlowRecord(
  row: EntityStateTransitionLogRow,
  operatorName: string | null,
): PhysicalDeviceFlowRecord {
  return {
    id: row.id,
    kind: 'state_transition',
    title: `${row.fromState} → ${row.toState}`,
    fromState: row.fromState,
    toState: row.toState,
    reasonCode: row.reasonCode,
    operatorName: operatorName ?? '系统',
    occurredAt: toIsoDate(row.occurredAt),
  }
}

export function mapChangelogFlowRecord(
  row: SupplierDeviceChangeLogRow,
  batchCode: string,
): PhysicalDeviceFlowRecord {
  const statusParts: string[] = []
  if (row.previousOpsStatus || row.newOpsStatus) {
    statusParts.push(`运营状态 ${row.previousOpsStatus ?? '—'} → ${row.newOpsStatus ?? '—'}`)
  }
  if (row.previousLifecycleStatus || row.newLifecycleStatus) {
    statusParts.push(
      `生命周期 ${row.previousLifecycleStatus ?? '—'} → ${row.newLifecycleStatus ?? '—'}`,
    )
  }
  const description =
    row.changeContent ??
    row.description ??
    (statusParts.length > 0 ? statusParts.join(' · ') : null)

  return {
    id: row.id,
    kind: 'changelog_import',
    title: row.changeAction,
    description,
    fromState: row.previousLifecycleStatus,
    toState: row.newLifecycleStatus,
    ticketNo: row.ticketNo,
    batchCode,
    occurredAt: toIsoDate(row.occurredAt),
  }
}

export function mapActivityFlowRecord(row: SupplierActivityRow): PhysicalDeviceFlowRecord {
  return {
    id: row.id,
    kind: 'activity',
    title: row.title,
    description: row.description,
    operatorName: row.authorName ?? '运营',
    occurredAt: toIsoDate(row.occurredAt),
  }
}

export function mapPhysicalDeviceRow(
  row: SupplierDeviceRow,
  names: { supplierShortName: string; cardTypeName: string },
  computeNode?: {
    clusterName: string | null
    nodeRole: string | null
    expectedService: string | null
  } | null,
): PhysicalDevice {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierShortName: names.supplierShortName,
    contractId: row.contractId,
    onboardingBatchId: row.onboardingBatchId,
    dataCenterId: row.dataCenterId,
    assetNo: row.assetNo ?? '—',
    sn: row.sn,
    lifecycleStatus: row.lifecycleStatus,
    onboardingSubstage: row.onboardingSubstage,
    idcRegion: row.idcRegion,
    idcCode: row.idcCode,
    gpuCount: row.gpuCount,
    cardTypeName: names.cardTypeName,
    externalIp: row.externalIp,
    internalIp: row.internalIp,
    platformResourceId: row.platformResourceId,
    externalDeviceId: row.externalDeviceId,
    opsStatus: row.opsStatus,
    inMaintenance: row.inMaintenance,
    cooperationType: (row.cooperationType ?? 'idle_time') as DeviceCooperationType,
    deviceSpec: row.deviceSpec,
    devicePurpose: row.devicePurpose,
    clusterName: computeNode?.clusterName ?? null,
    nodeRole: computeNode?.nodeRole ?? null,
    expectedService: computeNode?.expectedService ?? null,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  }
}
