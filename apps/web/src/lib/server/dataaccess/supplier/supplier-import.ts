import { db } from '@/lib/db'
import type { Supplier } from '@/lib/data/types'
import { parseSupplierImportFile } from '@/lib/supplier/parse-supplier-import-xlsx'
import {
  buildSupplierImportPreview,
  deriveShortName,
  deriveSupplierCode,
  normalizePlatformTenantId,
} from '@/lib/supplier/supplier-import-utils'
import type {
  SupplierImportCommitResult,
  SupplierImportParsedRow,
  SupplierImportPreviewResult,
} from '@/lib/types/supplier-import'
import {
  isSupplierImportFileName,
  SUPPLIER_IMPORT_MAX_BYTES,
} from '@/lib/types/supplier-import'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { mapSupplierRow } from '@/lib/server/mappers/supply'
import { supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess, newSupplierId } from '@/lib/server/dataaccess/supplier/suppliers'
import { billingTenant, supplier } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function parseSourceDate(value?: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function assertImportFile(fileName: string, buffer: Buffer) {
  if (!isSupplierImportFileName(fileName)) {
    throw new Error('仅支持 .xlsx / .xls / .csv / .tsv 文件')
  }
  if (buffer.length > SUPPLIER_IMPORT_MAX_BYTES) {
    throw new Error('文件不能超过 10MB')
  }
}

async function loadSuppliersForImport(): Promise<Supplier[]> {
  return suppliersDataAccess.list()
}

async function loadBillingTenantPlatformIds(): Promise<Set<string>> {
  const rows = await db
    .select({ platformTenantId: billingTenant.platformTenantId })
    .from(billingTenant)
  const set = new Set<string>()
  for (const row of rows) {
    if (row.platformTenantId) set.add(row.platformTenantId)
  }
  return set
}

function enrichTenantWarnings(
  preview: SupplierImportPreviewResult,
  knownTenantIds: Set<string>,
): SupplierImportPreviewResult {
  const rows = preview.rows.map((row) => {
    const parsed = preview.parsedRows.find((p) => p.row_no === row.row_no)
    const tenantId = normalizePlatformTenantId(parsed?.platform_tenant_id)
    if (!tenantId || row.parse_status === 'error') return row
    if (knownTenantIds.has(tenantId)) return row
    const warnings = [...row.warnings, '租户 ID 未入 CRM 计费租户库']
    return {
      ...row,
      warnings,
      parse_status: 'warning' as const,
      parse_message: warnings.join('；'),
    }
  })

  const warn = rows.filter((r) => r.parse_status === 'warning').length
  const ok = rows.filter((r) => r.parse_status === 'ok').length

  return {
    ...preview,
    rows,
    summary: { ...preview.summary, ok, warn },
  }
}

function toPublicPreview(preview: SupplierImportPreviewResult): Omit<SupplierImportPreviewResult, 'parsedRows'> {
  const { parsedRows: _parsedRows, ...rest } = preview
  return rest
}

function rowToDbFields(row: SupplierImportParsedRow) {
  return {
    name: row.name!,
    contactPerson: row.contact_person?.trim() || null,
    contactPhone: row.contact_phone?.trim() || null,
    contactEmail: row.admin_email?.trim() || null,
    address: row.address?.trim() || null,
    bankName: row.bank_name ?? null,
    bankAccount: row.bank_account ?? null,
    defaultCooperationMode: row.cooperation_mode ?? 'card_time',
    status: row.status ?? 'negotiating',
    externalOnboardingId: row.external_onboarding_id ?? null,
    platformTenantId: normalizePlatformTenantId(row.platform_tenant_id) ?? null,
    onboardingType: row.onboarding_type ?? null,
    identityNo: row.identity_no ?? null,
    businessScope: row.business_scope ?? null,
    businessLicenseUri: row.business_license_uri ?? null,
    idCardFrontUri: row.id_card_front_uri ?? null,
    idCardBackUri: row.id_card_back_uri ?? null,
    bankBranchName: row.bank_branch_name ?? null,
    bankBranchAddress: row.bank_branch_address ?? null,
    adminPhone: row.admin_phone ?? null,
    adminEmail: row.admin_email ?? null,
    deviceInfoRaw: row.device_info_raw ?? null,
    auditStatus: row.audit_status ?? null,
    auditConfirmed: row.audit_confirmed ?? false,
    auditRemark: row.audit_remark ?? null,
    updatedAt: parseSourceDate(row.source_updated_at) ?? new Date(),
  }
}

export const supplierImportDataAccess = {
  async preview(params: {
    fileName: string
    fileBase64: string
    defaultBusinessManagerStaffId: string
  }): Promise<Omit<SupplierImportPreviewResult, 'parsedRows'>> {
    const buffer = Buffer.from(params.fileBase64, 'base64')
    assertImportFile(params.fileName, buffer)

    const staff = await staffDataAccess.getById(params.defaultBusinessManagerStaffId)
    if (!staff || staff.status !== 'active') {
      throw new Error('默认商务经理无效或已停用')
    }

    const activeStaff = await staffDataAccess.listActive()
    const existingSuppliers = await loadSuppliersForImport()

    supplierLog('supplier-import', 'preview start', {
      fileName: params.fileName,
      bytes: buffer.length,
      existingCount: existingSuppliers.length,
    })

    const parsed = parseSupplierImportFile(bufferToArrayBuffer(buffer), params.fileName)
    let preview = buildSupplierImportPreview(
      parsed.rows,
      params.fileName,
      parsed.originalHeaders,
      parsed.columnCanonicalByIndex,
      existingSuppliers,
      params.defaultBusinessManagerStaffId,
      activeStaff,
    )

    const knownTenants = await loadBillingTenantPlatformIds()
    preview = enrichTenantWarnings(preview, knownTenants)

    supplierLog('supplier-import', 'preview done', {
      total: preview.summary.total,
      create: preview.summary.create,
      update: preview.summary.update,
      error: preview.summary.error,
    })

    return toPublicPreview(preview)
  },

  async commit(params: {
    fileName: string
    fileBase64: string
    defaultBusinessManagerStaffId: string
  }): Promise<SupplierImportCommitResult> {
    const buffer = Buffer.from(params.fileBase64, 'base64')
    assertImportFile(params.fileName, buffer)

    const staff = await staffDataAccess.getById(params.defaultBusinessManagerStaffId)
    if (!staff || staff.status !== 'active') {
      throw new Error('默认商务经理无效或已停用')
    }

    const activeStaff = await staffDataAccess.listActive()
    const existingSuppliers = await loadSuppliersForImport()

    supplierLog('supplier-import', 'commit start', {
      fileName: params.fileName,
      bytes: buffer.length,
    })

    const parsed = parseSupplierImportFile(bufferToArrayBuffer(buffer), params.fileName)
    let preview = buildSupplierImportPreview(
      parsed.rows,
      params.fileName,
      parsed.originalHeaders,
      parsed.columnCanonicalByIndex,
      existingSuppliers,
      params.defaultBusinessManagerStaffId,
      activeStaff,
    )

    const knownTenants = await loadBillingTenantPlatformIds()
    preview = enrichTenantWarnings(preview, knownTenants)

    const codeSet = new Set(
      (await db.select({ code: supplier.code }).from(supplier)).map((r) => r.code),
    )

    let created = 0
    let updated = 0
    let failed = 0
    let skipped = 0
    const errors: SupplierImportCommitResult['errors'] = []

    for (const previewRow of preview.rows) {
      if (!previewRow.selectable) {
        skipped++
        if (previewRow.errors.length > 0) {
          errors.push({
            row_no: previewRow.row_no,
            message: previewRow.errors.join('；'),
          })
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
        const fields = rowToDbFields(row)

        if (previewRow.action === 'create') {
          const code = deriveSupplierCode(row, codeSet)
          codeSet.add(code)
          const id = newSupplierId()
          const createdAt = parseSourceDate(row.source_created_at) ?? new Date()

          await db.insert(supplier).values({
            id,
            code,
            shortName: deriveShortName(row.name!),
            businessManagerStaffId: params.defaultBusinessManagerStaffId,
            createdAt,
            ...fields,
          })
          created++
          continue
        }

        if (previewRow.action === 'update' && previewRow.matched_supplier_id) {
          await db
            .update(supplier)
            .set(fields)
            .where(eq(supplier.id, previewRow.matched_supplier_id))
          updated++
        }
      } catch (e) {
        failed++
        const message = e instanceof Error ? e.message : '导入失败'
        supplierWarn('supplier-import', 'commit row failed', {
          row_no: previewRow.row_no,
          message,
        })
        errors.push({ row_no: previewRow.row_no, message })
      }
    }

    supplierLog('supplier-import', 'commit done', {
      created,
      updated,
      failed,
      skipped,
      errors: errors.length,
    })

    return { created, updated, failed, skipped, errors }
  },
}
