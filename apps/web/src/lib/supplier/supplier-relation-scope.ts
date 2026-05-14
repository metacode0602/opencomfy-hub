import type { SupplierDomainSeed } from "@/lib/data/supplier-domain-mock"
import {
  contractIdsForSupplier,
  deviceIdsForSupplier,
  nodeIdsForSupplierDevices,
} from "@/lib/stores/supplier-domain-mock-store"

export function supplierRelationScope(seed: SupplierDomainSeed, supplierId: string) {
  const contractIds = contractIdsForSupplier(seed, supplierId)
  const deviceIds = deviceIdsForSupplier(seed, supplierId)
  const nodeIds = nodeIdsForSupplierDevices(seed, deviceIds)
  return { contractIds, deviceIds, nodeIds }
}
