import {
  fetchAllSupplierApplications,
  mapSupplierApplicationsToImportRows,
  SuanliSupplyOpenApiError,
} from '@/lib/server/integrations/suanli-supply-api'
import { supplierError, supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import {
  buildSupplierImportPreviewFromParsedRows,
  commitSupplierImportPreview,
  toPublicSupplierImportPreview,
} from '@/lib/server/dataaccess/supplier/supplier-import'
import type { PlatformSupplierType } from '@/lib/supplier/platform-supplier-import-utils'
import type { PlatformSupplierImportPreviewResult } from '@/lib/types/platform-supplier-import'
import type { SupplierImportCommitResult } from '@/lib/types/supplier-import'

type PlatformSupplierSearchParams = {
  types: PlatformSupplierType
  name: string
  defaultBusinessManagerStaffId: string
}

async function buildPlatformSupplierPreview(params: PlatformSupplierSearchParams) {
  const traceId = crypto.randomUUID().slice(0, 8)
  supplierLog('platform-supplier-import', 'preview start', {
    traceId,
    types: params.types,
    name: params.name,
  })

  let records: Awaited<ReturnType<typeof fetchAllSupplierApplications>>
  try {
    records = await fetchAllSupplierApplications({
      types: params.types,
      name: params.name,
    })
  } catch (e) {
    supplierError('platform-supplier-import', 'preview api failed', e, { traceId })
    if (e instanceof SuanliSupplyOpenApiError) throw e
    throw new Error(e instanceof Error ? e.message : '拉取平台供应商失败')
  }

  const parsedRows = mapSupplierApplicationsToImportRows(records)

  if (parsedRows.length === 0) {
    supplierWarn('platform-supplier-import', 'preview no platform data', {
      traceId,
      types: params.types,
      name: params.name,
    })
  }

  const preview = await buildSupplierImportPreviewFromParsedRows({
    parsedRows,
    defaultBusinessManagerStaffId: params.defaultBusinessManagerStaffId,
    fileName: 'platform-api',
  })

  supplierLog('platform-supplier-import', 'preview done', {
    traceId,
    platformReturned: parsedRows.length,
    create: preview.summary.create,
    update: preview.summary.update,
    error: preview.summary.error,
  })

  return { preview, traceId }
}

export const platformSupplierImportDataAccess = {
  async preview(params: PlatformSupplierSearchParams): Promise<PlatformSupplierImportPreviewResult> {
    const { preview } = await buildPlatformSupplierPreview(params)
    return {
      ...toPublicSupplierImportPreview(preview),
      source: 'platform-api',
      searchParams: {
        types: params.types,
        name: params.name,
      },
    }
  },

  async commit(params: PlatformSupplierSearchParams): Promise<SupplierImportCommitResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    supplierLog('platform-supplier-import', 'commit start', {
      traceId,
      types: params.types,
      name: params.name,
    })

    const { preview } = await buildPlatformSupplierPreview(params)

    if (preview.rows.filter((r) => r.selectable).length === 0) {
      throw new Error('没有可导入的供应商，请调整筛选条件或预览结果')
    }

    return commitSupplierImportPreview(
      preview,
      params.defaultBusinessManagerStaffId,
      'platform-supplier-import',
    )
  },
}
