import type {
  PlatformDatacenterApiRecord,
  PlatformDatacenterImportCommitResult,
  PlatformDatacenterImportPreviewResult,
  PlatformDatacenterPreviewItem,
} from '@/lib/types/platform-datacenter-import'

import {
  assertPlatformDatacenterIdCount,
  parsePlatformDatacenterIds,
  PLATFORM_DATACENTER_IMPORT_MAX_IDS,
} from '@/lib/supplier/platform-datacenter-import-utils'

export { parsePlatformDatacenterIds, PLATFORM_DATACENTER_IMPORT_MAX_IDS }

/** 平台侧机房快照（Mock OpenAPI results） */
const MOCK_PLATFORM_DATACENTER_RECORDS: Record<string, PlatformDatacenterApiRecord> = {
  '20001': {
    id: 20001,
    tenant_id: 16462,
    zone_name: '华北可用区 A',
    name: '北京亦庄一号机房',
    container_instance_region: 'cn-north-1',
    scale: '128 卡',
    audit_status: 'Pass',
    is_delete: false,
    create_time: '2025-11-15 10:00:00.000000 +08:00',
  },
  '20002': {
    id: 20002,
    tenant_id: 16463,
    zone_name: '华东可用区 B',
    name: '上海临港 GPU 机房',
    container_instance_region: 'cn-east-1',
    scale: '64 卡',
    audit_status: 'Waiting',
    is_delete: false,
    create_time: '2026-05-18 11:30:00.000000 +08:00',
  },
  '20003': {
    id: 20003,
    tenant_id: 16462,
    zone_name: '华北可用区 A',
    name: '北京亦庄二号机房',
    container_instance_region: 'cn-north-1',
    scale: '256 卡',
    audit_status: 'Pass',
    is_delete: true,
    create_time: '2026-01-10 08:00:00.000000 +08:00',
  },
}

/** 模拟 CRM 已入库供应商（platform_tenant_id → 本地） */
const MOCK_SUPPLIER_BY_TENANT_ID: Record<string, { supplierId: string; supplierName: string }> = {
  '16462': {
    supplierId: 'mock-supplier-10001',
    supplierName: '北京深智算力科技有限公司',
  },
  '16463': {
    supplierId: 'mock-supplier-10002',
    supplierName: '上海云算信息技术有限公司',
  },
}

/** 模拟 CRM 已入库机房（external_onboarding_id → 本地） */
const MOCK_LOCAL_BY_ONBOARDING_ID: Record<
  string,
  { dataCenterId: string; dataCenterName: string; supplierName: string }
> = {
  '20001': {
    dataCenterId: 'mock-dc-20001',
    dataCenterName: '北京亦庄一号机房',
    supplierName: '北京深智算力科技有限公司',
  },
}

function mapAuditStatus(raw?: string | null): {
  auditStatus: string
  status: PlatformDatacenterPreviewItem['platform']['status']
} {
  if (!raw) return { auditStatus: 'pending', status: 'offline' }
  const lower = raw.trim().toLowerCase()
  if (['pass', 'approved', '已通过'].some((k) => lower.includes(k))) {
    return { auditStatus: 'approved', status: 'online' }
  }
  if (['waiting', 'pending', '待审核'].some((k) => lower.includes(k))) {
    return { auditStatus: 'pending', status: 'offline' }
  }
  return { auditStatus: raw, status: 'offline' }
}

function resolvePreviewItem(record: PlatformDatacenterApiRecord): PlatformDatacenterPreviewItem {
  const id = String(record.id)
  const audit = mapAuditStatus(record.audit_status)
  const platformTenantId =
    record.tenant_id != null && record.tenant_id > 0 ? String(record.tenant_id) : undefined
  const resolvedSupplier = platformTenantId
    ? MOCK_SUPPLIER_BY_TENANT_ID[platformTenantId]
    : undefined
  const local = MOCK_LOCAL_BY_ONBOARDING_ID[id]

  let action: PlatformDatacenterPreviewItem['action'] = 'create'
  let skipReason: string | undefined
  let errorMessage: string | undefined

  if (record.is_delete) {
    action = 'skip'
    skipReason = '源已删除'
  } else if (local) {
    action = 'skip'
    skipReason = '已存在'
  } else if (!record.name?.trim()) {
    action = 'error'
    errorMessage = '机房名称为空'
  } else if (!resolvedSupplier) {
    action = 'error'
    errorMessage = platformTenantId
      ? `未找到租户 ${platformTenantId} 对应的本地供应商，请先导入供应商`
      : '缺少租户 ID，无法匹配供应商'
  }

  return {
    externalOnboardingId: id,
    platform: {
      name: record.name?.trim() || '—',
      platformTenantId,
      zoneName: record.zone_name ?? undefined,
      region: record.container_instance_region ?? undefined,
      scale: record.scale ?? undefined,
      auditStatus: audit.auditStatus,
      status: audit.status,
      sourceDeleted: record.is_delete ?? false,
      createTime: record.create_time ?? undefined,
    },
    resolvedSupplier,
    local,
    action,
    skipReason,
    errorMessage,
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 模拟 preview：拉取平台 + 本地比对 */
export async function mockPreviewPlatformDatacenterImport(
  externalOnboardingIds: string[],
): Promise<PlatformDatacenterImportPreviewResult> {
  await delay(600)
  assertPlatformDatacenterIdCount(externalOnboardingIds)

  const items: PlatformDatacenterPreviewItem[] = []
  const missingPlatformIds: string[] = []

  for (const id of externalOnboardingIds) {
    const api = MOCK_PLATFORM_DATACENTER_RECORDS[id]
    if (!api) {
      missingPlatformIds.push(id)
      items.push({
        externalOnboardingId: id,
        platform: { name: '—' },
        missingOnPlatform: true,
        action: 'skip',
        skipReason: '平台未返回',
      })
      continue
    }
    items.push(resolvePreviewItem(api))
  }

  return { items, missingPlatformIds }
}

/** 模拟 commit：写库结果统计 */
export async function mockCommitPlatformDatacenterImport(input: {
  items: { externalOnboardingId: string }[]
}): Promise<PlatformDatacenterImportCommitResult> {
  await delay(800)

  let created = 0
  let skipped = 0
  const errors: PlatformDatacenterImportCommitResult['errors'] = []

  for (const item of input.items) {
    const api = MOCK_PLATFORM_DATACENTER_RECORDS[item.externalOnboardingId]
    if (!api) {
      skipped++
      continue
    }
    const preview = resolvePreviewItem(api)
    if (preview.action === 'create') {
      created++
    } else if (preview.action === 'error') {
      errors.push({
        externalOnboardingId: item.externalOnboardingId,
        message: preview.errorMessage ?? '无法导入',
      })
    } else {
      skipped++
    }
  }

  return { created, skipped, errors }
}
