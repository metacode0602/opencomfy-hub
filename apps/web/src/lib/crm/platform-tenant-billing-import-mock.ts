import { validateBillingDateRange } from '@/lib/crm/tenant-billing-import-utils'
import {
  mockCommitTenantBillingImport,
  mockFetchTenantBillingImportPreview,
} from '@/lib/crm/tenant-billing-import-mock'
import type {
  PlatformImportBillingBatchResult,
  PlatformImportBillingItemResult,
} from '@/lib/types/platform-tenant-import'
import type { TenantBillingImportCommitResult } from '@/lib/types/tenant-billing-import'

export type PlatformBillingImportTarget = {
  platformTenantId: string
  tenantId: string
  tenantName: string
}

function formatBillingCommitSummary(result: TenantBillingImportCommitResult): string {
  const parts: string[] = []
  const push = (label: string, s: { created: number; updated: number }) => {
    if (s.created + s.updated > 0) {
      parts.push(`${label} 新增 ${s.created} / 更新 ${s.updated}`)
    }
  }
  push('裸金属', result.metalOrders)
  push('月度账单', result.monthlyBills)
  push('充值', result.recharges)
  if ((result.billDetails.created ?? 0) + (result.billDetails.updated ?? 0) > 0) {
    parts.push(`账单明细 ${result.billDetails.created ?? 0} 行`)
  }
  return parts.join('；') || '无变更'
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mock：平台批量导入租户成功后，逐租户拉取预览并直接 commit（跳过用户确认账单预览）
 * 后续替换为 tRPC batchImportBillingForPlatformTenants
 */
export async function mockBatchImportBillingForPlatformTenants(input: {
  tenants: PlatformBillingImportTarget[]
  startDate?: string
  endDate?: string
  onProgress?: (current: number, total: number, tenantName: string) => void
}): Promise<PlatformImportBillingBatchResult> {
  validateBillingDateRange(input.startDate, input.endDate)

  const items: PlatformImportBillingItemResult[] = []
  const total = input.tenants.length

  for (let i = 0; i < input.tenants.length; i++) {
    const tenant = input.tenants[i]!
    input.onProgress?.(i + 1, total, tenant.tenantName)

    try {
      const preview = await mockFetchTenantBillingImportPreview({
        tenantId: tenant.tenantId,
        platformTenantId: tenant.platformTenantId,
        tenantName: tenant.tenantName,
        startDate: input.startDate,
        endDate: input.endDate,
      })

      const toWrite = Object.values(preview.sections).reduce(
        (n, s) => n + s.summary.toCreate + s.summary.toUpdate,
        0,
      )

      if (toWrite === 0) {
        items.push({
          platformTenantId: tenant.platformTenantId,
          tenantName: tenant.tenantName,
          success: true,
          summary: '均已同步，无需写入',
        })
        continue
      }

      const commitResult = await mockCommitTenantBillingImport(preview.previewId)
      const sectionErrors = [
        ...commitResult.metalOrders.errors,
        ...commitResult.monthlyBills.errors,
        ...commitResult.recharges.errors,
        ...commitResult.billDetails.errors,
      ]

      if (sectionErrors.length > 0) {
        items.push({
          platformTenantId: tenant.platformTenantId,
          tenantName: tenant.tenantName,
          success: false,
          error: sectionErrors.map((e) => e.message).join('；'),
          summary: formatBillingCommitSummary(commitResult),
        })
      } else {
        items.push({
          platformTenantId: tenant.platformTenantId,
          tenantName: tenant.tenantName,
          success: true,
          summary: formatBillingCommitSummary(commitResult),
        })
      }
    } catch (e) {
      items.push({
        platformTenantId: tenant.platformTenantId,
        tenantName: tenant.tenantName,
        success: false,
        error: e instanceof Error ? e.message : '账单导入失败',
      })
    }

    // 模拟逐租户限流间隔
    if (i < input.tenants.length - 1) {
      await delay(200)
    }
  }

  return {
    items,
    successCount: items.filter((i) => i.success).length,
    failedCount: items.filter((i) => !i.success).length,
  }
}
