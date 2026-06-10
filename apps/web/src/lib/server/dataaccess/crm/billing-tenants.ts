import { db } from '@/lib/db'
import {
  parseWorkbookBuffer,
  pickColumn,
  parseMoneyCell,
  type SheetRow,
} from '@/lib/server/dataaccess/finance/excel-parser'
import type {
  BillingTenantDetail,
  BillingTenantInternalSettingInput,
  BillingTenantListItem,
  BillingTenantUpdateInput,
  TenantImportResult,
} from '@/lib/types/billing-tenant'
import type { ProjectTagOption } from '@/lib/server/dataaccess/crm/project-tags'
import {
  billingTenant,
  crmProject,
  customer,
  projectTag,
  projectTagAssignment,
  projectTenant,
} from '@workspace/db/schema'
import {
  buildTenantIdFilter,
  filterTenantGetById,
  loadVisibleTenantIds,
  type CrmDataScope,
} from '@/lib/server/auth/crm-data-scope'
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'

export type {
  BillingTenantDetail,
  BillingTenantInternalSettingInput,
  BillingTenantListItem,
  BillingTenantUpdateInput,
  TenantImportResult,
}

function newId() {
  return crypto.randomUUID()
}

function toNumber(val: string | null | undefined): number {
  if (val == null || val === '') return 0
  const n = Number(val)
  return Number.isNaN(n) ? 0 : n
}

function toIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined
  return d.toISOString()
}

function parseOverdueAt(raw: string | null): Date | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  const d = new Date(s.replace(/\//g, '-'))
  if (!Number.isNaN(d.getTime())) return d
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(s)
  if (!m) return null
  const [, y, mo, da, h = '0', mi = '0', se = '0'] = m
  const parsed = new Date(
    Number(y),
    Number(mo) - 1,
    Number(da),
    Number(h),
    Number(mi),
    Number(se),
  )
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function mapListRow(
  t: typeof billingTenant.$inferSelect,
  c: typeof customer.$inferSelect,
  projectTags: BillingTenantListItem['projectTags'] = [],
): BillingTenantListItem {
  return {
    id: t.id,
    customerId: t.customerId,
    platformTenantId: t.platformTenantId ?? undefined,
    name: t.name,
    phone: t.phone ?? undefined,
    status: t.status,
    type: t.type as BillingTenantListItem['type'],
    internalEffectiveFrom: t.internalEffectiveFrom ?? undefined,
    internalEffectiveTo: t.internalEffectiveTo ?? undefined,
    balance: toNumber(t.balance),
    overdueAt: toIso(t.overdue_at ?? undefined),
    creditLimit: t.credit_limit != null ? toNumber(t.credit_limit) : undefined,
    isDefault: t.isDefault,
    createdAt: t.createdAt.toISOString(),
    platformRegisteredAt: toIso(t.platformRegisteredAt ?? undefined),
    customerName: c.name,
    contactPerson: c.contactPerson ?? undefined,
    contactPhone: c.contactPhone ?? undefined,
    projectTags,
  }
}

async function loadTenantIdsWithTag(tagId: string): Promise<Set<string>> {
  const [primaryRows, linkedRows] = await Promise.all([
    db
      .select({ tenantId: crmProject.primaryTenantId })
      .from(crmProject)
      .innerJoin(projectTagAssignment, eq(projectTagAssignment.projectId, crmProject.id))
      .where(
        and(eq(projectTagAssignment.tagId, tagId), sql`${crmProject.primaryTenantId} IS NOT NULL`),
      ),
    db
      .select({ tenantId: projectTenant.tenantId })
      .from(projectTenant)
      .innerJoin(projectTagAssignment, eq(projectTagAssignment.projectId, projectTenant.projectId))
      .where(eq(projectTagAssignment.tagId, tagId)),
  ])

  const ids = new Set<string>()
  for (const row of primaryRows) {
    if (row.tenantId) ids.add(row.tenantId)
  }
  for (const row of linkedRows) {
    ids.add(row.tenantId)
  }
  return ids
}

async function loadProjectTagsByTenantIds(
  tenantIds: string[],
): Promise<Map<string, BillingTenantListItem['projectTags']>> {
  const empty = new Map<string, BillingTenantListItem['projectTags']>()
  if (tenantIds.length === 0) return empty

  const [primaryProjects, linkedProjects] = await Promise.all([
    db
      .select({
        tenantId: crmProject.primaryTenantId,
        projectId: crmProject.id,
      })
      .from(crmProject)
      .where(inArray(crmProject.primaryTenantId, tenantIds)),
    db
      .select({
        tenantId: projectTenant.tenantId,
        projectId: projectTenant.projectId,
      })
      .from(projectTenant)
      .where(inArray(projectTenant.tenantId, tenantIds)),
  ])

  const tenantToProjects = new Map<string, Set<string>>()
  for (const row of [...primaryProjects, ...linkedProjects]) {
    if (!row.tenantId) continue
    const set = tenantToProjects.get(row.tenantId) ?? new Set<string>()
    set.add(row.projectId)
    tenantToProjects.set(row.tenantId, set)
  }

  const allProjectIds = [
    ...new Set([...tenantToProjects.values()].flatMap((projectIds) => [...projectIds])),
  ]

  const projectToTags = new Map<string, ProjectTagOption[]>()
  if (allProjectIds.length > 0) {
    const tagRows = await db
      .select({
        projectId: projectTagAssignment.projectId,
        id: projectTag.id,
        name: projectTag.name,
        sortOrder: projectTag.sortOrder,
      })
      .from(projectTagAssignment)
      .innerJoin(projectTag, eq(projectTagAssignment.tagId, projectTag.id))
      .where(inArray(projectTagAssignment.projectId, allProjectIds))
      .orderBy(asc(projectTag.sortOrder), asc(projectTag.name))

    for (const row of tagRows) {
      const list = projectToTags.get(row.projectId) ?? []
      if (!list.some((tag) => tag.id === row.id)) {
        list.push({ id: row.id, name: row.name })
      }
      projectToTags.set(row.projectId, list)
    }
  }

  for (const tenantId of tenantIds) {
    const projectIds = tenantToProjects.get(tenantId)
    if (!projectIds || projectIds.size === 0) {
      empty.set(tenantId, [])
      continue
    }

    const tagById = new Map<string, ProjectTagOption>()
    for (const projectId of projectIds) {
      for (const tag of projectToTags.get(projectId) ?? []) {
        tagById.set(tag.id, tag)
      }
    }

    empty.set(
      tenantId,
      [...tagById.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    )
  }

  return empty
}

const IMPORT_PLATFORM_ID = ['租户ID', 'tenant_id', 'platform_tenant_id']
const IMPORT_PHONE = ['租户手机号']
const IMPORT_COMPANY = ['租户公司名']
const IMPORT_CONTACT = ['租户联系人']
const IMPORT_CONTACT_PHONE = ['租户联系人手机号']
const IMPORT_BALANCE = ['余额(元)', '余额']
const IMPORT_OVERDUE = ['欠费时间']
const IMPORT_CREDIT = ['授信额度(元)', '授信额度']

type ParsedImportRow = {
  rowNo: number
  platformTenantId: string
  phone: string | null
  companyName: string | null
  contactPerson: string | null
  contactPhone: string | null
  balance: string
  overdueAt: Date | null
  creditLimit: string | null
}

function parseImportRow(row: SheetRow, rowNo: number): ParsedImportRow | { error: string } {
  const platformTenantId = pickColumn(row, IMPORT_PLATFORM_ID)
  if (!platformTenantId) {
    return { error: '缺少租户ID' }
  }
  const balanceRaw = pickColumn(row, IMPORT_BALANCE)
  const creditRaw = pickColumn(row, IMPORT_CREDIT)
  const balance = parseMoneyCell(balanceRaw)
  if (balanceRaw && Number.isNaN(Number(balance.replace(/,/g, '')))) {
    return { error: '余额格式无效' }
  }
  let creditLimit: string | null = null
  if (creditRaw) {
    creditLimit = parseMoneyCell(creditRaw)
    if (Number.isNaN(Number(creditLimit))) {
      return { error: '授信额度格式无效' }
    }
  }
  return {
    rowNo,
    platformTenantId,
    phone: pickColumn(row, IMPORT_PHONE),
    companyName: pickColumn(row, IMPORT_COMPANY),
    contactPerson: pickColumn(row, IMPORT_CONTACT),
    contactPhone: pickColumn(row, IMPORT_CONTACT_PHONE),
    balance,
    overdueAt: parseOverdueAt(pickColumn(row, IMPORT_OVERDUE)),
    creditLimit,
  }
}

function tenantDisplayName(phone: string | null, platformTenantId: string): string {
  if (phone?.trim()) return phone.trim()
  return `租户-${platformTenantId}`
}

function customerDisplayName(
  companyName: string | null,
  phone: string | null,
  platformTenantId: string,
): string {
  if (companyName?.trim()) return companyName.trim()
  if (phone?.trim()) return phone.trim()
  return `租户-${platformTenantId}`
}

export const billingTenantsDataAccess = {
  async list(
    filters: { search?: string; tagId?: string } = {},
    scope?: CrmDataScope,
  ): Promise<BillingTenantListItem[]> {
    const q = filters.search?.trim()
    const tagId = filters.tagId?.trim()
    const tenantIdsWithTag = tagId ? await loadTenantIdsWithTag(tagId) : null
    if (tenantIdsWithTag && tenantIdsWithTag.size === 0) return []

    const visibleTenantIds = scope ? await loadVisibleTenantIds(scope) : null
    if (visibleTenantIds && visibleTenantIds.length === 0) return []

    const rows = await db
      .select({ tenant: billingTenant, cust: customer })
      .from(billingTenant)
      .innerJoin(customer, eq(customer.id, billingTenant.customerId))
      .where(
        and(
          q
            ? or(
                ilike(billingTenant.platformTenantId, `%${q}%`),
                ilike(billingTenant.name, `%${q}%`),
                ilike(billingTenant.phone, `%${q}%`),
                ilike(customer.name, `%${q}%`),
                ilike(customer.contactPhone, `%${q}%`),
              )
            : undefined,
          tenantIdsWithTag
            ? inArray(billingTenant.id, [...tenantIdsWithTag])
            : undefined,
          buildTenantIdFilter(scope ?? { type: 'all' }, visibleTenantIds),
        ),
      )
      .orderBy(desc(billingTenant.createdAt))

    const tagMap = await loadProjectTagsByTenantIds(rows.map((r) => r.tenant.id))

    return rows.map((r) => mapListRow(r.tenant, r.cust, tagMap.get(r.tenant.id) ?? []))
  },

  async getById(id: string, scope?: CrmDataScope): Promise<BillingTenantDetail | null> {
    return filterTenantGetById(scope ?? { type: 'all' }, id, async () => {
      const row = await db
        .select({ tenant: billingTenant, cust: customer })
        .from(billingTenant)
        .innerJoin(customer, eq(customer.id, billingTenant.customerId))
        .where(eq(billingTenant.id, id))
        .limit(1)

      const hit = row[0]
      if (!hit) return null

      const base = mapListRow(hit.tenant, hit.cust)
      return {
        ...base,
        customerType: hit.cust.type as 'B' | 'C',
        customerStatus: hit.cust.status,
        contactEmail: hit.cust.contactEmail ?? undefined,
        updatedAt: hit.tenant.updatedAt.toISOString(),
      }
    })
  },

  async update(id: string, input: BillingTenantUpdateInput): Promise<BillingTenantDetail> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('计费租户不存在')

    await db.transaction(async (tx) => {
      await tx
        .update(billingTenant)
        .set({
          name: input.tenant.name.trim(),
          phone: input.tenant.phone?.trim() || null,
          status: input.tenant.status,
          balance: input.tenant.balance.toFixed(4),
          overdue_at: input.tenant.overdueAt ? new Date(input.tenant.overdueAt) : null,
          credit_limit:
            input.tenant.creditLimit != null && input.tenant.creditLimit !== undefined
              ? input.tenant.creditLimit.toFixed(4)
              : null,
          isDefault: input.tenant.isDefault,
        })
        .where(eq(billingTenant.id, id))

      await tx
        .update(customer)
        .set({
          type: input.customer.type,
          contactPerson: input.customer.contactPerson.trim(),
          contactPhone: input.customer.contactPhone.trim(),
          contactEmail: input.customer.contactEmail.trim(),
          status: input.customer.status,
        })
        .where(eq(customer.id, existing.customerId))

      if (input.tenant.isDefault && !existing.isDefault) {
        await tx
          .update(billingTenant)
          .set({ isDefault: false })
          .where(
            and(
              eq(billingTenant.customerId, existing.customerId),
              sql`${billingTenant.id} <> ${id}`,
            ),
          )
      }
    })

    const updated = await this.getById(id)
    if (!updated) throw new Error('更新失败')
    return updated
  },

  async updateInternalSetting(
    id: string,
    input: BillingTenantInternalSettingInput,
  ): Promise<BillingTenantDetail> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('计费租户不存在')

    await db
      .update(billingTenant)
      .set({
        type: input.type,
        internalEffectiveFrom:
          input.type === 'internal' ? input.internalEffectiveFrom?.trim() || null : null,
        internalEffectiveTo:
          input.type === 'internal' ? input.internalEffectiveTo?.trim() || null : null,
      })
      .where(eq(billingTenant.id, id))

    const updated = await this.getById(id)
    if (!updated) throw new Error('更新失败')
    return updated
  },

  async importFromExcel(buffer: Buffer, fileName: string): Promise<TenantImportResult> {
    const sheetRows = parseWorkbookBuffer(buffer, fileName)
    const deduped = new Map<string, ParsedImportRow>()
    const errors: TenantImportResult['errors'] = []

    sheetRows.forEach((row, idx) => {
      const rowNo = idx + 2
      const parsed = parseImportRow(row, rowNo)
      if ('error' in parsed) {
        errors.push({
          row: rowNo,
          platformTenantId: pickColumn(row, IMPORT_PLATFORM_ID) ?? undefined,
          message: parsed.error,
        })
        return
      }
      deduped.set(parsed.platformTenantId, parsed)
    })

    let created = 0
    let updated = 0

    for (const row of deduped.values()) {
      try {
        const existing = await db.query.billingTenant.findFirst({
          where: eq(billingTenant.platformTenantId, row.platformTenantId),
        })

        if (existing) {
          await db
            .update(billingTenant)
            .set({
              balance: row.balance,
              overdue_at: row.overdueAt,
              credit_limit: row.creditLimit,
            })
            .where(eq(billingTenant.id, existing.id))
          updated++
        } else {
          const customerId = newId()
          const tenantId = newId()
          const custName = customerDisplayName(
            row.companyName,
            row.phone,
            row.platformTenantId,
          )
          const tName = tenantDisplayName(row.phone, row.platformTenantId)

          await db.transaction(async (tx) => {
            await tx.insert(customer).values({
              id: customerId,
              name: custName,
              shortName: custName,
              type: 'C',
              status: 'active',
              contactPerson: row.contactPerson?.trim() ?? '',
              contactPhone: row.contactPhone?.trim() ?? '',
              contactEmail: '',
              industry: '',
              address: '',
            })
            await tx.insert(billingTenant).values({
              id: tenantId,
              customerId,
              name: tName,
              platformTenantId: row.platformTenantId,
              phone: row.phone?.trim() || null,
              isDefault: true,
              status: 'active',
              balance: row.balance,
              overdue_at: row.overdueAt,
              credit_limit: row.creditLimit,
            })
          })
          created++
        }
      } catch (e) {
        errors.push({
          row: row.rowNo,
          platformTenantId: row.platformTenantId,
          message: e instanceof Error ? e.message : '导入失败',
        })
      }
    }

    return {
      total: sheetRows.length,
      created,
      updated,
      failed: errors.length,
      errors,
    }
  },
}
