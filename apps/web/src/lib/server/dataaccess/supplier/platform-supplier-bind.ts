import { db } from '@/lib/db'
import type { Supplier } from '@/lib/data/types'
import {
  fetchAllSupplierApplications,
  mapSupplierApplicationToImportRow,
  SuanliSupplyOpenApiError,
  type SupplierApplicationApiRecord,
} from '@/lib/server/integrations/suanli-supply-api'
import { supplierError, supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import { rowToDbFields } from '@/lib/server/dataaccess/supplier/supplier-import'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import {
  normalizePlatformTenantId,
  resolveExternalTenantId,
} from '@/lib/supplier/supplier-import-utils'
import type {
  PlatformSupplierBindCandidate,
  PlatformSupplierBindCommitResult,
  PlatformSupplierBindSearchResult,
} from '@/lib/types/platform-supplier-bind'
import { supplier } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

function maskIdentity(no: string | undefined): string | undefined {
  if (!no) return undefined
  if (no.length <= 8) return no
  return `${no.slice(0, 4)}****${no.slice(-4)}`
}

function isManualExternalTenantId(value: string | undefined): boolean {
  return !value || value.startsWith('crm-manual-')
}

async function searchPlatformRecords(query: string): Promise<SupplierApplicationApiRecord[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error('请输入平台租户 ID 或名称')
  }

  if (/^\d+$/.test(trimmed)) {
    return fetchAllSupplierApplications({ application_ids: trimmed })
  }

  const [enterprise, personal] = await Promise.all([
    fetchAllSupplierApplications({ types: 'Enterprise', name: trimmed }),
    fetchAllSupplierApplications({ types: 'Personal', name: trimmed }),
  ])

  const seen = new Set<number>()
  const merged: SupplierApplicationApiRecord[] = []
  for (const record of [...enterprise, ...personal]) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    merged.push(record)
  }
  return merged
}

function evaluateBindCandidate(
  record: SupplierApplicationApiRecord,
  targetSupplier: Supplier,
  existingSuppliers: Supplier[],
): PlatformSupplierBindCandidate {
  const row = mapSupplierApplicationToImportRow(record, 1)
  const tenantId = normalizePlatformTenantId(row.platform_tenant_id)
  const externalTenantId = resolveExternalTenantId(row)

  const base = {
    applicationId: String(record.id),
    platformTenantId: tenantId,
    name: row.name ?? '—',
    onboardingType: row.onboarding_type,
    identityNo: maskIdentity(row.identity_no),
  }

  if (!row.name?.trim()) {
    return { ...base, bindable: false, bindMessage: '平台记录缺少名称' }
  }

  if (!tenantId || !externalTenantId) {
    return { ...base, bindable: false, bindMessage: '平台记录缺少租户 ID' }
  }

  const conflictExternal = existingSuppliers.find(
    (s) => s.externalTenantId === externalTenantId && s.id !== targetSupplier.id,
  )
  if (conflictExternal) {
    return {
      ...base,
      bindable: false,
      bindMessage: `租户 ID 已被供应商「${conflictExternal.name}」占用`,
    }
  }

  const conflictPlatform = existingSuppliers.find(
    (s) => s.platformTenantId === tenantId && s.id !== targetSupplier.id,
  )
  if (conflictPlatform) {
    return {
      ...base,
      bindable: false,
      bindMessage: `平台租户 ID 已被供应商「${conflictPlatform.name}」占用`,
    }
  }

  if (
    targetSupplier.externalTenantId === externalTenantId &&
    targetSupplier.platformTenantId === tenantId
  ) {
    return { ...base, bindable: false, bindMessage: '当前供应商已绑定此平台租户' }
  }

  return { ...base, bindable: true }
}

export const platformSupplierBindDataAccess = {
  async search(params: {
    supplierId: string
    query: string
  }): Promise<PlatformSupplierBindSearchResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    supplierLog('platform-supplier-bind', 'search start', {
      traceId,
      supplierId: params.supplierId,
      query: params.query,
    })

    const targetSupplier = await suppliersDataAccess.getById(params.supplierId)
    if (!targetSupplier) {
      throw new Error('供应商不存在')
    }

    let records: SupplierApplicationApiRecord[]
    try {
      records = await searchPlatformRecords(params.query)
    } catch (e) {
      supplierError('platform-supplier-bind', 'search api failed', e, { traceId })
      if (e instanceof SuanliSupplyOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台供应商失败')
    }

    const existingSuppliers = await suppliersDataAccess.list()
    const candidates = records
      .filter((record) => record.name?.trim())
      .map((record) => evaluateBindCandidate(record, targetSupplier, existingSuppliers))

    supplierLog('platform-supplier-bind', 'search done', {
      traceId,
      returned: candidates.length,
      bindable: candidates.filter((c) => c.bindable).length,
    })

    return {
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      currentExternalTenantId: isManualExternalTenantId(targetSupplier.externalTenantId)
        ? undefined
        : targetSupplier.externalTenantId,
      currentPlatformTenantId: targetSupplier.platformTenantId,
      candidates,
    }
  },

  async bind(params: {
    supplierId: string
    applicationId: string
  }): Promise<PlatformSupplierBindCommitResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    supplierLog('platform-supplier-bind', 'bind start', {
      traceId,
      supplierId: params.supplierId,
      applicationId: params.applicationId,
    })

    const targetSupplier = await suppliersDataAccess.getById(params.supplierId)
    if (!targetSupplier) {
      throw new Error('供应商不存在')
    }

    let records: SupplierApplicationApiRecord[]
    try {
      records = await fetchAllSupplierApplications({
        application_ids: params.applicationId,
      })
    } catch (e) {
      supplierError('platform-supplier-bind', 'bind api failed', e, { traceId })
      if (e instanceof SuanliSupplyOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台供应商失败')
    }

    const record = records.find((r) => String(r.id) === params.applicationId)
    if (!record) {
      throw new Error('未找到对应的平台供应商记录')
    }

    const existingSuppliers = await suppliersDataAccess.list()
    const candidate = evaluateBindCandidate(record, targetSupplier, existingSuppliers)
    if (!candidate.bindable) {
      throw new Error(candidate.bindMessage ?? '无法绑定此平台供应商')
    }

    const row = mapSupplierApplicationToImportRow(record, 1)
    const fields = rowToDbFields(row)

    await db
      .update(supplier)
      .set({
        name: fields.name,
        contactPerson: fields.contactPerson,
        contactPhone: fields.contactPhone,
        contactEmail: fields.contactEmail,
        address: fields.address,
        bankName: fields.bankName,
        bankAccount: fields.bankAccount,
        defaultCooperationMode: fields.defaultCooperationMode,
        status: fields.status,
        externalOnboardingId: fields.externalOnboardingId,
        externalTenantId: fields.externalTenantId,
        platformTenantId: fields.platformTenantId,
        onboardingType: fields.onboardingType,
        identityNo: fields.identityNo,
        businessScope: fields.businessScope,
        businessLicenseUri: fields.businessLicenseUri,
        idCardFrontUri: fields.idCardFrontUri,
        idCardBackUri: fields.idCardBackUri,
        bankBranchName: fields.bankBranchName,
        bankBranchAddress: fields.bankBranchAddress,
        adminPhone: fields.adminPhone,
        adminEmail: fields.adminEmail,
        deviceInfoRaw: fields.deviceInfoRaw,
        auditStatus: fields.auditStatus,
        auditConfirmed: fields.auditConfirmed,
        auditRemark: fields.auditRemark,
        updatedAt: fields.updatedAt,
        source: 'import',
      })
      .where(eq(supplier.id, params.supplierId))

    supplierLog('platform-supplier-bind', 'bind done', {
      traceId,
      supplierId: params.supplierId,
      externalTenantId: fields.externalTenantId,
    })

    return {
      supplierId: params.supplierId,
      supplierName: targetSupplier.name,
      externalTenantId: fields.externalTenantId,
      platformTenantId: fields.platformTenantId ?? undefined,
    }
  },
}
