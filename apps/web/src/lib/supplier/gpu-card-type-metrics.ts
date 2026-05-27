export type GpuCardTypeRole = 'compute' | 'infra'

export const DEFAULT_GPU_PER_DEVICE = 8

export type GpuCardTypeRef = {
  name: string
  code?: string | null
  deviceRole?: string | null
}

export function resolveGpuCardTypeRole(card: GpuCardTypeRef): GpuCardTypeRole {
  if (card.deviceRole === 'infra' || card.deviceRole === 'compute') {
    return card.deviceRole
  }
  const hay = `${card.name ?? ''} ${card.code ?? ''}`.toLowerCase()
  if (hay.includes('cpu')) return 'infra'
  return 'compute'
}

export function isInfraCardType(card: GpuCardTypeRef): boolean {
  return resolveGpuCardTypeRole(card) === 'infra'
}

export function effectiveGpuCount(gpuCount: number, role: GpuCardTypeRole): number {
  return role === 'infra' ? 0 : Math.max(0, gpuCount)
}

export function resolveDeviceGpuCount(
  rawGpuCount: number | string | undefined | null,
  role: GpuCardTypeRole,
): number {
  if (role === 'infra') return 0
  const n = typeof rawGpuCount === 'string' ? Number(rawGpuCount) : rawGpuCount
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return Math.floor(n)
  return DEFAULT_GPU_PER_DEVICE
}

export function metricGpuCount(device: {
  gpuCount: number
  cardTypeName: string
  cardTypeCode?: string | null
  cardTypeRole?: GpuCardTypeRole
}): number {
  const role =
    device.cardTypeRole ??
    resolveGpuCardTypeRole({ name: device.cardTypeName, code: device.cardTypeCode })
  return effectiveGpuCount(device.gpuCount, role)
}

/** L1 库存行对 GPU KPI 的有效卡数（infra 行 quantity 为台数，不计入 GPU） */
export function inventoryGpuQuantity(
  role: GpuCardTypeRole,
  quantity: number,
): number {
  return role === 'infra' ? 0 : quantity
}
