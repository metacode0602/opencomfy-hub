import 'server-only'

import { z } from 'zod'
import { crmLog, crmWarn } from '@/lib/server/dataaccess/crm/logger'
import { getDevicePlatformProbePageSize } from '@/lib/server/dataaccess/supplier/device-platform-probe-config'
import {
  normalizeIdcKey,
  normalizeIpHost,
  normalizeRegionKey,
} from '@/lib/server/dataaccess/supplier/device-platform-probe-keys'
import adminInstance from './request'

const paginatedSchema = z.object({
  count: z.number().nullish(),
  results: z.array(z.record(z.string(), z.unknown())).optional(),
})

const PROXY_ALLOWLIST = new Set([
  'id',
  'name',
  'idc_name',
  'inner_ip',
  'pub_ip',
  'rent_status',
  'is_container_instance',
  'online_status',
  'shelf_status',
  'listing_mode',
  'gpu_model',
  'gpu_count',
  'last_connection_time',
])

const K8S_ALLOWLIST = new Set([
  'id',
  'device_name',
  'region',
  'inner_ip',
  'gpu_name',
  'gpu_count',
  'hash',
  'offline_date',
])

function pickPayload(raw: Record<string, unknown>, allowlist: Set<string>) {
  const out: Record<string, unknown> = {}
  for (const key of allowlist) {
    if (key in raw) out[key] = raw[key]
  }
  return out
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAllPages(
  label: string,
  path: string,
  traceId: string,
  filter: (row: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>[]> {
  const pageSize = getDevicePlatformProbePageSize()
  const pageDelay = Number(process.env.SUANLI_API_PAGE_DELAY_MS ?? 200)
  const rows: Record<string, unknown>[] = []
  let page = 1
  let total: number | null = null

  while (true) {
    crmLog('device-probe-api', `${label} page ${page}`, { traceId, pageSize })
    const data = await adminInstance.get<unknown>(path, { params: { page, page_size: pageSize } })
    const parsed = paginatedSchema.safeParse(data)
    if (!parsed.success) {
      if (Array.isArray(data)) {
        for (const raw of data) {
          if (typeof raw === 'object' && raw && filter(raw as Record<string, unknown>)) {
            rows.push(raw as Record<string, unknown>)
          }
        }
        break
      }
      throw new Error(`${label} 返回格式异常`)
    }
    const batch = (parsed.data.results ?? []).filter(filter)
    rows.push(...batch)
    if (parsed.data.count != null) total = parsed.data.count
    if (batch.length < pageSize) break
    if (total != null && rows.length >= total) break
    page += 1
    if (pageDelay > 0) await delay(pageDelay)
  }

  crmLog('device-probe-api', `${label} fetched`, { traceId, count: rows.length })
  return rows
}

export type StagedProxyRow = {
  platformDeviceId: string | null
  idcKey: string
  ipHost: string
  rawInnerIp: string | null
  rentStatus: string | null
  isContainerInstance: boolean | null
  payload: Record<string, unknown>
}

export type StagedK8sRow = {
  platformNodeId: string | null
  regionKey: string
  ipHost: string
  rawInnerIp: string | null
  deviceName: string | null
  gpuName: string | null
  gpuCount: number | null
  hash: string | null
  payload: Record<string, unknown>
}

export async function fetchDeviceInfoForProbe(traceId: string): Promise<StagedProxyRow[]> {
  const rawRows = await fetchAllPages(
    'device_info',
    '/admin/device_info/list',
    traceId,
    (row) => row.is_delete !== true,
  )

  return rawRows
    .map((row) => {
      const innerIp = row.inner_ip != null ? String(row.inner_ip) : null
      const idcKey = normalizeIdcKey(row.idc_name != null ? String(row.idc_name) : null)
      const ipHost = normalizeIpHost(innerIp)
      if (!idcKey || !ipHost) return null
      return {
        platformDeviceId: row.id != null ? String(row.id) : null,
        idcKey,
        ipHost,
        rawInnerIp: innerIp,
        rentStatus: row.rent_status != null ? String(row.rent_status) : null,
        isContainerInstance:
          typeof row.is_container_instance === 'boolean' ? row.is_container_instance : null,
        payload: pickPayload(row, PROXY_ALLOWLIST),
      } satisfies StagedProxyRow
    })
    .filter((row): row is StagedProxyRow => row != null)
}

export async function fetchNodeDevicesForProbe(traceId: string): Promise<StagedK8sRow[]> {
  const rawRows = await fetchAllPages(
    'node_device',
    '/admin/node_device/list',
    traceId,
    (row) => row.offline_date == null || row.offline_date === '',
  )

  return rawRows
    .map((row) => {
      const innerIp = row.inner_ip != null ? String(row.inner_ip) : null
      const regionKey = normalizeRegionKey(row.region != null ? String(row.region) : null)
      const ipHost = normalizeIpHost(innerIp)
      if (!regionKey || !ipHost) return null
      return {
        platformNodeId: row.id != null ? String(row.id) : null,
        regionKey,
        ipHost,
        rawInnerIp: innerIp,
        deviceName: row.device_name != null ? String(row.device_name) : null,
        gpuName: row.gpu_name != null ? String(row.gpu_name) : null,
        gpuCount: typeof row.gpu_count === 'number' ? row.gpu_count : null,
        hash: row.hash != null ? String(row.hash) : null,
        payload: pickPayload(row, K8S_ALLOWLIST),
      } satisfies StagedK8sRow
    })
    .filter((row): row is StagedK8sRow => row != null)
}

export async function fetchDeviceProbeChannels(traceId: string): Promise<{
  proxyRows: StagedProxyRow[]
  k8sRows: StagedK8sRow[]
  proxyError?: string
  k8sError?: string
}> {
  let proxyRows: StagedProxyRow[] = []
  let k8sRows: StagedK8sRow[] = []
  let proxyError: string | undefined
  let k8sError: string | undefined

  try {
    proxyRows = await fetchDeviceInfoForProbe(traceId)
  } catch (error) {
    proxyError = error instanceof Error ? error.message : 'device_info 拉取失败'
    crmWarn('device-probe-api', 'device_info failed', { traceId, error: proxyError })
  }

  try {
    k8sRows = await fetchNodeDevicesForProbe(traceId)
  } catch (error) {
    k8sError = error instanceof Error ? error.message : 'node_device 拉取失败'
    crmWarn('device-probe-api', 'node_device failed', { traceId, error: k8sError })
  }

  return { proxyRows, k8sRows, proxyError, k8sError }
}
