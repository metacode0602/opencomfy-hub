import type { SupplierDevice } from '@/lib/types/supplier-domain'
import type {
  DeviceRetireBatchPreview,
  DeviceRetireCommitResult,
  DeviceRetireParsedRow,
  DeviceRetirePreviewResult,
} from '@/lib/types/device-retire'
import { endpointMatches, hasAnyEndpoint } from '@/lib/supplier/ip-endpoint-utils'

const RETIRED_STATUSES = new Set(['已下线', '退订', 'retired'])

function normKey(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

export function findDeviceForRetire(
  devices: SupplierDevice[],
  row: Pick<DeviceRetireParsedRow, 'external_device_id' | 'asset_no' | 'external_ip' | 'internal_ip'>,
): SupplierDevice | undefined {
  if (row.external_device_id) {
    const hit = devices.find((d) => normKey(d.external_device_id) === normKey(row.external_device_id))
    if (hit) return hit
  }

  if (row.asset_no) {
    const hit = devices.find(
      (d) =>
        normKey(d.asset_no) === normKey(row.asset_no) || normKey(d.sn) === normKey(row.asset_no),
    )
    if (hit) return hit
  }

  if (row.external_ip) {
    const hit = devices.find((d) => endpointMatches(d.external_ip, row.external_ip))
    if (hit) return hit
  }

  if (row.internal_ip) {
    const hit = devices.find((d) => endpointMatches(d.internal_ip, row.internal_ip))
    if (hit) return hit
  }

  return undefined
}

function headerIndex(originalHeaders: string[], aliases: string[]): number {
  return originalHeaders.findIndex((h) =>
    aliases.some((a) => normKey(h) === normKey(a)),
  )
}

export function validateDeviceRetireRow(
  row: Omit<
    DeviceRetireParsedRow,
    'parse_status' | 'errors' | 'warnings' | 'errorColumnIndexes' | 'matched_device_id'
  >,
  devicesInDc: SupplierDevice[],
  dataCenterName: string,
  originalHeaders: string[],
): DeviceRetireParsedRow {
  const errors: string[] = []
  const warnings: string[] = []
  const errorColumnIndexes: number[] = []

  const idIdx = headerIndex(originalHeaders, ['设备id', '设备ID', 'external_device_id'])
  const assetIdx = headerIndex(originalHeaders, ['设备标识', 'asset_no', 'sn', '资产号'])
  const extIpIdx = headerIndex(originalHeaders, ['外网ip', '外网IP', '公网ip', 'public_ip', 'external_ip'])
  const intIpIdx = headerIndex(originalHeaders, ['内网ip', '内网IP', '内网ip地址', 'internal_ip'])

  const hasAnyId =
    Boolean(row.external_device_id) ||
    Boolean(row.asset_no) ||
    Boolean(row.external_ip) ||
    Boolean(row.internal_ip)

  if (!hasAnyId) {
    errors.push('至少填写设备ID、设备标识、外网IP、内网IP之一')
    if (idIdx >= 0) errorColumnIndexes.push(idIdx)
    if (assetIdx >= 0) errorColumnIndexes.push(assetIdx)
    if (extIpIdx >= 0) errorColumnIndexes.push(extIpIdx)
    if (intIpIdx >= 0) errorColumnIndexes.push(intIpIdx)
    return {
      ...row,
      parse_status: 'error',
      errors,
      warnings,
      errorColumnIndexes,
      matched_device_id: null,
    }
  }

  if (!hasAnyEndpoint(row.external_ip, row.internal_ip)) {
    errors.push('外网IP与内网IP不能同时为空')
    if (extIpIdx >= 0) errorColumnIndexes.push(extIpIdx)
    if (intIpIdx >= 0) errorColumnIndexes.push(intIpIdx)
    return {
      ...row,
      parse_status: 'error',
      errors,
      warnings,
      errorColumnIndexes,
      matched_device_id: null,
    }
  }

  const device = findDeviceForRetire(devicesInDc, row)
  if (!device) {
    errors.push(`设备在机房「${dataCenterName}」中不存在`)
    if (row.external_device_id && idIdx >= 0) errorColumnIndexes.push(idIdx)
    if (row.asset_no && assetIdx >= 0) errorColumnIndexes.push(assetIdx)
    if (row.external_ip && extIpIdx >= 0) errorColumnIndexes.push(extIpIdx)
    if (row.internal_ip && intIpIdx >= 0) errorColumnIndexes.push(intIpIdx)
    return {
      ...row,
      parse_status: 'error',
      errors,
      warnings,
      errorColumnIndexes,
      matched_device_id: null,
    }
  }

  if (RETIRED_STATUSES.has(device.lifecycle_status) || device.ops_status === '已退订') {
    errors.push(`设备已下架（当前状态：${device.lifecycle_status}）`)
    return {
      ...row,
      parse_status: 'error',
      errors,
      warnings,
      errorColumnIndexes,
      matched_device_id: device.id,
    }
  }

  if (device.in_maintenance) {
    warnings.push('设备处于维修中，下架前请确认运维已完成')
  }
  if (device.platform_resource_id) {
    warnings.push(`设备已绑定平台资源 ${device.platform_resource_id}，下架后将解除绑定`)
  }
  if (device.lifecycle_status === '接入中') {
    warnings.push('设备仍在接入流程中，建议先完成或终止接入后再下架')
  }

  return {
    ...row,
    parse_status: warnings.length > 0 ? 'warning' : 'ok',
    errors,
    warnings,
    errorColumnIndexes,
    matched_device_id: device.id,
  }
}

export function validateDeviceRetireBatch(params: {
  dataCenterId: string
  dataCenterName: string
  fileName: string
  originalHeaders: string[]
  parsedRows: Omit<
    DeviceRetireParsedRow,
    'parse_status' | 'errors' | 'warnings' | 'errorColumnIndexes' | 'matched_device_id'
  >[]
  devices: SupplierDevice[]
}): DeviceRetireBatchPreview {
  const devicesInDc = params.devices.filter((d) => d.data_center_id === params.dataCenterId)
  const rows = params.parsedRows.map((row) =>
    validateDeviceRetireRow(row, devicesInDc, params.dataCenterName, params.originalHeaders),
  )

  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.parse_status === 'ok').length,
    warning: rows.filter((r) => r.parse_status === 'warning').length,
    error: rows.filter((r) => r.parse_status === 'error').length,
  }

  return {
    dataCenterId: params.dataCenterId,
    dataCenterName: params.dataCenterName,
    fileName: params.fileName,
    originalHeaders: params.originalHeaders,
    rows,
    summary,
  }
}

export function buildDeviceRetirePreview(params: {
  supplierId: string
  meta: DeviceRetirePreviewResult['meta']
  batches: DeviceRetireBatchPreview[]
}): DeviceRetirePreviewResult {
  const totals = params.batches.reduce(
    (acc, b) => ({
      total: acc.total + b.summary.total,
      ok: acc.ok + b.summary.ok,
      warning: acc.warning + b.summary.warning,
      error: acc.error + b.summary.error,
    }),
    { total: 0, ok: 0, warning: 0, error: 0 },
  )

  return {
    supplierId: params.supplierId,
    meta: params.meta,
    batches: params.batches,
    summary: {
      ...totals,
      batchCount: params.batches.length,
    },
  }
}

export function summarizeDeviceRetireCommit(preview: DeviceRetirePreviewResult): DeviceRetireCommitResult {
  const batchCodes = preview.batches.map((_, i) =>
    `RET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
  )
  const retiredCount = preview.batches.reduce(
    (sum, b) => sum + b.rows.filter((r) => r.parse_status !== 'error').length,
    0,
  )
  return {
    batchCount: preview.batches.length,
    retiredCount,
    skippedCount: preview.summary.error,
    batchCodes,
    meta: preview.meta,
  }
}

/** @deprecated 使用 summarizeDeviceRetireCommit；Mock 阶段保留别名 */
export const mockCommitDeviceRetire = summarizeDeviceRetireCommit
