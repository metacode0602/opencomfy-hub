import { db } from '@/lib/db'
import type { GlobalSearchResult } from '@/lib/types/global-search'
import {
  billingTenant,
  crmProject,
  customer,
  dataCenter,
  supplier,
} from '@workspace/db/schema'
import { desc, eq, ilike, inArray, or } from 'drizzle-orm'

const RESULT_LIMIT = 5

function buildPattern(query: string) {
  return `%${query.trim()}%`
}

function customerHref(id: string) {
  return `/crm/customers/${id}`
}

function projectHref(id: string) {
  return `/crm/projects/${id}`
}

function tenantHref(id: string) {
  return `/crm/tenants/${id}`
}

function supplierHref(id: string) {
  return `/supplier/suppliers/${id}`
}

function datacenterHref(id: string) {
  return `/supplier/datacenters/${id}`
}

async function searchCustomers(pattern: string): Promise<GlobalSearchResult[]> {
  const rows = await db
    .select({
      id: customer.id,
      name: customer.name,
      contactPerson: customer.contactPerson,
    })
    .from(customer)
    .where(
      or(
        ilike(customer.name, pattern),
        ilike(customer.contactPerson, pattern),
        ilike(customer.certCode, pattern),
      ),
    )
    .orderBy(desc(customer.createdAt))
    .limit(RESULT_LIMIT)

  return rows.map((row) => ({
    id: row.id,
    type: 'customer',
    title: row.name,
    subtitle: row.contactPerson ?? undefined,
    href: customerHref(row.id),
  }))
}

async function searchProjects(pattern: string): Promise<GlobalSearchResult[]> {
  const matchingTenants = await db
    .select({ id: billingTenant.id })
    .from(billingTenant)
    .where(ilike(billingTenant.platformTenantId, pattern))

  const matchingTenantIds = matchingTenants.map((t) => t.id)
  const searchConditions = [ilike(crmProject.name, pattern), ilike(customer.name, pattern)]
  if (matchingTenantIds.length > 0) {
    searchConditions.push(inArray(crmProject.primaryTenantId, matchingTenantIds))
  }

  const rows = await db
    .select({
      id: crmProject.id,
      name: crmProject.name,
      customerName: customer.name,
      platformTenantId: billingTenant.platformTenantId,
    })
    .from(crmProject)
    .leftJoin(customer, eq(crmProject.customerId, customer.id))
    .leftJoin(billingTenant, eq(crmProject.primaryTenantId, billingTenant.id))
    .where(or(...searchConditions))
    .orderBy(desc(crmProject.createdAt))
    .limit(RESULT_LIMIT)

  return rows.map((row) => {
    const subtitleParts = [row.customerName, row.platformTenantId ? `租户 ${row.platformTenantId}` : null]
      .filter(Boolean)
      .join(' · ')

    return {
      id: row.id,
      type: 'project',
      title: row.name,
      subtitle: subtitleParts || undefined,
      href: projectHref(row.id),
    }
  })
}

async function searchTenants(pattern: string): Promise<GlobalSearchResult[]> {
  const rows = await db
    .select({
      id: billingTenant.id,
      name: billingTenant.name,
      platformTenantId: billingTenant.platformTenantId,
      customerName: customer.name,
    })
    .from(billingTenant)
    .innerJoin(customer, eq(customer.id, billingTenant.customerId))
    .where(
      or(
        ilike(billingTenant.platformTenantId, pattern),
        ilike(billingTenant.name, pattern),
        ilike(billingTenant.phone, pattern),
        ilike(customer.name, pattern),
      ),
    )
    .orderBy(desc(billingTenant.createdAt))
    .limit(RESULT_LIMIT)

  return rows.map((row) => ({
    id: row.id,
    type: 'tenant',
    title: row.name,
    subtitle: [row.platformTenantId ? `租户ID ${row.platformTenantId}` : null, row.customerName]
      .filter(Boolean)
      .join(' · ') || undefined,
    href: tenantHref(row.id),
  }))
}

async function searchSuppliers(pattern: string): Promise<GlobalSearchResult[]> {
  const rows = await db
    .select({
      id: supplier.id,
      name: supplier.name,
      shortName: supplier.shortName,
      externalTenantId: supplier.externalTenantId,
      platformTenantId: supplier.platformTenantId,
    })
    .from(supplier)
    .where(
      or(
        ilike(supplier.name, pattern),
        ilike(supplier.shortName, pattern),
        ilike(supplier.code, pattern),
        ilike(supplier.externalTenantId, pattern),
        ilike(supplier.platformTenantId, pattern),
        ilike(supplier.contactPerson, pattern),
      ),
    )
    .orderBy(desc(supplier.createdAt))
    .limit(RESULT_LIMIT)

  return rows.map((row) => ({
    id: row.id,
    type: 'supplier',
    title: row.name,
    subtitle:
      [row.shortName !== row.name ? row.shortName : null, row.externalTenantId ? `租户ID ${row.externalTenantId}` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
    href: supplierHref(row.id),
  }))
}

async function searchDatacenters(pattern: string): Promise<GlobalSearchResult[]> {
  const rows = await db
    .select({
      id: dataCenter.id,
      name: dataCenter.name,
      code: dataCenter.code,
      location: dataCenter.location,
      platformTenantId: dataCenter.platformTenantId,
      supplierName: supplier.name,
    })
    .from(dataCenter)
    .innerJoin(supplier, eq(dataCenter.supplierId, supplier.id))
    .where(
      or(
        ilike(dataCenter.name, pattern),
        ilike(dataCenter.code, pattern),
        ilike(dataCenter.location, pattern),
        ilike(dataCenter.platformTenantId, pattern),
        ilike(supplier.name, pattern),
      ),
    )
    .orderBy(desc(dataCenter.createdAt))
    .limit(RESULT_LIMIT)

  return rows.map((row) => ({
    id: row.id,
    type: 'datacenter',
    title: row.name,
    subtitle:
      [row.supplierName, row.location, row.platformTenantId ? `租户ID ${row.platformTenantId}` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
    href: datacenterHref(row.id),
  }))
}

export const globalSearchDataAccess = {
  async search(query: string): Promise<GlobalSearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const pattern = buildPattern(trimmed)
    const [customers, projects, tenants, suppliers, datacenters] = await Promise.all([
      searchCustomers(pattern),
      searchProjects(pattern),
      searchTenants(pattern),
      searchSuppliers(pattern),
      searchDatacenters(pattern),
    ])

    return [...customers, ...projects, ...tenants, ...suppliers, ...datacenters]
  },
}
