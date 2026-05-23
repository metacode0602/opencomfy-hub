import type { SupplierDevice } from '@/lib/types/supplier-domain'
import { supplierDevice } from '@workspace/db/schema'

export function mapDbDeviceToDomain(
  row: typeof supplierDevice.$inferSelect,
  cardTypeName: string,
): SupplierDevice {
  return {
    id: row.id,
    supplier_id: row.supplierId,
    contract_id: row.contractId,
    onboarding_batch_id: row.onboardingBatchId ?? '',
    data_center_id: row.dataCenterId ?? '',
    asset_no: row.assetNo ?? '',
    sn: row.sn,
    lifecycle_status: row.lifecycleStatus,
    onboarding_substage: row.onboardingSubstage ?? '',
    idc_region: row.idcRegion ?? '',
    idc_code: row.idcCode,
    gpu_count: String(row.gpuCount),
    card_type: cardTypeName,
    gpu_card_type_id: row.gpuCardTypeId,
    external_ip: row.externalIp ?? '',
    internal_ip: row.internalIp ?? '',
    platform_resource_id: row.platformResourceId,
    external_device_id: row.externalDeviceId,
    ops_status: row.opsStatus,
    in_maintenance: row.inMaintenance,
    bandwidth_group: row.bandwidthGroup,
    rate_limit: row.rateLimit,
    cooperation_type: (row.cooperationType ?? 'idle_time') as SupplierDevice['cooperation_type'],
    device_spec: row.deviceSpec,
    device_purpose: row.devicePurpose,
    received_at: row.receivedAt?.toISOString() ?? null,
    remark: row.remark,
    login_username: row.loginUsername,
    login_password: row.loginPassword,
  }
}
