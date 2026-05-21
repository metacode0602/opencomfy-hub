import {
  assertPlatformDatacenterIdCount,
} from '@/lib/supplier/platform-datacenter-import-utils'
import {
  fetchIdcInfosByIds,
  mapIdcInfoToImportRow,
  SuanliSupplyOpenApiError,
} from '@/lib/server/integrations/suanli-supply-api'
import { supplierError, supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import {
  buildDatacenterImportPreviewFromParsedRows,
  commitDatacenterImportPreview,
  toPublicDatacenterImportPreview,
} from '@/lib/server/dataaccess/supplier/datacenter-import'
import type { PlatformDatacenterImportPreviewResult } from '@/lib/types/platform-datacenter-import'
import type { DatacenterImportCommitResult, DatacenterImportParsedRow } from '@/lib/types/datacenter-import'

async function buildPlatformDatacenterPreview(externalOnboardingIds: string[]) {
  const ids = externalOnboardingIds
  assertPlatformDatacenterIdCount(ids)

  const traceId = crypto.randomUUID().slice(0, 8)
  supplierLog('platform-datacenter-import', 'preview start', {
    traceId,
    count: ids.length,
  })

  let platformMap: Awaited<ReturnType<typeof fetchIdcInfosByIds>>
  try {
    platformMap = await fetchIdcInfosByIds(ids, traceId)
  } catch (e) {
    supplierError('platform-datacenter-import', 'preview api failed', e, { traceId })
    if (e instanceof SuanliSupplyOpenApiError) throw e
    throw new Error(e instanceof Error ? e.message : '拉取平台机房失败')
  }

  const missingPlatformIds: string[] = []
  const parsedRows: DatacenterImportParsedRow[] = []
  let rowNo = 1

  for (const id of ids) {
    const record = platformMap.get(id)
    if (!record) {
      missingPlatformIds.push(id)
      continue
    }
    parsedRows.push(mapIdcInfoToImportRow(record, rowNo++))
  }

  if (parsedRows.length === 0 && missingPlatformIds.length === ids.length) {
    supplierWarn('platform-datacenter-import', 'preview no platform data', {
      traceId,
      missingPlatformIds,
    })
  }

  const preview = await buildDatacenterImportPreviewFromParsedRows({
    parsedRows,
    fileName: 'platform-api',
  })

  supplierLog('platform-datacenter-import', 'preview done', {
    traceId,
    platformReturned: parsedRows.length,
    missing: missingPlatformIds.length,
    create: preview.summary.create,
    skip: preview.summary.skip,
    error: preview.summary.error,
  })

  return { preview, missingPlatformIds, traceId }
}

export const platformDatacenterImportDataAccess = {
  async preview(params: {
    externalOnboardingIds: string[]
  }): Promise<PlatformDatacenterImportPreviewResult> {
    const { preview, missingPlatformIds } = await buildPlatformDatacenterPreview(
      params.externalOnboardingIds,
    )
    return {
      ...toPublicDatacenterImportPreview(preview),
      missingPlatformIds,
      source: 'platform-api',
    }
  },

  async commit(params: {
    externalOnboardingIds: string[]
  }): Promise<DatacenterImportCommitResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    supplierLog('platform-datacenter-import', 'commit start', {
      traceId,
      count: params.externalOnboardingIds.length,
    })

    const { preview } = await buildPlatformDatacenterPreview(params.externalOnboardingIds)

    if (preview.summary.create === 0) {
      throw new Error('没有可导入的机房，请检查平台 ID 或先导入对应供应商')
    }

    return commitDatacenterImportPreview(preview, {}, 'platform-datacenter-import')
  },
}
