import type {
  MockImportCustomerOption,
  PlatformImportCommitItem,
  PlatformImportCommitResult,
  PlatformImportPreviewResult,
  PlatformTenantApiRecord,
  PlatformTenantPreviewItem,
} from '@/lib/types/platform-tenant-import'

const MAX_IDS = 50

/** 模拟「关联已有客户」下拉选项 */
export const MOCK_IMPORT_CUSTOMERS: MockImportCustomerOption[] = [
  { id: 'mock-cust-1', name: '北京深智科技有限公司', type: 'B' },
  { id: 'mock-cust-2', name: '上海云算信息技术有限公司', type: 'B' },
  { id: 'mock-cust-3', name: '个人用户 · 199****4603', type: 'C' },
  { id: 'mock-cust-4', name: '杭州智绘视觉工作室', type: 'C' },
]

/** 平台侧租户快照（Mock OpenAPI results） */
const MOCK_PLATFORM_RECORDS: Record<string, PlatformTenantApiRecord> = {
  '16462': {
    id: 16462,
    tenant_type: 'GongjiSuanLi',
    tenant_name: 'gjaL23kNjSM',
    admin_id: 16065,
    create_time: '2026-05-20 09:07:08.918708 +08:00',
    merchant_id: 0,
    coin: 0,
    company_name: null,
    contact_user: null,
    contact_phone: null,
    admin_phone: '+8619973214603',
    admin_nickname: '199****4603',
    limit_coin: null,
    merchant_mark: 'GongjiSuanLi',
  },
  '16463': {
    id: 16463,
    tenant_type: 'GongjiSuanLi',
    tenant_name: 'demo-tenant-b',
    admin_id: 16066,
    create_time: '2026-05-19 14:22:01.000000 +08:00',
    merchant_id: 0,
    coin: 12880,
    company_name: '上海云算信息技术有限公司',
    contact_user: '李工',
    contact_phone: '13900001111',
    admin_phone: '+8613900001111',
    limit_coin: 50000,
    merchant_mark: 'GongjiSuanLi',
  },
  '10001': {
    id: 10001,
    tenant_type: 'GongjiSuanLi',
    tenant_name: 'legacy-platform-tenant',
    admin_id: 12001,
    create_time: '2025-11-01 10:00:00.000000 +08:00',
    coin: 25600,
    company_name: '北京深智科技有限公司',
    contact_user: '张明',
    contact_phone: '13800138001',
    admin_phone: '+8613800138001',
    limit_coin: 100000,
    merchant_mark: 'GongjiSuanLi',
  },
}

/** 模拟 CRM 已入库租户（platform_tenant_id → 本地） */
const MOCK_LOCAL_BY_PLATFORM_ID: Record<
  string,
  { tenantId: string; customerId: string; customerName: string }
> = {
  '10001': {
    tenantId: 'mock-tenant-10001',
    customerId: 'mock-cust-1',
    customerName: '北京深智科技有限公司',
  },
}

export function parsePlatformTenantIds(raw: string): string[] {
  const parts = raw
    .split(/[,，\s\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const ids: string[] = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) continue
    if (seen.has(p)) continue
    seen.add(p)
    ids.push(p)
  }
  return ids
}

function mapApiToPreviewItem(
  record: PlatformTenantApiRecord,
  local?: PlatformTenantPreviewItem['local'],
): PlatformTenantPreviewItem {
  return {
    platformTenantId: String(record.id),
    platform: {
      tenantName: record.tenant_name,
      adminPhone: record.admin_phone ?? undefined,
      coin: record.coin ?? 0,
      limitCoin: record.limit_coin ?? undefined,
      companyName: record.company_name ?? undefined,
      contactUser: record.contact_user ?? undefined,
      contactPhone: record.contact_phone ?? undefined,
      createTime: record.create_time,
      tenantType: record.tenant_type ?? undefined,
    },
    local,
  }
}

export function defaultCreateCustomerFromPlatform(
  item: PlatformTenantPreviewItem,
): PlatformImportCommitItem['customer'] & { mode: 'create' } {
  const p = item.platform
  const name =
    p.companyName?.trim() ||
    p.adminPhone?.trim() ||
    p.tenantName?.trim() ||
    `租户-${item.platformTenantId}`
  return {
    mode: 'create',
    name,
    type: p.companyName ? 'B' : 'C',
    contactPerson: p.contactUser?.trim() ?? '',
    contactPhone: p.contactPhone?.trim() || p.adminPhone?.trim() || '',
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 模拟 preview：拉取平台 + 本地比对 */
export async function mockPreviewPlatformImport(
  platformTenantIds: string[],
): Promise<PlatformImportPreviewResult> {
  await delay(600)

  if (platformTenantIds.length === 0) {
    throw new Error('请至少输入一个平台租户 ID')
  }
  if (platformTenantIds.length > MAX_IDS) {
    throw new Error(`单次最多 ${MAX_IDS} 个租户 ID`)
  }

  const items: PlatformTenantPreviewItem[] = []
  const missingPlatformIds: string[] = []

  for (const id of platformTenantIds) {
    const api = MOCK_PLATFORM_RECORDS[id]
    if (!api) {
      missingPlatformIds.push(id)
      items.push({
        platformTenantId: id,
        platform: {
          tenantName: '—',
          coin: 0,
        },
        missingOnPlatform: true,
      })
      continue
    }
    const local = MOCK_LOCAL_BY_PLATFORM_ID[id]
    items.push(mapApiToPreviewItem(api, local))
  }

  return { items, missingPlatformIds }
}

/** 模拟 commit：写库结果统计 */
export async function mockCommitPlatformImport(
  items: PlatformImportCommitItem[],
): Promise<PlatformImportCommitResult> {
  await delay(800)

  let createdTenants = 0
  let updatedTenants = 0
  let createdCustomers = 0
  const errors: PlatformImportCommitResult['errors'] = []

  for (const item of items) {
    const local = MOCK_LOCAL_BY_PLATFORM_ID[item.platformTenantId]
    if (local) {
      updatedTenants++
      continue
    }
    if (item.customer.mode === 'create') {
      createdCustomers++
      createdTenants++
    } else if (item.customer.mode === 'existing') {
      const customerId = item.customer.customerId
      const exists = MOCK_IMPORT_CUSTOMERS.some((c) => c.id === customerId)
      if (!exists) {
        errors.push({
          platformTenantId: item.platformTenantId,
          message: '所选客户不存在',
        })
        continue
      }
      createdTenants++
    }
  }

  return {
    createdTenants,
    updatedTenants,
    createdCustomers,
    errors,
  }
}
