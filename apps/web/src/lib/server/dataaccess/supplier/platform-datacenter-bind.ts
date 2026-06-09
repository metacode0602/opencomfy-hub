import { db } from '@/lib/db'
import type { DataCenter, Supplier } from '@/lib/data/types'
import {
  fetchAllIdcInfos,
  mapIdcInfoToDbFields,
  mapIdcInfoToImportRow,
  SuanliSupplyOpenApiError,
  type IdcInfoApiRecord,
} from '@/lib/server/integrations/suanli-supply-api'
import { supplierError, supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { normalizePlatformTenantId } from '@/lib/supplier/supplier-import-utils'
import type {
  PlatformDatacenterBindCandidate,
  PlatformDatacenterBindCommitResult,
  PlatformDatacenterBindSearchResult,
} from '@/lib/types/platform-datacenter-bind'
import { dataCenter } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

function getSupplierPlatformTenantId(supplier: Supplier): string | undefined {
  if (supplier.platformTenantId) return supplier.platformTenantId
  if (supplier.externalTenantId && !supplier.externalTenantId.startsWith('crm-manual-')) {
    return supplier.externalTenantId
  }
  return undefined
}

function mergeIdcRecords(records: IdcInfoApiRecord[]): IdcInfoApiRecord[] {
  const seen = new Set<number>()
  const merged: IdcInfoApiRecord[] = []
  for (const record of records) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    merged.push(record)
  }
  return merged
}

async function searchPlatformIdcs(query: string): Promise<IdcInfoApiRecord[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error('请输入平台租户 ID、机房 ID 或名称')
  }

  if (/^\d+$/.test(trimmed)) {
    const [byIdc, byTenant] = await Promise.all([
      fetchAllIdcInfos({ idc_ids: trimmed, status: 'Pass' }),
      fetchAllIdcInfos({ tenant_tids: trimmed, status: 'Pass' }),
    ])
    return mergeIdcRecords([...byIdc, ...byTenant])
  }

  return fetchAllIdcInfos({ name: trimmed, status: 'Pass' })
}

function evaluateBindCandidate(
  record: IdcInfoApiRecord,
  targetDataCenter: DataCenter,
  supplier: Supplier,
  allDataCenters: DataCenter[],
): PlatformDatacenterBindCandidate {
  const row = mapIdcInfoToImportRow(record, 1)
  const platformTenantId = normalizePlatformTenantId(row.platform_tenant_id)
  const idcId = row.external_onboarding_id

  const base = {
    idcId: idcId ?? '—',
    platformTenantId,
    name: row.name ?? '—',
    containerInstanceRegion: row.container_instance_region,
  }

  if (!row.name?.trim()) {
    return { ...base, bindable: false, bindMessage: '平台记录缺少名称' }
  }

  if (!idcId) {
    return { ...base, bindable: false, bindMessage: '平台记录缺少机房 ID' }
  }

  if (row.source_deleted) {
    return { ...base, bindable: false, bindMessage: '平台源已删除' }
  }

  const conflict = allDataCenters.find(
    (dc) => dc.externalOnboardingId === idcId && dc.id !== targetDataCenter.id,
  )
  if (conflict) {
    return {
      ...base,
      bindable: false,
      bindMessage: `平台机房 ID 已被「${conflict.name}」占用`,
    }
  }

  if (targetDataCenter.externalOnboardingId === idcId) {
    return { ...base, bindable: false, bindMessage: '当前机房已绑定此平台记录' }
  }

  const supplierPlatformTenantId = getSupplierPlatformTenantId(supplier)
  if (!supplierPlatformTenantId) {
    return {
      ...base,
      bindable: false,
      bindMessage: '所属供应商尚未绑定平台，请先绑定供应商',
    }
  }

  if (platformTenantId && platformTenantId !== supplierPlatformTenantId) {
    return {
      ...base,
      bindable: false,
      bindMessage: '平台租户与所属供应商不一致',
    }
  }

  return { ...base, bindable: true }
}

async function loadTargetDataCenter(dataCenterId: string): Promise<{
  dataCenter: DataCenter
  supplier: Supplier
}> {
  const detail = await suppliersDataAccess.getDataCenterDetail(dataCenterId)
  if (!detail) {
    throw new Error('机房不存在')
  }

  const supplierRow = await suppliersDataAccess.getById(detail.dataCenter.supplierId)
  if (!supplierRow) {
    throw new Error('所属供应商不存在')
  }

  return { dataCenter: detail.dataCenter, supplier: supplierRow }
}

export const platformDatacenterBindDataAccess = {
  async search(params: {
    dataCenterId: string
    query: string
  }): Promise<PlatformDatacenterBindSearchResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    supplierLog('platform-datacenter-bind', 'search start', {
      traceId,
      dataCenterId: params.dataCenterId,
      query: params.query,
    })

    const { dataCenter: targetDataCenter, supplier } = await loadTargetDataCenter(
      params.dataCenterId,
    )

    let records: IdcInfoApiRecord[]
    try {
      records = await searchPlatformIdcs(params.query)
    } catch (e) {
      supplierError('platform-datacenter-bind', 'search api failed', e, { traceId })
      if (e instanceof SuanliSupplyOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台机房失败')
    }

    const allDataCenters = await suppliersDataAccess.listAllDataCenters()
    const candidates = records
      .filter((record) => record.name?.trim())
      .map((record) =>
        evaluateBindCandidate(record, targetDataCenter, supplier, allDataCenters),
      )

    supplierLog('platform-datacenter-bind', 'search done', {
      traceId,
      returned: candidates.length,
      bindable: candidates.filter((c) => c.bindable).length,
    })

    return {
      dataCenterId: targetDataCenter.id,
      dataCenterName: targetDataCenter.name,
      supplierName: targetDataCenter.supplierName,
      currentExternalOnboardingId: targetDataCenter.externalOnboardingId,
      currentPlatformTenantId: targetDataCenter.platformTenantId,
      candidates,
    }
  },

  async bind(params: {
    dataCenterId: string
    idcId: string
  }): Promise<PlatformDatacenterBindCommitResult> {
    const traceId = crypto.randomUUID().slice(0, 8)
    supplierLog('platform-datacenter-bind', 'bind start', {
      traceId,
      dataCenterId: params.dataCenterId,
      idcId: params.idcId,
    })

    const { dataCenter: targetDataCenter, supplier } = await loadTargetDataCenter(
      params.dataCenterId,
    )

    let records: IdcInfoApiRecord[]
    try {
      records = await fetchAllIdcInfos({ idc_ids: params.idcId, status: 'Pass' })
    } catch (e) {
      supplierError('platform-datacenter-bind', 'bind api failed', e, { traceId })
      if (e instanceof SuanliSupplyOpenApiError) throw e
      throw new Error(e instanceof Error ? e.message : '拉取平台机房失败')
    }

    const record = records.find((r) => String(r.id) === params.idcId)
    if (!record) {
      throw new Error('未找到对应的平台机房记录')
    }

    const allDataCenters = await suppliersDataAccess.listAllDataCenters()
    const candidate = evaluateBindCandidate(record, targetDataCenter, supplier, allDataCenters)
    if (!candidate.bindable) {
      throw new Error(candidate.bindMessage ?? '无法绑定此平台机房')
    }

    const fields = mapIdcInfoToDbFields(record)

    await db
      .update(dataCenter)
      .set({
        name: fields.name,
        location: fields.location,
        address: fields.address,
        regionTags: fields.regionTags,
        status: fields.status,
        externalOnboardingId: fields.externalOnboardingId,
        platformTenantId: fields.platformTenantId,
        containerInstanceRegion: fields.containerInstanceRegion,
        bareMetalRegion: fields.bareMetalRegion,
        description: fields.description,
        scale: fields.scale,
        publicIpCount: fields.publicIpCount,
        internalNetworkCidr: fields.internalNetworkCidr,
        auditStatus: fields.auditStatus,
        auditRemark: fields.auditRemark,
        sourceDeleted: fields.sourceDeleted,
        updatedAt: fields.updatedAt,
      })
      .where(eq(dataCenter.id, params.dataCenterId))

    supplierLog('platform-datacenter-bind', 'bind done', {
      traceId,
      dataCenterId: params.dataCenterId,
      externalOnboardingId: fields.externalOnboardingId,
    })

    return {
      dataCenterId: params.dataCenterId,
      dataCenterName: targetDataCenter.name,
      externalOnboardingId: fields.externalOnboardingId!,
      platformTenantId: fields.platformTenantId ?? undefined,
    }
  },
}
