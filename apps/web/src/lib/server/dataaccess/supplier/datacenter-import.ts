import { db } from '@/lib/db'
import { parseDatacenterImportFile } from '@/lib/supplier/parse-datacenter-import-xlsx'
import {
  buildDatacenterImportPreview,
  buildRegionTags,
  deriveDatacenterCode,
  deriveLocation,
} from '@/lib/supplier/datacenter-import-utils'
import type {
  DatacenterImportCommitResult,
  DatacenterImportPreviewResult,
} from '@/lib/types/datacenter-import'
import {
  isDatacenterImportFileName,
  DATACENTER_IMPORT_MAX_BYTES,
} from '@/lib/types/datacenter-import'
import { supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess, newSupplierId } from '@/lib/server/dataaccess/supplier/suppliers'
import { dataCenter } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function assertImportFile(fileName: string, buffer: Buffer) {
  if (!isDatacenterImportFileName(fileName)) {
    throw new Error('仅支持 .xlsx / .xls / .csv / .tsv 文件')
  }
  if (buffer.length > DATACENTER_IMPORT_MAX_BYTES) {
    throw new Error('文件不能超过 10MB')
  }
}

function parseSourceDate(value?: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function toPublicPreview(
  preview: DatacenterImportPreviewResult,
): Omit<DatacenterImportPreviewResult, 'parsedRows'> {
  const { parsedRows: _parsedRows, ...rest } = preview
  return rest
}

export const datacenterImportDataAccess = {
  async preview(params: {
    supplierId: string
    fileName: string
    fileBase64: string
  }): Promise<Omit<DatacenterImportPreviewResult, 'parsedRows'>> {
    const buffer = Buffer.from(params.fileBase64, 'base64')
    assertImportFile(params.fileName, buffer)

    await suppliersDataAccess.assertSupplierExists(params.supplierId)

    const supplierRow = await suppliersDataAccess.getById(params.supplierId)
    if (!supplierRow) throw new Error('供应商不存在')

    const existingDataCenters = await suppliersDataAccess.listDataCentersBySupplier(
      params.supplierId,
    )

    supplierLog('datacenter-import', 'preview start', {
      supplierId: params.supplierId,
      fileName: params.fileName,
      bytes: buffer.length,
      existingCount: existingDataCenters.length,
    })

    const parsed = parseDatacenterImportFile(bufferToArrayBuffer(buffer), params.fileName)
    const preview = buildDatacenterImportPreview(
      parsed.rows,
      params.fileName,
      parsed.originalHeaders,
      params.supplierId,
      supplierRow,
      existingDataCenters,
    )

    supplierLog('datacenter-import', 'preview done', {
      total: preview.summary.total,
      create: preview.summary.create,
      skip: preview.summary.skip,
      error: preview.summary.error,
    })

    return toPublicPreview(preview)
  },

  async commit(params: {
    supplierId: string
    fileName: string
    fileBase64: string
  }): Promise<DatacenterImportCommitResult> {
    const buffer = Buffer.from(params.fileBase64, 'base64')
    assertImportFile(params.fileName, buffer)

    await suppliersDataAccess.assertSupplierExists(params.supplierId)

    const supplierRow = await suppliersDataAccess.getById(params.supplierId)
    if (!supplierRow) throw new Error('供应商不存在')

    const existingDataCenters = await suppliersDataAccess.listDataCentersBySupplier(
      params.supplierId,
    )

    supplierLog('datacenter-import', 'commit start', {
      supplierId: params.supplierId,
      fileName: params.fileName,
    })

    const parsed = parseDatacenterImportFile(bufferToArrayBuffer(buffer), params.fileName)
    const preview = buildDatacenterImportPreview(
      parsed.rows,
      params.fileName,
      parsed.originalHeaders,
      params.supplierId,
      supplierRow,
      existingDataCenters,
    )

    const scoped = existingDataCenters.filter((dc) => dc.supplierId === params.supplierId)
    const codeSet = new Set(scoped.map((dc) => dc.code))

    let created = 0
    let skipped = 0
    let failed = 0
    const errors: DatacenterImportCommitResult['errors'] = []
    const created_ids: string[] = []

    for (const previewRow of preview.rows) {
      if (previewRow.action === 'skip') {
        skipped++
        continue
      }

      if (previewRow.parse_status === 'error' || previewRow.action === 'error') {
        failed++
        if (previewRow.parse_message) {
          errors.push({ row_no: previewRow.row_no, message: previewRow.parse_message })
        }
        continue
      }

      const row = preview.parsedRows.find((p) => p.row_no === previewRow.row_no)
      if (!row) {
        failed++
        errors.push({ row_no: previewRow.row_no, message: '解析行缺失' })
        continue
      }

      try {
        const code = previewRow.derived_code ?? deriveDatacenterCode(row, codeSet)
        if (codeSet.has(code)) {
          skipped++
          continue
        }
        codeSet.add(code)

        const id = newSupplierId()
        const createdAt = parseSourceDate(row.source_created_at) ?? new Date()
        const platformTenantId =
          row.platform_tenant_id ?? supplierRow.platformTenantId ?? null

        if (
          row.platform_tenant_id &&
          supplierRow.platformTenantId &&
          row.platform_tenant_id !== supplierRow.platformTenantId
        ) {
          supplierWarn('datacenter-import', 'tenant mismatch on create', {
            supplierId: params.supplierId,
            row_no: row.row_no,
            excelTenant: row.platform_tenant_id,
            supplierTenant: supplierRow.platformTenantId,
          })
        }

        await db.insert(dataCenter).values({
          id,
          supplierId: params.supplierId,
          code,
          name: row.name!,
          location: deriveLocation(row) || null,
          address: null,
          regionTags: buildRegionTags(row),
          status: row.status ?? 'offline',
          networkFeeMonthly: '0',
          mgmtNodeFeeMonthly: '0',
          externalOnboardingId: row.external_onboarding_id ?? null,
          platformTenantId,
          containerInstanceRegion: row.container_instance_region ?? null,
          bareMetalRegion: row.bare_metal_region ?? null,
          description: row.description ?? null,
          scale: row.scale ?? null,
          publicIpCount: row.public_ip_count ?? null,
          internalNetworkCidr: row.internal_network_cidr ?? null,
          auditStatus: row.audit_status ?? null,
          auditRemark: row.audit_remark ?? null,
          sourceDeleted: row.source_deleted ?? false,
          createdAt,
          updatedAt: parseSourceDate(row.source_updated_at) ?? new Date(),
        })

        created_ids.push(id)
        created++
      } catch (e) {
        failed++
        const message = e instanceof Error ? e.message : '导入失败'
        supplierWarn('datacenter-import', 'commit row failed', {
          row_no: previewRow.row_no,
          message,
        })
        errors.push({ row_no: previewRow.row_no, message })
      }
    }

    supplierLog('datacenter-import', 'commit done', {
      created,
      skipped,
      failed,
      errors: errors.length,
    })

    return { created, skipped, failed, errors, created_ids }
  },
}
