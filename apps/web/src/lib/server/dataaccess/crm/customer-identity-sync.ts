import { db } from '@/lib/db'
import {
  EnterpriseAuthApiError,
  fetchAllEnterpriseAuthPages,
  parsePlatformEnterpriseAuthTime,
  type PlatformEnterpriseAuthRecord,
} from '@/lib/server/integrations/enterprise-auth-api'
import type {
  CustomerIdentitySyncApplyResult,
  CustomerIdentitySyncPreviewItem,
  CustomerIdentitySyncPreviewResult,
} from '@/lib/types/customer-identity-sync'
import { billingTenant, customer } from '@workspace/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { crmLog } from '@/lib/server/dataaccess/crm/logger'

const APPROVED_STATUS = 'Approved'

function resolveVerificationType(record: PlatformEnterpriseAuthRecord): 'manual' | 'auto' {
  return record.admin_id != null && record.admin_id > 0 ? 'manual' : 'auto'
}

function buildPreviewItem(
  record: PlatformEnterpriseAuthRecord,
  tenantByPlatformId: Map<string, { tenantId: string; customerId: string }>,
  customerById: Map<
    string,
    {
      name: string
      certCode: string | null
      identityVerified: boolean
    }
  >,
): CustomerIdentitySyncPreviewItem {
  const platformTenantId = String(record.tenant_id)
  const base = {
    auditId: record.audit_id,
    platformTenantId,
    companyName: record.company_name,
    companyCode: record.company_code,
    auditStatus: record.audit_status,
    operatingTime: record.operating_time ?? null,
    adminId: record.admin_id ?? null,
  }

  if (record.audit_status !== APPROVED_STATUS) {
    return { ...base, matchStatus: 'not_approved' }
  }

  const tenant = tenantByPlatformId.get(platformTenantId)
  if (!tenant) {
    return { ...base, matchStatus: 'no_tenant' }
  }

  const localCustomer = customerById.get(tenant.customerId)
  if (!localCustomer) {
    return {
      ...base,
      matchStatus: 'no_tenant',
      localTenantId: tenant.tenantId,
      customerId: tenant.customerId,
    }
  }

  const proposedVerificationType = resolveVerificationType(record)

  if (localCustomer.identityVerified) {
    return {
      ...base,
      matchStatus: 'already_verified',
      customerId: tenant.customerId,
      customerName: localCustomer.name,
      localTenantId: tenant.tenantId,
      currentIdentityVerified: true,
      currentCertCode: localCustomer.certCode ?? undefined,
      proposedVerificationType,
    }
  }

  return {
    ...base,
    matchStatus: 'updatable',
    customerId: tenant.customerId,
    customerName: localCustomer.name,
    localTenantId: tenant.tenantId,
    currentIdentityVerified: false,
    currentCertCode: localCustomer.certCode ?? undefined,
    proposedVerificationType,
  }
}

async function loadTenantCustomerMaps() {
  const tenantRows = await db
    .select({
      id: billingTenant.id,
      customerId: billingTenant.customerId,
      platformTenantId: billingTenant.platformTenantId,
    })
    .from(billingTenant)
    .where(isNotNull(billingTenant.platformTenantId))

  const tenantByPlatformId = new Map<string, { tenantId: string; customerId: string }>()
  for (const row of tenantRows) {
    const platformId = row.platformTenantId?.trim()
    if (!platformId) continue
    tenantByPlatformId.set(platformId, { tenantId: row.id, customerId: row.customerId })
  }

  const customerRows = await db
    .select({
      id: customer.id,
      name: customer.name,
      certCode: customer.certCode,
      identityVerified: customer.identityVerified,
    })
    .from(customer)

  const customerById = new Map(
    customerRows.map((row) => [
      row.id,
      {
        name: row.name,
        certCode: row.certCode,
        identityVerified: row.identityVerified,
      },
    ]),
  )

  return { tenantByPlatformId, customerById }
}

export const customerIdentitySyncDataAccess = {
  async previewSync(): Promise<CustomerIdentitySyncPreviewResult> {
    const { records, platformCount } = await fetchAllEnterpriseAuthPages()
    const { tenantByPlatformId, customerById } = await loadTenantCustomerMaps()

    const items = records.map((record) =>
      buildPreviewItem(record, tenantByPlatformId, customerById),
    )

    return {
      platformCount,
      fetchedCount: records.length,
      items,
      updatableCount: items.filter((item) => item.matchStatus === 'updatable').length,
      alreadyVerifiedCount: items.filter((item) => item.matchStatus === 'already_verified').length,
      unmatchedCount: items.filter((item) => item.matchStatus === 'no_tenant').length,
      notApprovedCount: items.filter((item) => item.matchStatus === 'not_approved').length,
    }
  },

  async applySync(input: { customerIds: string[] }): Promise<CustomerIdentitySyncApplyResult> {
    const uniqueCustomerIds = [...new Set(input.customerIds.filter(Boolean))]
    if (uniqueCustomerIds.length === 0) {
      return { updatedCount: 0, skippedCount: 0, customerIds: [] }
    }

    const preview = await this.previewSync()
    const updatableByCustomerId = new Map(
      preview.items
        .filter((item) => item.matchStatus === 'updatable' && item.customerId)
        .map((item) => [item.customerId!, item]),
    )

    let updatedCount = 0
    let skippedCount = 0
    const updatedCustomerIds: string[] = []

    await db.transaction(async (tx) => {
      for (const customerId of uniqueCustomerIds) {
        const item = updatableByCustomerId.get(customerId)
        if (!item?.proposedVerificationType) {
          skippedCount += 1
          continue
        }

        const verifiedAt =
          parsePlatformEnterpriseAuthTime(item.operatingTime) ?? new Date()

        await tx
          .update(customer)
          .set({
            identityVerified: true,
            identityVerifiedAt: verifiedAt,
            identityVerificationType: item.proposedVerificationType,
          })
          .where(and(eq(customer.id, customerId), eq(customer.identityVerified, false)))

        updatedCount += 1
        updatedCustomerIds.push(customerId)
      }
    })

    crmLog('customer-identity-sync', 'apply done', {
      requested: uniqueCustomerIds.length,
      updatedCount,
      skippedCount,
    })

    return {
      updatedCount,
      skippedCount,
      customerIds: updatedCustomerIds,
    }
  },
}

export { EnterpriseAuthApiError }
