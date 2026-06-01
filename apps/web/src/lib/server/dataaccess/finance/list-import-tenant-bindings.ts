import { db } from '@/lib/db'
import {
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawTenantBill,
  billingPeriodTenantProjectEnrichment,
  billingTenant,
  billingTenantCostAllocation,
  crmProject,
  customer,
  userStaff,
} from '@workspace/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

export type ImportSourceKind = 'tenant_bill' | 'baremetal'

export type ImportTenantBindingFilters = {
  tenantType?: 'all' | 'internal' | 'external'
  customerType?: 'all' | 'B' | 'C'
  staffId?: string
  department?: string
}

export type ImportTenantBindingRow = {
  tenant_platform_id: string
  import_sources: ImportSourceKind[]
  tenant_id: string | null
  tenant_name: string | null
  tenant_type: string | null
  customer_type: string | null
  customer_full_name: string | null
  project_id: string | null
  project_name: string | null
  staff_id: string | null
  account_manager_name: string | null
  staff_department: string | null
  project_revenue_department: string | null
  allocation_percent: string | null
  enrichment_source: string | null
}

async function collectImportSourcesByPlatformId(
  periodId: string,
): Promise<Map<string, Set<ImportSourceKind>>> {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const baremetalBatch = batches.find((b) => b.fileType === 'baremetal_order')
  const tenantBillBatches = batches.filter((b) => b.fileType === 'tenant_bill')

  const map = new Map<string, Set<ImportSourceKind>>()

  function add(id: string, source: ImportSourceKind) {
    let set = map.get(id)
    if (!set) {
      set = new Set()
      map.set(id, set)
    }
    set.add(source)
  }

  if (baremetalBatch) {
    const baremetalRows = await db
      .select({ tenantPlatformId: billingPeriodRawBaremetalOrder.tenantPlatformId })
      .from(billingPeriodRawBaremetalOrder)
      .where(eq(billingPeriodRawBaremetalOrder.batchId, baremetalBatch.id))
    for (const row of baremetalRows) add(row.tenantPlatformId, 'baremetal')
  }

  for (const batch of tenantBillBatches) {
    const tenantRows = await db
      .select({ tenantPlatformId: billingPeriodRawTenantBill.tenantPlatformId })
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, batch.id))
    for (const row of tenantRows) add(row.tenantPlatformId, 'tenant_bill')
  }

  return map
}

function matchesFilters(
  row: ImportTenantBindingRow,
  filters: ImportTenantBindingFilters,
): boolean {
  if (filters.tenantType && filters.tenantType !== 'all') {
    if (row.tenant_type !== filters.tenantType) return false
  }
  if (filters.customerType && filters.customerType !== 'all') {
    if (row.customer_type !== filters.customerType) return false
  }
  if (filters.staffId && filters.staffId !== 'all') {
    if (row.staff_id !== filters.staffId) return false
  }
  if (filters.department && filters.department !== 'all') {
    if (row.staff_department !== filters.department) return false
  }
  return true
}

export async function listImportTenantBindings(
  billingPeriodId: string,
  filters: ImportTenantBindingFilters = {},
): Promise<ImportTenantBindingRow[]> {
  const [importSources, enrichmentRows, allocations] = await Promise.all([
    collectImportSourcesByPlatformId(billingPeriodId),
    db
      .select()
      .from(billingPeriodTenantProjectEnrichment)
      .where(eq(billingPeriodTenantProjectEnrichment.billingPeriodId, billingPeriodId)),
    db
      .select()
      .from(billingTenantCostAllocation)
      .where(eq(billingTenantCostAllocation.billingPeriodId, billingPeriodId)),
  ])

  const allPlatformIds = new Set<string>([
    ...importSources.keys(),
    ...enrichmentRows.map((r) => r.tenantPlatformId),
  ])

  if (allPlatformIds.size === 0) return []

  const platformIdList = [...allPlatformIds]

  const tenants = await db
    .select({
      id: billingTenant.id,
      name: billingTenant.name,
      type: billingTenant.type,
      platformTenantId: billingTenant.platformTenantId,
      customerType: customer.type,
      customerName: customer.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(inArray(billingTenant.platformTenantId, platformIdList))

  const tenantByPlatformId = new Map(
    tenants.filter((t) => t.platformTenantId).map((t) => [t.platformTenantId!, t]),
  )

  const projectIds = [...new Set(enrichmentRows.map((r) => r.projectId))]
  const projects =
    projectIds.length > 0
      ? await db
          .select({
            id: crmProject.id,
            revenueDepartment: crmProject.revenueDepartment,
          })
          .from(crmProject)
          .where(inArray(crmProject.id, projectIds))
      : []
  const projectById = new Map(projects.map((p) => [p.id, p]))

  const staffIds = [
    ...new Set(enrichmentRows.map((r) => r.staffId).filter(Boolean)),
  ] as string[]
  const staffRows =
    staffIds.length > 0
      ? await db
          .select({
            id: userStaff.id,
            department: userStaff.department,
          })
          .from(userStaff)
          .where(inArray(userStaff.id, staffIds))
      : []
  const staffById = new Map(staffRows.map((s) => [s.id, s]))

  const allocByKey = new Map<string, string>()
  for (const a of allocations) {
    allocByKey.set(`${a.tenantId}::${a.projectId}`, a.allocationPercent)
  }

  const enrichmentByPlatform = new Map<string, typeof enrichmentRows>()
  for (const row of enrichmentRows) {
    const list = enrichmentByPlatform.get(row.tenantPlatformId) ?? []
    list.push(row)
    enrichmentByPlatform.set(row.tenantPlatformId, list)
  }

  const rows: ImportTenantBindingRow[] = []

  for (const platformId of platformIdList) {
    const tenant = tenantByPlatformId.get(platformId)
    const sources = [...(importSources.get(platformId) ?? [])].sort()
    const enrichments = enrichmentByPlatform.get(platformId) ?? []

    const base = {
      tenant_platform_id: platformId,
      import_sources: sources,
      tenant_id: tenant?.id ?? null,
      tenant_name: tenant?.name ?? null,
      tenant_type: tenant?.type ?? null,
      customer_type: tenant?.customerType ?? null,
      customer_full_name: tenant?.customerName ?? null,
    }

    if (enrichments.length === 0) {
      rows.push({
        ...base,
        project_id: null,
        project_name: null,
        staff_id: null,
        account_manager_name: null,
        staff_department: null,
        project_revenue_department: null,
        allocation_percent: null,
        enrichment_source: null,
      })
      continue
    }

    for (const e of enrichments) {
      const staff = e.staffId ? staffById.get(e.staffId) : undefined
      const project = projectById.get(e.projectId)
      const allocKey = `${e.tenantId}::${e.projectId}`
      const allocationPercent =
        allocByKey.get(allocKey) ?? (e.source === 'auto_single' ? '100' : null)

      rows.push({
        ...base,
        tenant_id: e.tenantId,
        project_id: e.projectId,
        project_name: e.projectName,
        staff_id: e.staffId,
        account_manager_name: e.accountManagerName,
        staff_department: staff?.department ?? null,
        project_revenue_department: project?.revenueDepartment ?? null,
        allocation_percent: allocationPercent,
        enrichment_source: e.source,
      })
    }
  }

  rows.sort((a, b) => {
    const platformCmp = a.tenant_platform_id.localeCompare(b.tenant_platform_id, 'zh-CN')
    if (platformCmp !== 0) return platformCmp
    return (a.project_name ?? '').localeCompare(b.project_name ?? '', 'zh-CN')
  })

  return rows.filter((row) => matchesFilters(row, filters))
}
