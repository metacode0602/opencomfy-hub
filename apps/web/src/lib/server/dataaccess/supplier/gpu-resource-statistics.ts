import { db } from '@/lib/db'
import {
  getAdminStatisticsDataCountAPI,
  getGpuUsageAPI,
  getResourceStatisticsListAPI,
  getSourceStatisticsByRegionAndGpuAPI,
} from '@/lib/server/integrations/api'
import { supplierError, supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import type {
  AdminStatisticsDataCountResult,
  GpuRegionOverviewResult,
  GpuRegionUsageRow,
  GpuResourceTrendPoint,
  GpuResourceTrendRange,
  GpuResourceTrendRegionPoint,
  GpuResourceTrendResult,
} from '@/lib/types/supplier-overview-api'
import { dataCenter, gpuCardType, supplierGpuInventory } from '@workspace/db/schema'
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm'

type ApiStatisticsRow = {
  id: number
  region: string
  gpu_name: string
  total_count: number
  total_used_count: number
  total_spot_used_count?: number
  last_update_time: string
  create_time: string
}

type ApiListResponse = {
  results: ApiStatisticsRow[]
  count: number
}

type ApiGpuUsageRow = {
  region: string
  total_count: number
  total_used_count: number
  total_spot_used_count?: number
}

type ApiSourceStatsRow = {
  region: string
  gpu_name: string
  total_device_count: number
  total_gpu_count: number
}

type ApiTypeCountRow = {
  type: string
  count: number
}

type ApiDataCountPayload = {
  source?: ApiTypeCountRow[]
  gpu?: ApiTypeCountRow[]
}

function sumTypeCounts(rows: ApiTypeCountRow[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0)
}

const RANGE_MS: Record<GpuResourceTrendRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

function parsePlatformTimestamp(raw: string): Date | null {
  const normalized = raw.trim().replace(' ', 'T').replace(' +', '+')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatChartLabel(date: Date): string {
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

async function loadQueryParams(): Promise<{
  gpuNames: string[]
  regions: string[]
  regionLabels: Map<string, string>
}> {
  const [regionRows, gpuRows] = await Promise.all([
    db
      .select({
        region: dataCenter.containerInstanceRegion,
        name: dataCenter.name,
      })
      .from(dataCenter)
      .where(
        and(
          isNotNull(dataCenter.containerInstanceRegion),
          ne(dataCenter.containerInstanceRegion, ''),
          eq(dataCenter.sourceDeleted, false),
        ),
      ),
    db
      .selectDistinct({ code: gpuCardType.code })
      .from(supplierGpuInventory)
      .innerJoin(dataCenter, eq(supplierGpuInventory.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id))
      .where(
        and(
          eq(dataCenter.sourceDeleted, false),
          eq(gpuCardType.deviceRole, 'compute'),
          sql`${gpuCardType.code} <> ''`,
        ),
      ),
  ])

  const regions = new Set<string>()
  const regionLabels = new Map<string, string>()
  for (const row of regionRows) {
    const region = row.region?.trim()
    if (!region) continue
    regions.add(region)
    if (!regionLabels.has(region)) {
      regionLabels.set(region, row.name)
    }
  }

  const gpuNames = gpuRows
    .map((row) => row.code.trim())
    .filter(Boolean)
    .sort()

  return {
    gpuNames,
    regions: [...regions].sort(),
    regionLabels,
  }
}

function buildTrendPoints(
  rows: ApiStatisticsRow[],
  regionLabels: Map<string, string>,
): GpuResourceTrendPoint[] {
  const byTimestamp = new Map<
    string,
    {
      timestamp: string
      label: string
      regions: Map<string, { totalCount: number; usedCount: number }>
    }
  >()

  for (const row of rows) {
    const parsed = parsePlatformTimestamp(row.last_update_time || row.create_time)
    if (!parsed) continue

    const timestamp = parsed.toISOString()
    if (!byTimestamp.has(timestamp)) {
      byTimestamp.set(timestamp, {
        timestamp,
        label: formatChartLabel(parsed),
        regions: new Map(),
      })
    }

    const bucket = byTimestamp.get(timestamp)!
    const region = row.region?.trim()
    if (!region) continue

    const prev = bucket.regions.get(region) ?? { totalCount: 0, usedCount: 0 }
    bucket.regions.set(region, {
      totalCount: prev.totalCount + (row.total_count ?? 0),
      usedCount: prev.usedCount + (row.total_used_count ?? 0),
    })
  }

  return [...byTimestamp.values()]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((bucket) => {
      const regions: GpuResourceTrendRegionPoint[] = [...bucket.regions.entries()]
        .map(([region, stats]) => ({
          region,
          dataCenterName: regionLabels.get(region) ?? null,
          totalCount: stats.totalCount,
          usedCount: stats.usedCount,
        }))
        .sort((a, b) => b.totalCount - a.totalCount)

      const totalCount = regions.reduce((sum, r) => sum + r.totalCount, 0)
      const usedCount = regions.reduce((sum, r) => sum + r.usedCount, 0)

      return {
        timestamp: bucket.timestamp,
        label: bucket.label,
        totalCount,
        usedCount,
        regions,
      }
    })
}

function buildRegionOverviewRows(
  usageRows: ApiGpuUsageRow[],
  sourceRows: ApiSourceStatsRow[],
  regionLabels: Map<string, string>,
): GpuRegionUsageRow[] {
  const sourceByRegion = new Map<string, ApiSourceStatsRow>()
  for (const row of sourceRows) {
    const region = row.region?.trim()
    if (!region) continue
    sourceByRegion.set(region, row)
  }

  const regionSet = new Set<string>()
  for (const row of usageRows) {
    const region = row.region?.trim()
    if (region) regionSet.add(region)
  }
  for (const row of sourceRows) {
    const region = row.region?.trim()
    if (region) regionSet.add(region)
  }

  return [...regionSet]
    .map((region) => {
      const usage = usageRows.find((row) => row.region?.trim() === region)
      const source = sourceByRegion.get(region)
      const elasticUsedCount = usage?.total_used_count ?? 0
      const spotUsedCount = usage?.total_spot_used_count ?? 0
      const totalGpuCount = usage?.total_count ?? source?.total_gpu_count ?? 0
      const idleCount = Math.max(0, totalGpuCount - elasticUsedCount - spotUsedCount)

      return {
        region,
        dataCenterName: regionLabels.get(region) ?? null,
        gpuName: source?.gpu_name ?? null,
        totalGpuCount,
        totalDeviceCount: source?.total_device_count ?? 0,
        elasticUsedCount,
        spotUsedCount,
        idleCount,
      }
    })
    .sort((a, b) => b.totalGpuCount - a.totalGpuCount)
}

export const gpuResourceStatisticsDataAccess = {
  async getAdminStatisticsDataCount(region: string): Promise<AdminStatisticsDataCountResult> {
    const params = region !== 'all' ? { regions: region } : {}

    try {
      const data = (await getAdminStatisticsDataCountAPI(params)) as ApiDataCountPayload
      const result: AdminStatisticsDataCountResult = {
        deviceCount: sumTypeCounts(data.source),
        gpuCount: sumTypeCounts(data.gpu),
      }

      supplierLog('adminStatisticsDataCount', 'getAdminStatisticsDataCount done', {
        region,
        ...result,
      })

      return result
    } catch (e) {
      supplierError('adminStatisticsDataCount', 'getAdminStatisticsDataCount failed', e, {
        region,
      })
      throw e
    }
  },

  async getRegionOverview(): Promise<GpuRegionOverviewResult> {
    supplierLog('gpuResourceRegionOverview', 'getRegionOverview start')

    const { gpuNames, regions, regionLabels } = await loadQueryParams()

    if (gpuNames.length === 0) {
      supplierLog('gpuResourceRegionOverview', 'empty gpu names')
      return {
        rows: [],
        meta: { regionCount: regions.length, gpuNameCount: 0 },
      }
    }

    try {
      const sourceParams = regions.length > 0 ? { regions: regions.join(',') } : {}
      const [usageData, sourceData] = await Promise.all([
        getGpuUsageAPI({ gpu_names: gpuNames.join(',') }) as Promise<ApiGpuUsageRow[]>,
        getSourceStatisticsByRegionAndGpuAPI(sourceParams) as Promise<ApiSourceStatsRow[]>,
      ])

      const rows = buildRegionOverviewRows(usageData ?? [], sourceData ?? [], regionLabels)

      supplierLog('gpuResourceRegionOverview', 'getRegionOverview done', {
        regionCount: rows.length,
        gpuNameCount: gpuNames.length,
      })

      return {
        rows,
        meta: {
          regionCount: rows.length,
          gpuNameCount: gpuNames.length,
        },
      }
    } catch (e) {
      supplierError('gpuResourceRegionOverview', 'getRegionOverview failed', e)
      throw e
    }
  },

  async getTrend(range: GpuResourceTrendRange): Promise<GpuResourceTrendResult> {
    supplierLog('gpuResourceTrend', 'getTrend start', { range })

    const { gpuNames, regions, regionLabels } = await loadQueryParams()
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - RANGE_MS[range])

    if (gpuNames.length === 0 || regions.length === 0) {
      supplierLog('gpuResourceTrend', 'empty query params', {
        gpuNames: gpuNames.length,
        regions: regions.length,
      })
      return {
        points: [],
        meta: {
          range,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          regionCount: regions.length,
          gpuNameCount: gpuNames.length,
        },
      }
    }

    try {
      const data = (await getResourceStatisticsListAPI({
        gpu_names: gpuNames.join(','),
        regions: regions.join(','),
        start_time: startTime.toISOString(),
        end_time: '',
      })) as ApiListResponse

      const points = buildTrendPoints(data.results ?? [], regionLabels)

      supplierLog('gpuResourceTrend', 'getTrend done', {
        range,
        rawCount: data.count ?? data.results?.length ?? 0,
        pointCount: points.length,
      })

      return {
        points,
        meta: {
          range,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          regionCount: regions.length,
          gpuNameCount: gpuNames.length,
        },
      }
    } catch (e) {
      supplierError('gpuResourceTrend', 'getTrend failed', e, { range })
      throw e
    }
  },
}
