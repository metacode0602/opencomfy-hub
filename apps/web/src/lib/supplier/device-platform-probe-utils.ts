/** 平台探测展示工具（supplier-device-platform-probe-design.md） */

export type ProbeStatus =
  | 'no_internal_ip'
  | 'dc_unmapped'
  | 'platform_absent'
  | 'proxy_only'
  | 'k8s_only'
  | 'bare_metal_only'
  | 'proxy_and_k8s'
  | 'proxy_and_bare_metal'
  | 'k8s_and_bare_metal'
  | 'all_matched'
  | 'ambiguous'

export type ConsistencyFlag =
  | 'consistent'
  | 'missing_platform'
  | 'unexpected_platform'
  | 'multi_channel_conflict'
  | 'not_evaluated'

export type ProxyRentStatus = 'Idle' | 'ElasticRenting'

/** device_info/list 抓取字段 */
export type DeviceInfoPlatformRecord = {
  matched: boolean
  platformDeviceId: string | null
  name: string | null
  idcName: string | null
  innerIp: string | null
  pubIp: string | null
  rentStatus: ProxyRentStatus | null
  isContainerInstance: boolean | null
  onlineStatus: string | null
  shelfStatus: string | null
  listingMode: string | null
  gpuModel: string | null
  gpuCount: number | null
  lastConnectionTime: string | null
}

/** node_device/list 抓取字段 */
export type NodeDevicePlatformRecord = {
  matched: boolean
  platformNodeId: string | null
  deviceName: string | null
  region: string | null
  innerIp: string | null
  gpuName: string | null
  gpuCount: number | null
  hash: string | null
  offlineDate: string | null
}

/** 裸金属订单明细（本地 DB） */
export type BareMetalPlatformRecord = {
  matched: boolean
  orderNo: string | null
  orderStatus: string | null
  platformOrderId: string | null
  idcName: string | null
  bareMetalRegion: string | null
  internalIp: string | null
  tenantName: string | null
  gpuModelText: string | null
  rentEndsAt: string | null
}

/** CRM 侧快照字段 */
export type CrmProbeSnapshot = {
  opsStatus: string
  lifecycleStatus: string
  inMaintenance: boolean
  internalIp: string | null
  externalIp: string | null
  dataCenterName: string | null
  containerInstanceRegion: string | null
  bareMetalRegion: string | null
  idcCode: string | null
  gpuCardTypeName: string | null
  gpuCount: number | null
}

/** 设备变更记录（supplier_device_change_log） */
export type DeviceProbeChangeLog = {
  id: string
  occurredAt: string
  changeAction: string
  changeContent: string | null
  description: string | null
  ticketNo: string | null
  internalIp: string | null
}

export type DevicePlatformProbeDetail = {
  row: DevicePlatformProbeRow
  crm: CrmProbeSnapshot
  deviceInfo: DeviceInfoPlatformRecord
  nodeDevice: NodeDevicePlatformRecord
  bareMetal: BareMetalPlatformRecord
  changeLogs: DeviceProbeChangeLog[]
}

export type DevicePlatformProbeRow = {
  id: string
  supplierDeviceId: string
  sn: string
  internalIp: string | null
  dataCenterName: string | null
  opsStatus: string
  lifecycleStatus: string
  snapshotHour: string
  probeStatus: ProbeStatus
  consistencyFlag: ConsistencyFlag
  proxyMatched: boolean
  proxyRentStatus: ProxyRentStatus | null
  proxyIsContainerInstance: boolean | null
  k8sMatched: boolean
  k8sDeviceName: string | null
  bareMetalMatched: boolean
  bareMetalOrderNo: string | null
  suggestedAction: string
}

export const PROBE_STATUS_LABELS: Record<ProbeStatus, string> = {
  no_internal_ip: '缺内网 IP',
  dc_unmapped: '机房未映射',
  platform_absent: '平台无信号',
  proxy_only: '仅接入端',
  k8s_only: '仅 K8s',
  bare_metal_only: '仅裸金属订单',
  proxy_and_k8s: '接入端 + K8s',
  proxy_and_bare_metal: '接入端 + 裸金属',
  k8s_and_bare_metal: 'K8s + 裸金属',
  all_matched: '三路齐',
  ambiguous: '匹配不唯一',
}

export const CONSISTENCY_FLAG_LABELS: Record<ConsistencyFlag, string> = {
  consistent: '一致',
  missing_platform: '平台缺失',
  unexpected_platform: '平台异常信号',
  multi_channel_conflict: '租赁态冲突',
  not_evaluated: '未评估',
}

/** 页面 Badge 语义色 */
export const CONSISTENCY_FLAG_VARIANT: Record<
  ConsistencyFlag,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  consistent: 'secondary',
  missing_platform: 'destructive',
  unexpected_platform: 'destructive',
  multi_channel_conflict: 'outline',
  not_evaluated: 'outline',
}

export function formatProxyRentDisplay(
  matched: boolean,
  rentStatus: ProxyRentStatus | null,
  isContainerInstance: boolean | null,
): string {
  if (!matched) return '—'
  if (rentStatus === 'Idle') return '空闲'
  if (rentStatus === 'ElasticRenting') {
    if (isContainerInstance === true) return '弹性服务（出租中）'
    if (isContainerInstance === false) return '裸金属（出租中）'
    return '弹性服务（出租中）'
  }
  return rentStatus ?? '—'
}

export function formatChannelHits(row: DevicePlatformProbeRow): string {
  const parts: string[] = []
  if (row.proxyMatched) parts.push('接入端')
  if (row.k8sMatched) parts.push('K8s')
  if (row.bareMetalMatched) parts.push('裸金属')
  return parts.length > 0 ? parts.join(' · ') : '无'
}

export function formatSnapshotHourLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatProbeDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export type ProbeCompareRow = {
  label: string
  crm: string
  deviceInfo: string
  nodeDevice: string
  bareMetal: string
  highlight?: boolean
}

export function buildProbeCompareRows(detail: DevicePlatformProbeDetail): ProbeCompareRow[] {
  const { crm, deviceInfo: di, nodeDevice: nd, bareMetal: bm } = detail
  const ip = (a: string | null | undefined) => a ?? '—'
  const bool = (v: boolean | null | undefined) =>
    v === null || v === undefined ? '—' : v ? '是' : '否'

  return [
    {
      label: '内网 IP',
      crm: ip(crm.internalIp),
      deviceInfo: ip(di.innerIp),
      nodeDevice: ip(nd.innerIp),
      bareMetal: ip(bm.internalIp),
      highlight:
        !!crm.internalIp &&
        [di.innerIp, nd.innerIp, bm.internalIp].some((x) => x && x !== crm.internalIp),
    },
    {
      label: '机房 / 区域',
      crm: [crm.dataCenterName, crm.containerInstanceRegion].filter(Boolean).join(' / ') || '—',
      deviceInfo: ip(di.idcName),
      nodeDevice: ip(nd.region),
      bareMetal: [bm.idcName, bm.bareMetalRegion].filter(Boolean).join(' / ') || '—',
    },
    {
      label: '运维 / 订单状态',
      crm: crm.opsStatus,
      deviceInfo: di.rentStatus
        ? `${di.rentStatus}${di.isContainerInstance != null ? ` · 容器实例=${bool(di.isContainerInstance)}` : ''}`
        : '—',
      nodeDevice: nd.matched ? '已上报' : '—',
      bareMetal: bm.orderStatus ?? '—',
    },
    {
      label: 'GPU',
      crm: crm.gpuCardTypeName ? `${crm.gpuCardTypeName} × ${crm.gpuCount ?? '—'}` : '—',
      deviceInfo: di.gpuModel ? `${di.gpuModel} × ${di.gpuCount ?? '—'}` : '—',
      nodeDevice: nd.gpuName ? `${nd.gpuName} × ${nd.gpuCount ?? '—'}` : '—',
      bareMetal: bm.gpuModelText ?? '—',
    },
  ]
}

export function devicePlatformProbeListPath(): string {
  return '/supplier/device-platform-probe'
}

export function devicePlatformProbeDetailPath(id: string): string {
  return `/supplier/device-platform-probe/${id}`
}
