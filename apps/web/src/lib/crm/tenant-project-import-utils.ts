import {
  assertPlatformTenantIdCount,
  parsePlatformTenantIds,
  PLATFORM_TENANT_IMPORT_MAX_IDS,
} from '@/lib/crm/platform-tenant-import-utils'
import type { TenantProjectImportFormValues } from '@/lib/types/tenant-project-import'
import type { UserStaff } from '@/lib/types/crm'
import { resolveDefaultStaffId } from '@/lib/crm/staff-constants'

export { parsePlatformTenantIds, assertPlatformTenantIdCount, PLATFORM_TENANT_IMPORT_MAX_IDS }

/** 租户项目导入可选的系统预置标签（与 project-tags 种子数据一致） */
export const TENANT_PROJECT_IMPORT_TAG_NAMES = [
  '销售新客',
  '平台老客',
  '公海池-无人跟踪',
  '中台直客',
  '产品直客',
] as const

export function emptyTenantProjectImportForm(
  staff: readonly UserStaff[] = [],
): TenantProjectImportFormValues {
  return {
    stage: 'lead',
    businessLineId: '',
    preSalesStaffId: '',
    accountManagerStaffId: resolveDefaultStaffId(staff, 'account_manager') ?? '',
    deliveryManagerStaffId: resolveDefaultStaffId(staff, 'delivery_manager') ?? '',
    projectManagerStaffId: '',
    tagId: '',
    startDate: '',
  }
}
