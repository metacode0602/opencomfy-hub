export type PoolKind = 'bare_metal' | 'elastic_service'

export type ResourcePoolBindingLike = {
  poolCode: string | null
  workloadProfile: string
}

/**
 * ops_status → 资源池（主数据真源，§supplier-device-ops-pool-masterdata-design.md §3.1）
 * infra/CPU 设备在聚合层 metricGpuCount=0，池列不累加 GPU。
 */
export const OPS_POOL_MEMBERSHIPS: Record<string, readonly PoolKind[]> = {
  在集群中: ['elastic_service'],
  集群组件运行中: ['elastic_service'],
  网关直连裸金属上架中: ['bare_metal'],
  单机直连裸金属上架中: ['bare_metal'],
  网关代理裸金属上架中: ['bare_metal', 'elastic_service'],
  线下裸金属交付中: ['bare_metal'],
  网关节点上架中: ['bare_metal', 'elastic_service'],
}

export function isElasticPool(poolCode: string | null, workloadProfile: string): boolean {
  const code = (poolCode ?? '').toLowerCase()
  const profile = workloadProfile.toLowerCase()
  return code === 'platform' || profile === 'elastic_service'
}

export function isBareMetalPool(poolCode: string | null, workloadProfile: string): boolean {
  const code = (poolCode ?? '').toLowerCase()
  const profile = workloadProfile.toLowerCase()
  return profile === 'bare_metal' || code.includes('bare')
}

export function resolveDevicePoolMemberships(
  opsStatus: string,
  _bindings: ResourcePoolBindingLike[] = [],
): Set<PoolKind> {
  const pools = new Set<PoolKind>()

  for (const kind of OPS_POOL_MEMBERSHIPS[opsStatus] ?? []) {
    pools.add(kind)
  }

  return pools
}

export function isDualPool(memberships: Set<PoolKind>): boolean {
  return memberships.has('bare_metal') && memberships.has('elastic_service')
}

export function poolKindForFilterPoolCode(
  poolCode: string,
  sampleBindings: ResourcePoolBindingLike[],
): PoolKind | null {
  const ref = sampleBindings.find((b) => b.poolCode === poolCode)
  if (!ref) {
    if (poolCode.toLowerCase().includes('bare')) return 'bare_metal'
    if (poolCode.toLowerCase() === 'platform') return 'elastic_service'
    return null
  }
  if (isBareMetalPool(ref.poolCode, ref.workloadProfile)) return 'bare_metal'
  if (isElasticPool(ref.poolCode, ref.workloadProfile)) return 'elastic_service'
  return null
}
