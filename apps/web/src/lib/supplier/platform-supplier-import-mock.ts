import type {
  PlatformSupplierApiRecord,
  PlatformSupplierImportCommitInput,
  PlatformSupplierImportCommitResult,
  PlatformSupplierImportPreviewResult,
  PlatformSupplierPreviewItem,
} from '@/lib/types/platform-supplier-import'

import {
  assertPlatformSupplierIdCount,
  parsePlatformSupplierIds,
  PLATFORM_SUPPLIER_IMPORT_MAX_IDS,
} from '@/lib/supplier/platform-supplier-import-utils'

export { parsePlatformSupplierIds, PLATFORM_SUPPLIER_IMPORT_MAX_IDS }

/** 模拟 CRM 在职商务经理（弹窗下拉） */
export const MOCK_IMPORT_BUSINESS_MANAGERS = [
  { id: 'mock-staff-1', displayName: '张明', employeeNo: 'E001' },
  { id: 'mock-staff-2', displayName: '李芳', employeeNo: 'E002' },
  { id: 'mock-staff-3', displayName: '王强', employeeNo: 'E003' },
]

/** 平台侧供应商入驻快照（Mock OpenAPI results） */
const MOCK_PLATFORM_SUPPLIER_RECORDS: Record<string, PlatformSupplierApiRecord> = {
  '10001': {
    id: 10001,
    tenant_id: 16462,
    type: 'enterprise',
    name: '北京深智算力科技有限公司',
    credential_code: '91110108MA01XXXX1X',
    contact_person: '张明',
    contact_phone: '13800138001',
    audit_status: 'Pass',
    split_mode: 'card_time',
    admin_phone: '+8613800138001',
    admin_email: 'zhangming@example.com',
    create_time: '2025-11-01 10:00:00.000000 +08:00',
  },
  '10002': {
    id: 10002,
    tenant_id: 16463,
    type: 'enterprise',
    name: '上海云算信息技术有限公司',
    credential_code: '91310000MA1XXXX2Y',
    contact_person: '李工',
    contact_phone: '13900001111',
    audit_status: 'Waiting',
    split_mode: 'revenue_share',
    admin_phone: '+8613900001111',
    admin_email: 'li@yunuan.example.com',
    create_time: '2026-05-19 14:22:01.000000 +08:00',
  },
  '10003': {
    id: 10003,
    tenant_id: 0,
    type: 'individual',
    name: '个人供应商 · 王五',
    credential_code: '110101199001011234',
    contact_person: '王五',
    contact_phone: '13600002222',
    audit_status: 'Pass',
    split_mode: 'card_time',
    admin_phone: '+8613600002222',
    admin_email: 'wangwu@example.com',
    create_time: '2026-05-20 09:07:08.918708 +08:00',
  },
}

/** 模拟 CRM 已入库供应商（external_onboarding_id → 本地） */
const MOCK_LOCAL_BY_ONBOARDING_ID: Record<
  string,
  { supplierId: string; supplierName: string; businessManager: string }
> = {
  '10001': {
    supplierId: 'mock-supplier-10001',
    supplierName: '北京深智算力科技有限公司',
    businessManager: '张明',
  },
}

function mapOnboardingType(raw?: string | null): PlatformSupplierPreviewItem['platform']['onboardingType'] {
  if (!raw) return undefined
  const s = raw.trim().toLowerCase()
  if (['personal', 'individual', '个人'].some((k) => s.includes(k))) return 'individual'
  if (['enterprise', 'company', '企业'].some((k) => s.includes(k))) return 'enterprise'
  return undefined
}

function mapCooperationMode(raw?: string | null): PlatformSupplierPreviewItem['platform']['cooperationMode'] {
  if (!raw) return 'card_time'
  const s = raw.trim().toLowerCase()
  if (['revenue', 'share', '分成'].some((k) => s.includes(k))) return 'revenue_share'
  return 'card_time'
}

function mapAuditStatus(raw?: string | null): {
  auditStatus: string
  status: PlatformSupplierPreviewItem['platform']['status']
} {
  if (!raw) return { auditStatus: 'pending', status: 'negotiating' }
  const lower = raw.trim().toLowerCase()
  if (['pass', 'approved', '已通过'].some((k) => lower.includes(k))) {
    return { auditStatus: 'approved', status: 'cooperating' }
  }
  if (['waiting', 'pending', '待审核'].some((k) => lower.includes(k))) {
    return { auditStatus: 'pending', status: 'negotiating' }
  }
  return { auditStatus: raw, status: 'negotiating' }
}

function mapApiToPreviewItem(
  record: PlatformSupplierApiRecord,
  local?: PlatformSupplierPreviewItem['local'],
): PlatformSupplierPreviewItem {
  const audit = mapAuditStatus(record.audit_status)
  const action: PlatformSupplierPreviewItem['action'] = local ? 'update' : 'create'

  return {
    externalOnboardingId: String(record.id),
    platform: {
      name: record.name?.trim() || '—',
      onboardingType: mapOnboardingType(record.type),
      platformTenantId:
        record.tenant_id != null && record.tenant_id > 0 ? String(record.tenant_id) : undefined,
      contactPerson: record.contact_person ?? undefined,
      contactPhone: record.contact_phone ?? undefined,
      adminPhone: record.admin_phone ?? undefined,
      adminEmail: record.admin_email ?? undefined,
      auditStatus: audit.auditStatus,
      cooperationMode: mapCooperationMode(record.split_mode),
      status: audit.status,
      createTime: record.create_time ?? undefined,
    },
    local,
    action,
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 模拟 preview：拉取平台 + 本地比对 */
export async function mockPreviewPlatformSupplierImport(input: {
  externalOnboardingIds: string[]
  defaultBusinessManagerStaffId: string
  defaultBusinessManagerLabel: string
}): Promise<PlatformSupplierImportPreviewResult> {
  await delay(600)

  const ids = input.externalOnboardingIds
  assertPlatformSupplierIdCount(ids)

  if (!input.defaultBusinessManagerStaffId) {
    throw new Error('请选择默认商务经理')
  }
  if (!input.defaultBusinessManagerLabel.trim()) {
    throw new Error('所选商务经理无效')
  }

  const items: PlatformSupplierPreviewItem[] = []
  const missingPlatformIds: string[] = []

  for (const id of ids) {
    const api = MOCK_PLATFORM_SUPPLIER_RECORDS[id]
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
    const local = MOCK_LOCAL_BY_ONBOARDING_ID[id]
    items.push(mapApiToPreviewItem(api, local))
  }

  return {
    items,
    missingPlatformIds,
    defaultBusinessManagerStaffId: input.defaultBusinessManagerStaffId,
    defaultBusinessManagerLabel: input.defaultBusinessManagerLabel,
  }
}

/** 模拟 commit：写库结果统计 */
export async function mockCommitPlatformSupplierImport(
  input: PlatformSupplierImportCommitInput,
): Promise<PlatformSupplierImportCommitResult> {
  await delay(800)

  if (!input.defaultBusinessManagerStaffId) {
    throw new Error('缺少默认商务经理')
  }

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: PlatformSupplierImportCommitResult['errors'] = []

  for (const item of input.items) {
    const api = MOCK_PLATFORM_SUPPLIER_RECORDS[item.externalOnboardingId]
    if (!api) {
      skipped++
      continue
    }
    const local = MOCK_LOCAL_BY_ONBOARDING_ID[item.externalOnboardingId]
    if (local) {
      updated++
    } else {
      created++
    }
  }

  return { created, updated, skipped, errors }
}
