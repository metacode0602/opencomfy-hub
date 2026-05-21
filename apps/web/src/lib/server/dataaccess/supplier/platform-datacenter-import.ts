import {
  assertPlatformTenantIdCount,
} from '@/lib/supplier/platform-datacenter-import-utils'
import {
  fetchAllIdcInfos,
  mapIdcInfosToImportRows,
  SuanliSupplyOpenApiError,
} from '@/lib/server/integrations/suanli-supply-api'
import { supplierError, supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import {
  buildDatacenterImportPreviewFromParsedRows,
  commitDatacenterImportPreview,
  toPublicDatacenterImportPreview,
} from '@/lib/server/dataaccess/supplier/datacenter-import'
import type { PlatformDatacenterImportPreviewResult } from '@/lib/types/platform-datacenter-import'
import type { DatacenterImportCommitResult } from '@/lib/types/datacenter-import'

type PlatformDatacenterSearchParams = {
  tenantIds: string[]
  name: string
}

async function buildPlatformDatacenterPreview(params: PlatformDatacenterSearchParams) {
  const tenantIds = params.tenantIds
  assertPlatformTenantIdCount(tenantIds)

  const traceId = crypto.randomUUID().slice(0, 8)
  supplierLog('platform-datacenter-import', 'preview start', {
    traceId,
    tenantCount: tenantIds.length,
    name: params.name,
  })

  let records: Awaited<ReturnType<typeof fetchAllIdcInfos>>
  try {
    records = await fetchAllIdcInfos({
      tenant_tids: tenantIds.length > 0 ? tenantIds.join(',') : '',
      name: params.name.trim(),
      status: 'Pass',
    })
  } catch (e) {
    supplierError('platform-datacenter-import', 'preview api failed', e, { traceId })
    if (e instanceof SuanliSupplyOpenApiError) throw e
    throw new Error(e instanceof Error ? e.message : '拉取平台机房失败')
  }

  const parsedRows = mapIdcInfosToImportRows(records)

  if (parsedRows.length === 0) {
    supplierWarn('platform-datacenter-import', 'preview no platform data', {
      traceId,
      tenantIds,
      name: params.name,
    })
  }

  const preview = await buildDatacenterImportPreviewFromParsedRows({
    parsedRows,
    fileName: 'platform-api',
  })

  supplierLog('platform-datacenter-import', 'preview done', {
    traceId,
    platformReturned: parsedRows.length,
    create: preview.summary.create,
    skip: preview.summary.skip,
    error: preview.summary.error,
  })

  return { preview, traceId }
}

export const platformDatacenterImportDataAccess = {
  async preview(params: PlatformDatacenterSearchParams): Promise<PlatformDatacenterImportPreviewResult> {
    const { preview } = await buildPlatformDatacenterPreview(params)
    return {
      ...toPublicDatacenterImportPreview(preview),
      source: 'platform-api',
      searchParams: {
        tenantIds: params.tenantIds,
        name: params.name,
      },
    }
  },

  async commit(params: PlatformDatacenterSearchParams): Promise<DatacenterImportCommitResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    supplierLog('platform-datacenter-import', 'commit start', {
      traceId,
      tenantCount: params.tenantIds.length,
      name: params.name,
    })

    const { preview } = await buildPlatformDatacenterPreview(params)

    if (preview.summary.create === 0) {
      throw new Error('没有可导入的机房，请调整筛选条件或先导入对应供应商')
    }

    return commitDatacenterImportPreview(preview, {}, 'platform-datacenter-import')
  },
}
