import type { DataCenterDevice } from '@/lib/data/types'
import type { SupplierDevice } from '@/lib/types/supplier-domain'
import { resolveDomainSupplierId } from '@/lib/supplier/supplier-id-bridge'

/** Mock 经营层机房 → 接入域机房（演示映射） */
const MOCK_DC_TO_DOMAIN: Record<string, string> = {
  dc1: 'dc-hb-bj-1',
  dc2: 'dc-hb-sh-2',
  dc4: 'dc-hn-gz-1',
}

function normalizeCardType(name: string): string {
  return name
    .toLowerCase()
    .replace(/nvidia\s+/i, '')
    .replace(/huawei\s+/i, '')
    .replace(/\s+/g, '-')
    .replace(/80gb/g, '80g')
    .replace(/40gb/g, '40g')
    .replace(/32gb/g, '32g')
}

export function matchPhysicalDevicesToInventory(
  inventory: DataCenterDevice,
  devices: SupplierDevice[],
): SupplierDevice[] {
  const domainSupplierId = resolveDomainSupplierId(inventory.supplierId)
  const domainDcId = MOCK_DC_TO_DOMAIN[inventory.dataCenterId]
  const cardKey = normalizeCardType(inventory.cardTypeName)

  return devices.filter((device) => {
    if (device.supplier_id !== domainSupplierId) return false
    if (domainDcId && device.data_center_id !== domainDcId) return false
    return normalizeCardType(device.card_type) === cardKey
  })
}

export function lifecycleToAggregateStatus(lifecycleStatus: string): 'online' | 'offline' | 'maintenance' {
  if (lifecycleStatus === '在线') return 'online'
  if (lifecycleStatus === '维护中') return 'maintenance'
  return 'offline'
}
