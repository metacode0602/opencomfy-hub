import type {
  ConsistencyFlag,
  ProbeStatus,
  ProxyRentStatus,
} from '@/lib/supplier/device-platform-probe-utils'

type ChannelRequirement = 'required' | 'optional' | 'none'

type OpsChannelExpectation = {
  proxy: ChannelRequirement
  k8s: ChannelRequirement
  bareMetal: ChannelRequirement
}

/** §4.4.2 ops_status 期望通道矩阵 */
const OPS_CHANNEL_MATRIX: Record<string, OpsChannelExpectation> = {
  预留闲置中: { proxy: 'none', k8s: 'none', bareMetal: 'none' },
  在集群中: { proxy: 'optional', k8s: 'required', bareMetal: 'none' },
  集群组件运行中: { proxy: 'optional', k8s: 'required', bareMetal: 'none' },
  不可调度节点运行中: { proxy: 'optional', k8s: 'required', bareMetal: 'none' },
  网关直连裸金属上架中: { proxy: 'required', k8s: 'none', bareMetal: 'optional' },
  单机直连裸金属上架中: { proxy: 'required', k8s: 'none', bareMetal: 'optional' },
  网关代理裸金属上架中: { proxy: 'required', k8s: 'required', bareMetal: 'optional' },
  网关节点上架中: { proxy: 'required', k8s: 'optional', bareMetal: 'none' },
  线下裸金属交付中: { proxy: 'optional', k8s: 'none', bareMetal: 'required' },
  其他部门使用中: { proxy: 'none', k8s: 'none', bareMetal: 'none' },
}

const ELASTIC_POOL_OPS = new Set([
  '在集群中',
  '集群组件运行中',
  '不可调度节点运行中',
  '网关代理裸金属上架中',
  '网关节点上架中',
])

const BARE_METAL_POOL_OPS = new Set([
  '网关直连裸金属上架中',
  '单机直连裸金属上架中',
  '网关代理裸金属上架中',
  '线下裸金属交付中',
])

const DUAL_POOL_OPS = new Set(['网关代理裸金属上架中'])

export function deriveProbeStatus(input: {
  hasInternalIp: boolean
  hasDcMapping: boolean
  proxyMatched: boolean
  k8sMatched: boolean
  bareMetalMatched: boolean
  ambiguous: boolean
}): ProbeStatus {
  if (!input.hasInternalIp) return 'no_internal_ip'
  if (!input.hasDcMapping) return 'dc_unmapped'
  if (input.ambiguous) return 'ambiguous'

  const p = input.proxyMatched
  const k = input.k8sMatched
  const b = input.bareMetalMatched
  const count = [p, k, b].filter(Boolean).length

  if (count === 0) return 'platform_absent'
  if (count === 3) return 'all_matched'
  if (p && k && !b) return 'proxy_and_k8s'
  if (p && b && !k) return 'proxy_and_bare_metal'
  if (k && b && !p) return 'k8s_and_bare_metal'
  if (p && !k && !b) return 'proxy_only'
  if (k && !p && !b) return 'k8s_only'
  if (b && !p && !k) return 'bare_metal_only'
  return 'platform_absent'
}

function channelHit(matched: boolean): boolean {
  return matched
}

function isRentConflict(input: {
  opsStatus: string
  proxyMatched: boolean
  proxyRentStatus: ProxyRentStatus | null
  proxyIsContainerInstance: boolean | null
  k8sMatched: boolean
  bareMetalMatched: boolean
}): boolean {
  if (!input.proxyMatched || !input.proxyRentStatus) return false
  const rent = input.proxyRentStatus
  const isContainer = input.proxyIsContainerInstance

  if (input.opsStatus === '预留闲置中' && rent === 'ElasticRenting') return true

  if (ELASTIC_POOL_OPS.has(input.opsStatus) && rent === 'ElasticRenting' && isContainer === false) {
    if (!input.bareMetalMatched && !DUAL_POOL_OPS.has(input.opsStatus)) return true
  }

  if (BARE_METAL_POOL_OPS.has(input.opsStatus) && rent === 'ElasticRenting' && isContainer === true) {
    if (!input.k8sMatched && !DUAL_POOL_OPS.has(input.opsStatus)) return true
  }

  return false
}

export function deriveConsistencyFlag(input: {
  probeStatus: ProbeStatus
  opsStatus: string
  proxyMatched: boolean
  proxyRentStatus: ProxyRentStatus | null
  proxyIsContainerInstance: boolean | null
  k8sMatched: boolean
  bareMetalMatched: boolean
}): ConsistencyFlag {
  if (['no_internal_ip', 'dc_unmapped', 'ambiguous'].includes(input.probeStatus)) {
    return 'not_evaluated'
  }

  const matrix = OPS_CHANNEL_MATRIX[input.opsStatus] ?? {
    proxy: 'none' as const,
    k8s: 'none' as const,
    bareMetal: 'none' as const,
  }

  const proxyHit = channelHit(input.proxyMatched)
  const k8sHit = channelHit(input.k8sMatched)
  const bareMetalHit = channelHit(input.bareMetalMatched)

  const missing =
    (matrix.proxy === 'required' && !proxyHit) ||
    (matrix.k8s === 'required' && !k8sHit) ||
    (matrix.bareMetal === 'required' && !bareMetalHit)

  if (missing) return 'missing_platform'

  if (isRentConflict(input)) return 'multi_channel_conflict'

  if (
    input.opsStatus === '预留闲置中' &&
    proxyHit &&
    input.proxyRentStatus === 'Idle'
  ) {
    return 'consistent'
  }

  const unexpected =
    (matrix.proxy === 'none' && proxyHit) ||
    (matrix.k8s === 'none' && k8sHit) ||
    (matrix.bareMetal === 'none' && bareMetalHit)

  if (unexpected) return 'unexpected_platform'

  const requirementsMet =
    (matrix.proxy !== 'required' || proxyHit) &&
    (matrix.k8s !== 'required' || k8sHit) &&
    (matrix.bareMetal !== 'required' || bareMetalHit)

  if (requirementsMet) return 'consistent'

  return 'multi_channel_conflict'
}

export function deriveSuggestedAction(input: {
  probeStatus: ProbeStatus
  consistencyFlag: ConsistencyFlag
}): string {
  if (input.probeStatus === 'no_internal_ip') return '补充内网 IP 后重新导入设备主数据'
  if (input.probeStatus === 'dc_unmapped') return '关联机房并配置容器 region / 裸金属 region'
  if (input.probeStatus === 'ambiguous') return '同机房同 IP 存在多条平台记录，需人工消歧'
  if (input.consistencyFlag === 'missing_platform') {
    return '主数据称在线但平台无对应通道信号，核对 IP / region 或平台接入'
  }
  if (input.consistencyFlag === 'unexpected_platform') {
    return '平台有信号但主数据未体现，更新设备主数据或确认平台是否误占'
  }
  if (input.consistencyFlag === 'multi_channel_conflict') {
    return '多通道租赁态与 ops 池归属矛盾，需人工核对'
  }
  if (input.consistencyFlag === 'consistent') return '无需处理'
  return '待评估'
}

export function isNeedsActionConsistency(flag: ConsistencyFlag): boolean {
  return ['missing_platform', 'unexpected_platform', 'multi_channel_conflict'].includes(flag)
}
