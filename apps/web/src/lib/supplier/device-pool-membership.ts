export type PoolKind = 'bare_metal' | 'elastic_service'

export type ResourcePoolBindingLike = {
  poolCode: string | null
  workloadProfile: string
}

const OPS_POOL_MEMBERSHIPS: Record<string, PoolKind[]> = {
  网关直连裸金属上架中: ['bare_metal'],
  网关代理裸金属上架中: ['bare_metal', 'elastic_service'],
  线下裸金属交付中: ['bare_metal'],
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
  bindings: ResourcePoolBindingLike[],
): Set<PoolKind> {
  const pools = new Set<PoolKind>()

  for (const kind of OPS_POOL_MEMBERSHIPS[opsStatus] ?? []) {
    pools.add(kind)
  }

  for (const bind of bindings) {
    if (isBareMetalPool(bind.poolCode, bind.workloadProfile)) pools.add('bare_metal')
    if (isElasticPool(bind.poolCode, bind.workloadProfile)) pools.add('elastic_service')
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
